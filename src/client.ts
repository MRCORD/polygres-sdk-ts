import {
  API_VERSION_HEADER,
  CLIENT_INFO_HEADER,
  DEFAULT_API_VERSION,
  VERSION,
} from './version';
import {
  PolygresAmbiguousWriteError,
  PolygresAPIError,
  PolygresAuthError,
  PolygresError,
  PolygresMaintenanceError,
  PolygresNotFoundError,
  PolygresPermissionError,
  PolygresRateLimitError,
  PolygresRuntimeError,
  PolygresValidationError,
  canonicalErrorDetails,
  redactText,
  redactValue,
  syncedProjectSurfaceUnavailableError,
} from './errors';
import {
  ConnectionInfo,
  GraphConnectionResponse,
  GraphPathResponse,
  GraphResult,
  HybridResult,
  Page,
  RetrievalReadiness,
  TextResult,
  VectorResult,
} from './models';
import { parseRetryAfterSeconds } from './context-wait';
import { RowsNamespace } from './rows';
import { ContextNamespace } from './context';
import {
  checkCentralVersionNotices,
  emitVersionNotice,
   
} from './version-notices';

const PROJECT_RE = /^p[a-z0-9]{23}$/;
const API_KEY_RE = /^poly_live_[0-9a-f]{32}$/;
export const RETRY_STATUSES = new Set([408, 429, 500, 502, 503, 504]);

const PROTECTED_HEADERS = new Set([
  'authorization',
  'user-agent',
  API_VERSION_HEADER.toLowerCase(),
  CLIENT_INFO_HEADER.toLowerCase(),
]);

export type ProjectMode = 'standard' | 'synced';

export interface PolygresOptions {
  apiKey?: string;
  api_key?: string;
  runtimeUrl?: string | null;
  runtime_url?: string | null;
  baseUrl?: string | null;
  base_url?: string | null;
  timeout?: number;
  connectTimeout?: number;
  connect_timeout?: number;
  maxRetries?: number;
  max_retries?: number;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
}

export interface TransportResponse {
  payload: Record<string, any>;
  headers: Headers;
  statusCode: number;
}

export class Polygres {
  readonly _apiKey: string;
  readonly _baseUrl: string;
  readonly _timeout: number;
  readonly _maxRetries: number;
  readonly _headers: Record<string, string>;
  readonly _fetch: typeof fetch;

  constructor(options: PolygresOptions) {
    const rawKey = options.apiKey ?? options.api_key;
    if (!rawKey || typeof rawKey !== 'string' || !API_KEY_RE.test(rawKey)) {
      throw new PolygresValidationError('API key must match poly_live_[32hex]');
    }

    const selectedUrl = selectRuntimeUrl({
      runtime_url: options.runtimeUrl ?? options.runtime_url ?? null,
      base_url: options.baseUrl ?? options.base_url ?? null,
    });
    validateBaseUrl(selectedUrl);

    const connectTimeout = options.connectTimeout ?? options.connect_timeout ?? 10.0;
    validatePositiveTimeout(connectTimeout, 'connect_timeout');

    const timeout = options.timeout ?? 30.0;
    if (typeof timeout !== 'number' || !Number.isFinite(timeout) || timeout <= 0) {
      throw new PolygresValidationError('timeout must be a positive number or httpx.Timeout');
    }

    const maxRetries = options.maxRetries ?? options.max_retries ?? 2;
    if (typeof maxRetries !== 'number' || maxRetries < 0 || maxRetries > 5 || !Number.isInteger(maxRetries)) {
      throw new PolygresValidationError('max_retries must be between 0 and 5');
    }

    if (options.headers) {
      for (const [k, v] of Object.entries(options.headers)) {
        if (typeof k !== 'string' || typeof v !== 'string') {
          throw new PolygresValidationError('headers must contain string keys and values');
        }
      }
    }

    this._apiKey = rawKey;
    this._baseUrl = selectedUrl.replace(/\/+$/, '');
    this._timeout = timeout;
    this._maxRetries = maxRetries;
    this._headers = options.headers ? { ...options.headers } : {};
    this._fetch = options.fetch ?? (typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : fetch);
  }

  project(
    projectId?: string | null,
    options?: { projectMode?: ProjectMode | null; project_mode?: ProjectMode | null }
  ): Project {
    if (projectId !== undefined && projectId !== null && !PROJECT_RE.test(projectId)) {
      throw new PolygresValidationError('project id must match ^p[a-z0-9]{23}$');
    }
    const mode = options?.projectMode ?? options?.project_mode ?? null;
    if (mode !== null && mode !== 'standard' && mode !== 'synced') {
      throw new PolygresValidationError("project_mode must be 'standard' or 'synced'");
    }
    return new Project(this, projectId ?? null, mode);
  }

  close(): void {
    // No persistent connection pool to close when using standard fetch
  }

  _headersFor(requestHeaders?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {};
    for (const [k, v] of Object.entries(this._headers)) {
      if (!PROTECTED_HEADERS.has(k.toLowerCase())) {
        headers[k] = v;
      }
    }
    if (requestHeaders) {
      for (const [k, v] of Object.entries(requestHeaders)) {
        if (!PROTECTED_HEADERS.has(k.toLowerCase())) {
          headers[k] = v;
        }
      }
    }

    const nodeVersion = typeof process !== 'undefined' && process.versions?.node ? process.versions.node : 'unknown';
    headers['Authorization'] = `Bearer ${this._apiKey}`;
    headers['User-Agent'] = `polygres-ts/${VERSION}`;
    headers[CLIENT_INFO_HEADER] = `polygres-ts/${VERSION}; node/${nodeVersion}; runtime/fetch`;
    headers[API_VERSION_HEADER] = DEFAULT_API_VERSION;

    return headers;
  }

  async _get(
    path: string,
    options: {
      params?: Record<string, any>;
      headers?: Record<string, string>;
      timeout?: number | null;
      maxRetries?: number | null;
      retryable?: boolean;
      deadline?: number | null;
    } = {}
  ): Promise<Record<string, any>> {
    return (
      await this._requestResponse('GET', path, {
        params: options.params,
        headers: options.headers,
        timeout: options.timeout,
        maxRetries: options.maxRetries,
        retryable: options.retryable,
        deadline: options.deadline,
      })
    ).payload;
  }

  async _post(
    path: string,
    payload: Record<string, any>,
    options: {
      headers?: Record<string, string>;
      timeout?: number | null;
      maxRetries?: number | null;
      retryable?: boolean;
      deadline?: number | null;
    } = {}
  ): Promise<Record<string, any>> {
    return (
      await this._requestResponse('POST', path, {
        json: payload,
        headers: options.headers,
        timeout: options.timeout,
        maxRetries: options.maxRetries,
        retryable: options.retryable,
        deadline: options.deadline,
      })
    ).payload;
  }

  async _patch(
    path: string,
    payload: Record<string, any>,
    options: {
      headers?: Record<string, string>;
      timeout?: number | null;
      maxRetries?: number | null;
      retryable?: boolean;
      deadline?: number | null;
    } = {}
  ): Promise<Record<string, any>> {
    return (
      await this._requestResponse('PATCH', path, {
        json: payload,
        headers: options.headers,
        timeout: options.timeout,
        maxRetries: options.maxRetries,
        retryable: options.retryable,
        deadline: options.deadline,
      })
    ).payload;
  }

  async _delete(
    path: string,
    payload?: Record<string, any>,
    options: {
      headers?: Record<string, string>;
      timeout?: number | null;
      maxRetries?: number | null;
      retryable?: boolean;
      deadline?: number | null;
    } = {}
  ): Promise<Record<string, any>> {
    return (
      await this._requestResponse('DELETE', path, {
        json: payload,
        headers: options.headers,
        timeout: options.timeout,
        maxRetries: options.maxRetries,
        retryable: options.retryable,
        deadline: options.deadline,
      })
    ).payload;
  }

  async _request(
    method: string,
    path: string,
    options: {
      json?: Record<string, any>;
      params?: Record<string, any>;
      headers?: Record<string, string>;
      timeout?: number | null;
      maxRetries?: number | null;
      retryable?: boolean;
      deadline?: number | null;
    } = {}
  ): Promise<Record<string, any>> {
    return (await this._requestResponse(method, path, options)).payload;
  }

  async _requestResponse(
    method: string,
    path: string,
    options: {
      json?: Record<string, any>;
      params?: Record<string, any>;
      headers?: Record<string, string>;
      timeout?: number | null;
      maxRetries?: number | null;
      retryable?: boolean;
      deadline?: number | null;
    } = {}
  ): Promise<TransportResponse> {
    const retryBudget =
      (options.retryable ?? true)
        ? (options.maxRetries !== undefined && options.maxRetries !== null
            ? options.maxRetries
            : this._maxRetries)
        : 0;

    if (retryBudget < 0 || retryBudget > 5) {
      throw new PolygresValidationError('max_retries must be between 0 and 5');
    }

    const timeoutSec = options.timeout !== undefined && options.timeout !== null ? options.timeout : this._timeout;
    if (typeof timeoutSec !== 'number' || timeoutSec <= 0 || !Number.isFinite(timeoutSec)) {
      throw new PolygresValidationError('timeout must be a positive number or httpx.Timeout');
    }

    let url = `${this._baseUrl}${path}`;
    if (options.params && Object.keys(options.params).length > 0) {
      const compactParams = compact(options.params);
      const searchParams = new URLSearchParams();
      for (const [k, v] of Object.entries(compactParams)) {
        if (v !== undefined && v !== null) {
          searchParams.append(k, String(v));
        }
      }
      const qs = searchParams.toString();
      if (qs) {
        url += (url.includes('?') ? '&' : '?') + qs;
      }
    }

    for (let attempt = 0; attempt <= retryBudget; attempt++) {
      const remainingSec = options.deadline !== undefined && options.deadline !== null
        ? options.deadline - Date.now() / 1000
        : null;

      if (remainingSec !== null && remainingSec <= 0) {
        throw deadlineError(method, path);
      }

      const effectiveTimeoutSec = remainingSec !== null ? Math.min(timeoutSec, remainingSec) : timeoutSec;
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      let timedOut = false;
      const timeoutId = controller
        ? setTimeout(() => {
            timedOut = true;
            controller.abort();
          }, effectiveTimeoutSec * 1000)
        : null;

      let response: Response;
      try {
        const fetchHeaders = this._headersFor(options.headers);
        const reqInit: RequestInit = {
          method,
          headers: fetchHeaders,
          signal: controller?.signal,
        };
        if (options.json !== undefined) {
          reqInit.body = JSON.stringify(compact(options.json));
          fetchHeaders['Content-Type'] = 'application/json';
        }

        response = await this._fetch(url, reqInit);
      } catch (err: any) {
        if (timeoutId) clearTimeout(timeoutId);

        if (timedOut || err?.name === 'AbortError') {
          if (attempt < retryBudget && (await sleepBeforeRetry(attempt, null, options.deadline))) {
            continue;
          }
          throw new PolygresRuntimeError(
            `Polygres ${method} ${path} timed out after ${retryBudget + 1} attempts. Please wait a while and retry.`,
            { statusCode: null }
          );
        }

        if (attempt < retryBudget && (await sleepBeforeRetry(attempt, null, options.deadline))) {
          continue;
        }
        throw new PolygresRuntimeError(
          `Polygres ${method} ${path} could not reach ${this._baseUrl} after ${retryBudget + 1} attempts; check the API URL, network, and proxy settings, then retry`,
          { statusCode: null }
        );
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
      }

      const headersObj = headersToRecord(response.headers);
      let error: PolygresError | null = null;
      if (!response.ok) {
        error = await parseApiError(response, this._apiKey);
      }

      if (error instanceof PolygresMaintenanceError) {
        emitVersionNotice(headersObj, VERSION);
        throw error;
      }

      if (RETRY_STATUSES.has(response.status) && attempt < retryBudget) {
        const retryAfterHeader = response.headers.get('Retry-After');
        if (await sleepBeforeRetry(attempt, retryAfterHeader, options.deadline)) {
          continue;
        }
        if (options.deadline !== undefined && options.deadline !== null && Date.now() / 1000 >= options.deadline) {
          throw deadlineError(method, path);
        }
      }

      emitVersionNotice(headersObj, VERSION);
      checkCentralVersionNotices(VERSION);

      if (error !== null) {
        throw error;
      }

      let payload: any;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new PolygresRuntimeError(
          `Polygres ${method} ${path} returned an invalid response`,
          { statusCode: response.status }
        );
      }

      return {
        payload,
        headers: response.headers,
        statusCode: response.status,
      };
    }

    throw new PolygresRuntimeError('Polygres request failed');
  }
}

export class Project {
  readonly _client: Polygres;
  readonly projectId: string | null;
  readonly project_id: string | null;
  projectMode: ProjectMode | null;
  project_mode: ProjectMode | null;

  readonly graph: GraphNamespace;
  readonly vector: VectorNamespace;
  readonly text: TextNamespace;
  readonly hybrid: HybridNamespace;
  readonly context: ContextNamespace;
  readonly rows: RowsNamespace;

  constructor(client: Polygres, projectId: string | null, projectMode: ProjectMode | null = null) {
    this._client = client;
    this.projectId = projectId;
    this.project_id = projectId;
    this.projectMode = projectMode;
    this.project_mode = projectMode;

    this.graph = new GraphNamespace(this);
    this.vector = new VectorNamespace(this);
    this.text = new TextNamespace(this);
    this.hybrid = new HybridNamespace(this);
    this.context = new ContextNamespace(this);
    this.rows = new RowsNamespace(this);
  }

  async connectionInfo(): Promise<ConnectionInfo> {
    this._requireLegacySurfaceAvailable();
    const payload = await this._client._get('/connection-info');
    this._observeProjectMode(payload);
    this._requireLegacySurfaceAvailable();
    return ConnectionInfo.fromApi(payload);
  }

  async connection_info(): Promise<ConnectionInfo> {
    return this.connectionInfo();
  }

  async readiness(): Promise<RetrievalReadiness> {
    const payload = await this._client._get('/retrieval/readiness');
    return RetrievalReadiness.fromApi(payload);
  }

  _requireLegacySurfaceAvailable(): void {
    if (this.projectMode === 'synced' || this.project_mode === 'synced') {
      throw syncedProjectSurfaceUnavailableError();
    }
  }

  _observeProjectMode(payload: Record<string, any>): void {
    const project = payload.project;
    let mode = payload.project_mode;
    if (mode === undefined && project && typeof project === 'object') {
      mode = project.project_mode;
    }
    if (mode === 'synced') {
      this.projectMode = 'synced';
      this.project_mode = 'synced';
    }
  }

  async _postPage<T>(
    path: string,
    payload: Record<string, any>,
    parser: (item: any) => T,
    options: {
      timeout?: number | null;
      maxRetries?: number | null;
    } = {}
  ): Promise<Page<T>> {
    const response = await this._client._post(path, compact(payload), {
      timeout: options.timeout,
      maxRetries: options.maxRetries,
    });

    const fetchNext = (cursor: string): Promise<Page<T>> => {
      return this._postPage(
        path,
        { ...payload, cursor },
        parser,
        options
      );
    };

    return Page.fromApi(response, parser, fetchNext);
  }
}

export class GraphNamespace {
  private readonly _project: Project;

  constructor(project: Project) {
    this._project = project;
  }

  async expand(
    start: Record<string, any> | Array<Record<string, any>>,
    options: {
      maxDepth?: number;
      max_depth?: number;
      relationshipTypes?: string[] | null;
      relationship_types?: string[] | null;
      direction?: string;
      filters?: Record<string, any> | null;
      targetTable?: Record<string, any> | null;
      target_table?: Record<string, any> | null;
      limit?: number;
      cursor?: string | null;
      timeout?: number | null;
      maxRetries?: number | null;
    } = {}
  ): Promise<Page<GraphResult>> {
    validateRequired(start, 'start');
    const maxDepth = options.maxDepth ?? options.max_depth ?? 5;
    const limit = options.limit ?? 50;
    validateRange(maxDepth, 'max_depth', 1, 20);
    validateRange(limit, 'limit', 1, 1000);

    const payload = {
      start,
      max_depth: maxDepth,
      relationship_types: options.relationshipTypes ?? options.relationship_types ?? null,
      direction: sdkDirection(options.direction ?? 'out'),
      filters: options.filters || {},
      target_table: options.targetTable ?? options.target_table ?? null,
      limit,
      cursor: options.cursor ?? null,
    };

    return this._project._postPage('/graph/expand', payload, GraphResult.fromApi, {
      timeout: options.timeout,
      maxRetries: options.maxRetries,
    });
  }

  async neighborhood(
    start: Record<string, any>,
    options: {
      radius?: number;
      relationshipTypes?: string[] | null;
      relationship_types?: string[] | null;
      direction?: string;
      filters?: Record<string, any> | null;
      targetTable?: Record<string, any> | null;
      target_table?: Record<string, any> | null;
      limit?: number;
      cursor?: string | null;
      timeout?: number | null;
      maxRetries?: number | null;
    } = {}
  ): Promise<Page<GraphResult>> {
    validateRequired(start, 'start');
    const radius = options.radius ?? 2;
    const limit = options.limit ?? 100;
    validateRange(radius, 'radius', 1, 20);
    validateRange(limit, 'limit', 1, 1000);

    const payload = {
      start,
      max_depth: radius,
      relationship_types: options.relationshipTypes ?? options.relationship_types ?? null,
      direction: sdkDirection(options.direction ?? 'any'),
      filters: options.filters || {},
      target_table: options.targetTable ?? options.target_table ?? null,
      limit,
      cursor: options.cursor ?? null,
    };

    return this._project._postPage('/graph/neighborhood', payload, GraphResult.fromApi, {
      timeout: options.timeout,
      maxRetries: options.maxRetries,
    });
  }

  async related(
    start: Record<string, any>,
    options: {
      relationshipTypes?: string[] | null;
      relationship_types?: string[] | null;
      direction?: string;
      filters?: Record<string, any> | null;
      targetTable?: Record<string, any> | null;
      target_table?: Record<string, any> | null;
      limit?: number;
      cursor?: string | null;
      timeout?: number | null;
      maxRetries?: number | null;
    } = {}
  ): Promise<Page<GraphResult>> {
    validateRequired(start, 'start');
    const limit = options.limit ?? 20;
    validateRange(limit, 'limit', 1, 1000);

    const payload = {
      start,
      max_depth: 1,
      relationship_types: options.relationshipTypes ?? options.relationship_types ?? null,
      direction: sdkDirection(options.direction ?? 'any'),
      filters: options.filters || {},
      target_table: options.targetTable ?? options.target_table ?? null,
      limit,
      cursor: options.cursor ?? null,
    };

    return this._project._postPage('/graph/related', payload, GraphResult.fromApi, {
      timeout: options.timeout,
      maxRetries: options.maxRetries,
    });
  }

  async path(
    source: Record<string, any>,
    target: Record<string, any>,
    options: {
      maxDepth?: number;
      max_depth?: number;
      relationshipTypes?: string[] | null;
      relationship_types?: string[] | null;
      direction?: string;
      timeout?: number | null;
    } = {}
  ): Promise<GraphPathResponse> {
    validateRequired(source, 'source');
    validateRequired(target, 'target');
    const maxDepth = options.maxDepth ?? options.max_depth ?? 5;
    validateRange(maxDepth, 'max_depth', 1, 20);

    const payload = compact({
      source,
      target,
      max_depth: maxDepth,
      relationship_types: options.relationshipTypes ?? options.relationship_types ?? null,
      direction: sdkDirection(options.direction ?? 'any'),
    });

    const response = await this._project._client._post('/graph/path', payload, {
      timeout: options.timeout,
    });
    return GraphPathResponse.fromApi(response);
  }

  async connection(
    entities: Array<Record<string, any>>,
    options: {
      maxDepth?: number;
      max_depth?: number;
      relationshipTypes?: string[] | null;
      relationship_types?: string[] | null;
      direction?: string;
      timeout?: number | null;
    } = {}
  ): Promise<GraphConnectionResponse> {
    if (!Array.isArray(entities) || entities.length < 2 || entities.length > 10) {
      throw new PolygresValidationError('entities must contain 2..10 items');
    }
    const maxDepth = options.maxDepth ?? options.max_depth ?? 5;
    validateRange(maxDepth, 'max_depth', 1, 20);

    const payload = compact({
      entities,
      max_depth: maxDepth,
      relationship_types: options.relationshipTypes ?? options.relationship_types ?? null,
      direction: sdkDirection(options.direction ?? 'any'),
    });

    const response = await this._project._client._post('/graph/connection', payload, {
      timeout: options.timeout,
    });
    return GraphConnectionResponse.fromApi(response);
  }
}

export class VectorNamespace {
  private readonly _project: Project;

  constructor(project: Project) {
    this._project = project;
  }

  async search(
    embedding: number[],
    options: {
      config?: string | null;
      limit?: number | null;
      filters?: Record<string, any> | null;
      maxDistance?: number | null;
      max_distance?: number | null;
      minSimilarity?: number | null;
      min_similarity?: number | null;
      includeValues?: boolean;
      include_values?: boolean;
      cursor?: string | null;
      timeout?: number | null;
      maxRetries?: number | null;
    } = {}
  ): Promise<Page<VectorResult>> {
    validateEmbedding(embedding);
    const maxDist = options.maxDistance ?? options.max_distance ?? null;
    const minSim = options.minSimilarity ?? options.min_similarity ?? null;
    validateVectorOptions(options.limit ?? null, maxDist, minSim);

    const payload = {
      embedding,
      config: options.config ?? null,
      limit: options.limit ?? null,
      filters: options.filters || {},
      max_distance: maxDist,
      min_similarity: minSim,
      include_values: Boolean(options.includeValues ?? options.include_values),
      cursor: options.cursor ?? null,
    };

    return this._project._postPage('/vector/search', payload, VectorResult.fromApi, {
      timeout: options.timeout,
      maxRetries: options.maxRetries,
    });
  }

  async similarTo(
    rowId: string,
    options: {
      config?: string | null;
      limit?: number | null;
      filters?: Record<string, any> | null;
      maxDistance?: number | null;
      max_distance?: number | null;
      minSimilarity?: number | null;
      min_similarity?: number | null;
      includeValues?: boolean;
      include_values?: boolean;
      cursor?: string | null;
      timeout?: number | null;
      maxRetries?: number | null;
    } = {}
  ): Promise<Page<VectorResult>> {
    if (!rowId) {
      throw new PolygresValidationError('row_id is required');
    }
    const maxDist = options.maxDistance ?? options.max_distance ?? null;
    const minSim = options.minSimilarity ?? options.min_similarity ?? null;
    validateVectorOptions(options.limit ?? null, maxDist, minSim);

    const payload = {
      row_id: rowId,
      config: options.config ?? null,
      limit: options.limit ?? null,
      filters: options.filters || {},
      max_distance: maxDist,
      min_similarity: minSim,
      include_values: Boolean(options.includeValues ?? options.include_values),
      cursor: options.cursor ?? null,
    };

    return this._project._postPage('/vector/similar-to', payload, VectorResult.fromApi, {
      timeout: options.timeout,
      maxRetries: options.maxRetries,
    });
  }

  similar_to(rowId: string, options: any = {}): Promise<Page<VectorResult>> {
    return this.similarTo(rowId, options);
  }
}

export class TextNamespace {
  private readonly _project: Project;

  constructor(project: Project) {
    this._project = project;
  }

  async tsvector(
    query: string,
    options: {
      config: string;
      limit?: number;
      filters?: Record<string, any> | null;
      cursor?: string | null;
      timeout?: number | null;
      maxRetries?: number | null;
    }
  ): Promise<Page<TextResult>> {
    validateTextQuery(query);
    const limit = options.limit ?? 10;
    validateRange(limit, 'limit', 1, 1000);

    const payload = {
      query,
      config: options.config,
      limit,
      filters: options.filters || {},
      cursor: options.cursor ?? null,
    };

    return this._project._postPage('/text/tsvector', payload, TextResult.fromApi, {
      timeout: options.timeout,
      maxRetries: options.maxRetries,
    });
  }

  async fuzzy(
    query: string,
    options: {
      config: string;
      limit?: number;
      filters?: Record<string, any> | null;
      cursor?: string | null;
      timeout?: number | null;
      maxRetries?: number | null;
    }
  ): Promise<Page<TextResult>> {
    validateTextQuery(query);
    const limit = options.limit ?? 10;
    validateRange(limit, 'limit', 1, 1000);

    const payload = {
      query,
      config: options.config,
      limit,
      filters: options.filters || {},
      cursor: options.cursor ?? null,
    };

    return this._project._postPage('/text/fuzzy', payload, TextResult.fromApi, {
      timeout: options.timeout,
      maxRetries: options.maxRetries,
    });
  }
}

export class HybridNamespace {
  private readonly _project: Project;

  constructor(project: Project) {
    this._project = project;
  }

  async graphFirst(
    start: Record<string, any>,
    embedding: number[],
    options: {
      config?: string | null;
      maxDepth?: number;
      max_depth?: number;
      relationshipTypes?: string[] | null;
      relationship_types?: string[] | null;
      direction?: string;
      filters?: Record<string, any> | null;
      vectorWeight?: number;
      vector_weight?: number;
      graphWeight?: number;
      graph_weight?: number;
      limit?: number;
      cursor?: string | null;
      timeout?: number | null;
      maxRetries?: number | null;
    } = {}
  ): Promise<Page<HybridResult>> {
    validateEmbedding(embedding);
    const maxDepth = options.maxDepth ?? options.max_depth ?? 2;
    const limit = options.limit ?? 10;
    validateRange(maxDepth, 'max_depth', 1, 20);
    validateRange(limit, 'limit', 1, 1000);

    const payload = {
      start,
      embedding,
      config: options.config ?? null,
      max_depth: maxDepth,
      relationship_types: options.relationshipTypes ?? options.relationship_types ?? null,
      direction: sdkDirection(options.direction ?? 'any'),
      filters: options.filters || {},
      weights: {
        vector: options.vectorWeight ?? options.vector_weight ?? 0.7,
        graph: options.graphWeight ?? options.graph_weight ?? 0.3,
      },
      limit,
      cursor: options.cursor ?? null,
    };

    return this._project._postPage('/hybrid/graph-first', payload, HybridResult.fromApi, {
      timeout: options.timeout,
      maxRetries: options.maxRetries,
    });
  }

  graph_first(start: Record<string, any>, embedding: number[], options: any = {}): Promise<Page<HybridResult>> {
    return this.graphFirst(start, embedding, options);
  }

  async vectorFirst(
    embedding: number[],
    options: {
      start?: Record<string, any> | null;
      config?: string | null;
      vectorLimit?: number;
      vector_limit?: number;
      maxDepth?: number;
      max_depth?: number;
      relationshipTypes?: string[] | null;
      relationship_types?: string[] | null;
      direction?: string;
      filters?: Record<string, any> | null;
      vectorWeight?: number;
      vector_weight?: number;
      graphWeight?: number;
      graph_weight?: number;
      limit?: number;
      cursor?: string | null;
      timeout?: number | null;
      maxRetries?: number | null;
    } = {}
  ): Promise<Page<HybridResult>> {
    validateEmbedding(embedding);
    const vectorLimit = options.vectorLimit ?? options.vector_limit ?? 20;
    const maxDepth = options.maxDepth ?? options.max_depth ?? 1;
    const limit = options.limit ?? 10;
    validateRange(vectorLimit, 'vector_limit', 1, 1000);
    validateRange(maxDepth, 'max_depth', 1, 20);
    validateRange(limit, 'limit', 1, 1000);

    const payload = {
      embedding,
      start: options.start ?? null,
      config: options.config ?? null,
      vector_limit: vectorLimit,
      max_depth: maxDepth,
      relationship_types: options.relationshipTypes ?? options.relationship_types ?? null,
      direction: sdkDirection(options.direction ?? 'any'),
      filters: options.filters || {},
      weights: {
        vector: options.vectorWeight ?? options.vector_weight ?? 0.7,
        graph: options.graphWeight ?? options.graph_weight ?? 0.3,
      },
      limit,
      cursor: options.cursor ?? null,
    };

    return this._project._postPage('/hybrid/vector-first', payload, HybridResult.fromApi, {
      timeout: options.timeout,
      maxRetries: options.maxRetries,
    });
  }

  vector_first(embedding: number[], options: any = {}): Promise<Page<HybridResult>> {
    return this.vectorFirst(embedding, options);
  }

  async joint(
    embedding: number[],
    start: Record<string, any>,
    options: {
      config?: string | null;
      vectorWeight?: number;
      vector_weight?: number;
      graphWeight?: number;
      graph_weight?: number;
      maxDepth?: number;
      max_depth?: number;
      relationshipTypes?: string[] | null;
      relationship_types?: string[] | null;
      direction?: string;
      filters?: Record<string, any> | null;
      vectorLimit?: number;
      vector_limit?: number;
      limit?: number;
      cursor?: string | null;
      timeout?: number | null;
      maxRetries?: number | null;
    } = {}
  ): Promise<Page<HybridResult>> {
    validateEmbedding(embedding);
    const maxDepth = options.maxDepth ?? options.max_depth ?? 2;
    const vectorLimit = options.vectorLimit ?? options.vector_limit ?? 20;
    const limit = options.limit ?? 10;
    validateRange(maxDepth, 'max_depth', 1, 20);
    validateRange(vectorLimit, 'vector_limit', 1, 1000);
    validateRange(limit, 'limit', 1, 1000);

    const payload = {
      embedding,
      start,
      config: options.config ?? null,
      weights: {
        vector: options.vectorWeight ?? options.vector_weight ?? 0.7,
        graph: options.graphWeight ?? options.graph_weight ?? 0.3,
      },
      max_depth: maxDepth,
      relationship_types: options.relationshipTypes ?? options.relationship_types ?? null,
      direction: sdkDirection(options.direction ?? 'any'),
      filters: options.filters || {},
      vector_limit: vectorLimit,
      limit,
      cursor: options.cursor ?? null,
    };

    return this._project._postPage('/hybrid/joint', payload, HybridResult.fromApi, {
      timeout: options.timeout,
      maxRetries: options.maxRetries,
    });
  }
}

function selectRuntimeUrl(options: { runtime_url?: string | null; base_url?: string | null }): string {
  const normalizedRuntimeUrl = options.runtime_url ? options.runtime_url.replace(/\/+$/, '') : null;
  const normalizedBaseUrl = options.base_url ? options.base_url.replace(/\/+$/, '') : null;
  if (normalizedRuntimeUrl && normalizedBaseUrl && normalizedRuntimeUrl !== normalizedBaseUrl) {
    throw new PolygresValidationError('runtime_url and base_url must match when both are provided');
  }
  const selected = normalizedRuntimeUrl || normalizedBaseUrl;
  if (!selected) {
    throw new PolygresValidationError('runtime_url is required');
  }
  return selected;
}

function validateBaseUrl(baseUrl: string): void {
  try {
    const parsed = new URL(baseUrl);
    if (parsed.protocol === 'https:' && parsed.host) return;
    if (parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')) {
      return;
    }
  } catch {}
  throw new PolygresValidationError('base_url must be HTTPS except localhost development');
}

function validatePositiveTimeout(value: number, name: string): void {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new PolygresValidationError(`${name} must be positive`);
  }
}

function validateRequired(value: any, name: string): void {
  if (!value || (Array.isArray(value) && value.length === 0)) {
    throw new PolygresValidationError(`${name} is required`);
  }
}

function validateRange(value: number, name: string, minimum: number, maximum: number): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < minimum || value > maximum) {
    throw new PolygresValidationError(`${name} must be between ${minimum} and ${maximum}`);
  }
}

function validateEmbedding(embedding: number[]): void {
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new PolygresValidationError('embedding must be non-empty');
  }
  for (const val of embedding) {
    if (typeof val !== 'number' || !Number.isFinite(val)) {
      throw new PolygresValidationError('embedding values must be finite numbers');
    }
  }
}

function validateTextQuery(query: string): void {
  if (typeof query !== 'string' || !query.trim()) {
    throw new PolygresValidationError('query must be non-empty');
  }
}

function validateVectorOptions(
  limit: number | null,
  maxDistance: number | null,
  minSimilarity: number | null
): void {
  if (limit !== null) {
    validateRange(limit, 'limit', 1, 1000);
  }
  if (maxDistance !== null && minSimilarity !== null) {
    throw new PolygresValidationError('max_distance and min_similarity are mutually exclusive');
  }
}

function sdkDirection(direction: string): string {
  if (!['out', 'in', 'any', 'both'].includes(direction)) {
    throw new PolygresValidationError('direction must be out, in, any, or both');
  }
  return direction === 'both' ? 'any' : direction;
}

export function compact(payload: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (v !== undefined && v !== null) {
      result[k] = v;
    }
  }
  return result;
}

async function sleepBeforeRetry(
  attempt: number,
  retryAfter: string | null,
  deadline?: number | null
): Promise<boolean> {
  let delay = 0.025 * (2 ** attempt) + Math.random() * 0.005;
  const parsedDelay = parseRetryAfterSeconds(retryAfter);
  if (parsedDelay !== null) {
    delay = parsedDelay;
  }
  if (deadline !== undefined && deadline !== null) {
    const remaining = deadline - Date.now() / 1000;
    if (remaining <= 0) return false;
    if (delay >= remaining) {
      await sleepMs(remaining * 1000);
      return false;
    }
  }
  await sleepMs(delay * 1000);
  return true;
}

const sleepMs = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, Math.max(0, ms)));

function deadlineError(method: string, path: string): PolygresRuntimeError {
  return new PolygresRuntimeError(`Polygres ${method} ${path} exceeded its deadline`, {
    statusCode: null,
    code: 'TIMEOUT',
  });
}

function headersToRecord(headers: Headers): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((value, key) => {
    record[key] = value;
  });
  return record;
}

export async function parseApiError(response: Response, secret?: string): Promise<PolygresError> {
  let body: any;
  try {
    body = await response.clone().json();
  } catch {
    body = {};
  }
  const errorObj = body && typeof body === 'object' && body.error ? body.error : {};
  const reqIdVal = body && typeof body === 'object' ? body.request_id : null;
  const requestId = reqIdVal ? redactText(String(reqIdVal), secret) : null;
  const code = errorObj.code ?? null;
  const variant = errorObj.variant ?? null;
  const details = errorObj.details && typeof errorObj.details === 'object' ? errorObj.details : {};

  const canonical = canonicalErrorDetails(code, variant, details);
  const serverMessage = String(errorObj.message || `Polygres API error ${response.status}`);
  let message = canonical ? canonical.message : serverMessage;
  let finalCode = code;
  let finalDetails = details;
  let statusCode = response.status;

  if (canonical) {
    finalCode = canonical.code;
    finalDetails = canonical.details;
    if (canonical.statusCode) {
      statusCode = canonical.statusCode;
    }
  }

  finalDetails = redactValue(finalDetails, secret);
  message = redactText(message, secret);

  const kwargs = {
    statusCode,
    requestId,
    code: finalCode,
    details: finalDetails,
  };

  if (statusCode === 401) {
    return new PolygresAuthError(message, kwargs);
  }
  if (statusCode === 403) {
    return new PolygresPermissionError(message, kwargs);
  }
  if (statusCode === 404) {
    return new PolygresNotFoundError(message, kwargs);
  }
  if (statusCode === 429) {
    return new PolygresRateLimitError(message, kwargs);
  }
  if (finalCode === 'MAINTENANCE_READ_ONLY' || finalCode === 'MAINTENANCE_FULL') {
    return new PolygresMaintenanceError(message, kwargs);
  }
  if (finalCode === 'ROW_WRITE_OUTCOME_AMBIGUOUS') {
    return new PolygresAmbiguousWriteError(message, kwargs);
  }
  if ([408, 500, 502, 503, 504].includes(statusCode)) {
    return new PolygresRuntimeError(message, kwargs);
  }
  if (statusCode === 400 && finalCode === 'UNSUPPORTED_API_VERSION') {
    return new PolygresValidationError(message, kwargs);
  }
  if (finalCode === 'VECTOR_CREATION_RETIRED') {
    return new PolygresValidationError(message, kwargs);
  }
  if (statusCode === 400 && ['VECTOR_ROW_ID_INVALID', 'VECTOR_ROW_ID_TYPE_UNSUPPORTED'].includes(finalCode)) {
    return new PolygresValidationError(message, kwargs);
  }
  if (statusCode === 400 && typeof finalCode === 'string' && finalCode.startsWith('CONTEXT_')) {
    return new PolygresValidationError(message, kwargs);
  }
  if ([400, 413, 422].includes(statusCode) && typeof finalCode === 'string' && finalCode.startsWith('ROW_')) {
    return new PolygresValidationError(message, kwargs);
  }

  return new PolygresAPIError(message, kwargs);
}
