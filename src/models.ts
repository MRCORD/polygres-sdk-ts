function floatOrNull(value: any): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function toDict(value: any): any {
  if (value && typeof value.to_dict === 'function') {
    return value.to_dict();
  }
  if (value && typeof value.toJSON === 'function') {
    return value.toJSON();
  }
  if (Array.isArray(value)) {
    return value.map(toDict);
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = toDict(v);
    }
    return result;
  }
  return value;
}

export class Page<T> implements AsyncIterable<T> {
  readonly results: T[];
  readonly next_cursor: string | null;
  readonly has_more: boolean;
  readonly request_id: string | null;
  readonly metadata: Record<string, any>;
  private readonly _fetchNext?: (cursor: string) => Promise<Page<T>>;

  constructor(options: {
    results: T[];
    next_cursor?: string | null;
    has_more?: boolean;
    request_id?: string | null;
    metadata?: Record<string, any>;
    fetchNext?: (cursor: string) => Promise<Page<T>>;
  }) {
    this.results = options.results;
    this.next_cursor = options.next_cursor ?? null;
    this.has_more = Boolean(options.has_more);
    this.request_id = options.request_id ?? null;
    this.metadata = options.metadata ?? {};
    this._fetchNext = options.fetchNext;
  }

  get nextCursor(): string | null {
    return this.next_cursor;
  }

  get length(): number {
    return this.results.length;
  }

  get(index: number): T | undefined {
    return this.results[index];
  }

  get hasMore(): boolean {
    return this.has_more;
  }

  get requestId(): string | null {
    return this.request_id;
  }

  static fromApi<T>(
    payload: Record<string, any>,
    parser: (item: any) => T,
    fetchNext?: (cursor: string) => Promise<Page<T>>
  ): Page<T> {
    const rawResults = Array.isArray(payload.results) ? payload.results : [];
    const metadata: Record<string, any> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (!['results', 'next_cursor', 'has_more', 'request_id'].includes(key)) {
        metadata[key] = value;
      }
    }
    return new Page<T>({
      results: rawResults.map(parser),
      next_cursor: payload.next_cursor ?? null,
      has_more: Boolean(payload.has_more),
      request_id: payload.request_id ?? null,
      metadata,
      fetchNext,
    });
  }

  static from_api<T>(
    payload: Record<string, any>,
    parser: (item: any) => T,
    fetchNext?: (cursor: string) => Promise<Page<T>>
  ): Page<T> {
    return Page.fromApi(payload, parser, fetchNext);
  }

  async *autoPagingIter(): AsyncGenerator<T, void, undefined> {
    let page: Page<T> = this;
    while (true) {
      for (const item of page.results) {
        yield item;
      }
      if (!page.has_more || !page.next_cursor || !page._fetchNext) {
        return;
      }
      page = await page._fetchNext(page.next_cursor);
    }
  }

  auto_paging_iter(): AsyncGenerator<T, void, undefined> {
    return this.autoPagingIter();
  }

  [Symbol.asyncIterator](): AsyncGenerator<T, void, undefined> {
    return this.autoPagingIter();
  }

  to_dict(): Record<string, any> {
    return {
      results: this.results.map(toDict),
      next_cursor: this.next_cursor,
      has_more: this.has_more,
      request_id: this.request_id,
      metadata: toDict(this.metadata),
    };
  }

  toJSON(): Record<string, any> {
    return this.to_dict();
  }
}

export class ConnectionInfo {
  readonly project_id: string;
  readonly database: string;
  readonly username: string;
  readonly port: number;
  readonly direct_host: string;
  readonly pooled_host: string;
  readonly direct_url_without_password: string;
  readonly pooled_url_without_password: string;
  readonly request_id: string | null;
  readonly metadata: Record<string, any>;

  constructor(data: {
    project_id: string;
    database: string;
    username: string;
    port: number;
    direct_host: string;
    pooled_host: string;
    direct_url_without_password: string;
    pooled_url_without_password: string;
    request_id?: string | null;
    metadata?: Record<string, any>;
  }) {
    this.project_id = data.project_id;
    this.database = data.database;
    this.username = data.username;
    this.port = data.port;
    this.direct_host = data.direct_host;
    this.pooled_host = data.pooled_host;
    this.direct_url_without_password = data.direct_url_without_password;
    this.pooled_url_without_password = data.pooled_url_without_password;
    this.request_id = data.request_id ?? null;
    this.metadata = data.metadata ?? {};
  }

  get projectId(): string { return this.project_id; }
  get directHost(): string { return this.direct_host; }
  get pooledHost(): string { return this.pooled_host; }
  get directUrlWithoutPassword(): string { return this.direct_url_without_password; }
  get pooledUrlWithoutPassword(): string { return this.pooled_url_without_password; }
  get requestId(): string | null { return this.request_id; }

  static fromApi(payload: Record<string, any>): ConnectionInfo {
    const direct = payload.direct || {};
    const pooled = payload.pooled || {};
    return new ConnectionInfo({
      project_id: String(payload.project_id),
      database: String(payload.database),
      username: String(payload.username),
      port: Number(payload.port),
      direct_host: String(direct.host),
      pooled_host: String(pooled.host),
      direct_url_without_password: String(direct.connection_string_without_password),
      pooled_url_without_password: String(pooled.connection_string_without_password),
      request_id: payload.request_id ?? null,
      metadata: payload.metadata ? { ...payload.metadata } : {},
    });
  }

  static from_api(payload: Record<string, any>): ConnectionInfo {
    return ConnectionInfo.fromApi(payload);
  }

  to_dict(): Record<string, any> {
    return {
      project_id: this.project_id,
      database: this.database,
      username: this.username,
      port: this.port,
      direct_host: this.direct_host,
      pooled_host: this.pooled_host,
      direct_url_without_password: this.direct_url_without_password,
      pooled_url_without_password: this.pooled_url_without_password,
      request_id: this.request_id,
      metadata: { ...this.metadata },
    };
  }

  toJSON(): Record<string, any> {
    return this.to_dict();
  }
}

export class RetrievalReadiness {
  readonly project_id: string;
  readonly graph: Record<string, any>;
  readonly vector: Record<string, any>;
  readonly hybrid: Record<string, any>;
  readonly request_id: string | null;
  readonly metadata: Record<string, any>;

  constructor(data: {
    project_id: string;
    graph: Record<string, any>;
    vector: Record<string, any>;
    hybrid: Record<string, any>;
    request_id?: string | null;
    metadata?: Record<string, any>;
  }) {
    this.project_id = data.project_id;
    this.graph = data.graph;
    this.vector = data.vector;
    this.hybrid = data.hybrid;
    this.request_id = data.request_id ?? null;
    this.metadata = data.metadata ?? {};
  }

  get projectId(): string { return this.project_id; }
  get requestId(): string | null { return this.request_id; }

  static fromApi(payload: Record<string, any>): RetrievalReadiness {
    return new RetrievalReadiness({
      project_id: String(payload.project_id),
      graph: payload.graph ? { ...payload.graph } : {},
      vector: payload.vector ? { ...payload.vector } : {},
      hybrid: payload.hybrid ? { ...payload.hybrid } : {},
      request_id: payload.request_id ?? null,
      metadata: payload.metadata ? { ...payload.metadata } : {},
    });
  }

  static from_api(payload: Record<string, any>): RetrievalReadiness {
    return RetrievalReadiness.fromApi(payload);
  }

  to_dict(): Record<string, any> {
    return {
      project_id: this.project_id,
      graph: { ...this.graph },
      vector: { ...this.vector },
      hybrid: { ...this.hybrid },
      request_id: this.request_id,
      metadata: { ...this.metadata },
    };
  }

  toJSON(): Record<string, any> {
    return this.to_dict();
  }
}

export class RowWriteValidation {
  readonly valid: boolean;
  readonly operation: string;
  readonly schema: string;
  readonly table: string;
  readonly writable_columns: string[];
  readonly conflict_constraint: string | null;
  readonly context: Record<string, any> | null;
  readonly request_id: string | null;

  constructor(data: {
    valid: boolean;
    operation: string;
    schema: string;
    table: string;
    writable_columns: string[];
    conflict_constraint: string | null;
    context: Record<string, any> | null;
    request_id: string | null;
  }) {
    this.valid = data.valid;
    this.operation = data.operation;
    this.schema = data.schema;
    this.table = data.table;
    this.writable_columns = data.writable_columns;
    this.conflict_constraint = data.conflict_constraint;
    this.context = data.context;
    this.request_id = data.request_id;
  }

  get writableColumns(): string[] { return this.writable_columns; }
  get conflictConstraint(): string | null { return this.conflict_constraint; }
  get requestId(): string | null { return this.request_id; }

  static fromApi(payload: Record<string, any>): RowWriteValidation {
    return new RowWriteValidation({
      valid: Boolean(payload.valid),
      operation: String(payload.operation),
      schema: String(payload.schema),
      table: String(payload.table),
      writable_columns: Array.isArray(payload.writable_columns)
        ? payload.writable_columns.map(String)
        : [],
      conflict_constraint:
        payload.conflict_constraint !== null && payload.conflict_constraint !== undefined
          ? String(payload.conflict_constraint)
          : null,
      context: payload.context && typeof payload.context === 'object' ? { ...payload.context } : null,
      request_id: payload.request_id ? String(payload.request_id) : null,
    });
  }

  static from_api(payload: Record<string, any>): RowWriteValidation {
    return RowWriteValidation.fromApi(payload);
  }

  to_dict(): Record<string, any> {
    return {
      valid: this.valid,
      operation: this.operation,
      schema: this.schema,
      table: this.table,
      writable_columns: [...this.writable_columns],
      conflict_constraint: this.conflict_constraint,
      context: this.context ? { ...this.context } : null,
      request_id: this.request_id,
    };
  }

  toJSON(): Record<string, any> {
    return this.to_dict();
  }
}

export class RowContextReconciliationResult {
  readonly collection_id: string;
  status: string;
  readonly operation_id: string | null;
  operation_status: string | null;
  readonly retry_until: string | null;
  error: Record<string, any> | null;

  constructor(data: {
    collection_id: string;
    status: string;
    operation_id: string | null;
    operation_status: string | null;
    retry_until: string | null;
    error: Record<string, any> | null;
  }) {
    this.collection_id = data.collection_id;
    this.status = data.status;
    this.operation_id = data.operation_id;
    this.operation_status = data.operation_status;
    this.retry_until = data.retry_until;
    this.error = data.error;
  }

  get collectionId(): string { return this.collection_id; }
  get operationId(): string | null { return this.operation_id; }
  get operationStatus(): string | null { return this.operation_status; }
  get retryUntil(): string | null { return this.retry_until; }

  static fromApi(payload: Record<string, any>): RowContextReconciliationResult {
    return new RowContextReconciliationResult({
      collection_id: String(payload.collection_id),
      status: String(payload.status),
      operation_id: payload.operation_id ? String(payload.operation_id) : null,
      operation_status:
        payload.operation_status !== null && payload.operation_status !== undefined
          ? String(payload.operation_status)
          : null,
      retry_until: payload.retry_until ? String(payload.retry_until) : null,
      error: payload.error && typeof payload.error === 'object' ? { ...payload.error } : null,
    });
  }

  static from_api(payload: Record<string, any>): RowContextReconciliationResult {
    return RowContextReconciliationResult.fromApi(payload);
  }

  to_dict(): Record<string, any> {
    return {
      collection_id: this.collection_id,
      status: this.status,
      operation_id: this.operation_id,
      operation_status: this.operation_status,
      retry_until: this.retry_until,
      error: this.error ? { ...this.error } : null,
    };
  }

  toJSON(): Record<string, any> {
    return this.to_dict();
  }
}

export class RowWriteResult {
  readonly operation: string;
  readonly schema: string;
  readonly table: string;
  readonly returned: Record<string, any>;
  status: string;
  readonly row_committed: boolean;
  readonly context: RowContextReconciliationResult | null;
  readonly idempotency_key: string | null;
  readonly request_id: string | null;

  constructor(data: {
    operation: string;
    schema: string;
    table: string;
    returned: Record<string, any>;
    status: string;
    row_committed: boolean;
    context: RowContextReconciliationResult | null;
    idempotency_key: string | null;
    request_id: string | null;
  }) {
    this.operation = data.operation;
    this.schema = data.schema;
    this.table = data.table;
    this.returned = data.returned;
    this.status = data.status;
    this.row_committed = data.row_committed;
    this.context = data.context;
    this.idempotency_key = data.idempotency_key;
    this.request_id = data.request_id;
  }

  get rowCommitted(): boolean { return this.row_committed; }
  get idempotencyKey(): string | null { return this.idempotency_key; }
  get requestId(): string | null { return this.request_id; }

  static fromApi(payload: Record<string, any>): RowWriteResult {
    const contextPayload = payload.context;
    return new RowWriteResult({
      operation: String(payload.operation),
      schema: String(payload.schema),
      table: String(payload.table),
      returned: payload.returned && typeof payload.returned === 'object' ? { ...payload.returned } : {},
      status: String(payload.status),
      row_committed: Boolean(payload.row_committed),
      context:
        contextPayload && typeof contextPayload === 'object'
          ? RowContextReconciliationResult.fromApi(contextPayload)
          : null,
      idempotency_key:
        payload.idempotency_key !== null && payload.idempotency_key !== undefined
          ? String(payload.idempotency_key)
          : null,
      request_id: payload.request_id ? String(payload.request_id) : null,
    });
  }

  static from_api(payload: Record<string, any>): RowWriteResult {
    return RowWriteResult.fromApi(payload);
  }

  to_dict(): Record<string, any> {
    return {
      operation: this.operation,
      schema: this.schema,
      table: this.table,
      returned: { ...this.returned },
      status: this.status,
      row_committed: this.row_committed,
      context: this.context ? this.context.to_dict() : null,
      idempotency_key: this.idempotency_key,
      request_id: this.request_id,
    };
  }

  toJSON(): Record<string, any> {
    return this.to_dict();
  }
}

export class GraphNode {
  readonly schema: string;
  readonly table: string;
  readonly id: string;
  readonly properties: Record<string, any>;

  constructor(data: {
    schema: string;
    table: string;
    id: string;
    properties?: Record<string, any>;
  }) {
    this.schema = data.schema;
    this.table = data.table;
    this.id = data.id;
    this.properties = data.properties ?? {};
  }

  static fromApi(payload: Record<string, any>): GraphNode {
    return new GraphNode({
      schema: String(payload.schema),
      table: String(payload.table),
      id: String(payload.id),
      properties: payload.properties && typeof payload.properties === 'object' ? { ...payload.properties } : {},
    });
  }

  static from_api(payload: Record<string, any>): GraphNode {
    return GraphNode.fromApi(payload);
  }

  to_dict(): Record<string, any> {
    return {
      schema: this.schema,
      table: this.table,
      id: this.id,
      properties: { ...this.properties },
    };
  }

  toJSON(): Record<string, any> {
    return this.to_dict();
  }
}

export class GraphPathStep {
  readonly step: number;
  readonly node: GraphNode;
  readonly edge_label: string | null;
  readonly readable_path: string | null;

  constructor(data: {
    step: number;
    node: GraphNode;
    edge_label?: string | null;
    readable_path?: string | null;
  }) {
    this.step = data.step;
    this.node = data.node;
    this.edge_label = data.edge_label ?? null;
    this.readable_path = data.readable_path ?? null;
  }

  get edgeLabel(): string | null { return this.edge_label; }
  get readablePath(): string | null { return this.readable_path; }

  static fromApi(payload: Record<string, any>): GraphPathStep {
    const nodePayload = payload.node || payload;
    return new GraphPathStep({
      step: Number(payload.step ?? 0),
      node: GraphNode.fromApi(nodePayload),
      edge_label: payload.edge_label ?? null,
      readable_path: payload.readable_path ?? null,
    });
  }

  static from_api(payload: Record<string, any>): GraphPathStep {
    return GraphPathStep.fromApi(payload);
  }

  to_dict(): Record<string, any> {
    return {
      step: this.step,
      node: this.node.to_dict(),
      edge_label: this.edge_label,
      readable_path: this.readable_path,
    };
  }

  toJSON(): Record<string, any> {
    return this.to_dict();
  }
}

export class GraphResult {
  readonly node: GraphNode;
  readonly depth: number;
  readonly rank: number | null;
  readonly graph_score: number | null;
  readonly path: any[] | null;
  readonly edge_path: any[] | null;
  readonly readable_path: string | null;
  readonly relationships: any[];

  constructor(data: {
    node: GraphNode;
    depth: number;
    rank?: number | null;
    graph_score?: number | null;
    path?: any[] | null;
    edge_path?: any[] | null;
    readable_path?: string | null;
    relationships?: any[];
  }) {
    this.node = data.node;
    this.depth = data.depth;
    this.rank = data.rank ?? null;
    this.graph_score = data.graph_score ?? null;
    this.path = data.path ?? null;
    this.edge_path = data.edge_path ?? null;
    this.readable_path = data.readable_path ?? null;
    this.relationships = data.relationships ?? [];
  }

  get graphScore(): number | null { return this.graph_score; }
  get edgePath(): any[] | null { return this.edge_path; }
  get readablePath(): string | null { return this.readable_path; }

  static fromApi(payload: Record<string, any>): GraphResult {
    const nodePayload: Record<string, any> = { ...(payload.node || {}) };
    if (!('properties' in nodePayload)) {
      nodePayload.properties = payload.properties || {};
    }
    return new GraphResult({
      node: GraphNode.fromApi(nodePayload),
      depth: Number(payload.depth ?? 0),
      rank: payload.rank !== undefined && payload.rank !== null ? Number(payload.rank) : null,
      graph_score: floatOrNull(payload.graph_score),
      path: Array.isArray(payload.path) ? payload.path : null,
      edge_path: Array.isArray(payload.edge_path) ? payload.edge_path : null,
      readable_path: payload.readable_path ? String(payload.readable_path) : null,
      relationships: Array.isArray(payload.relationships) ? payload.relationships : [],
    });
  }

  static from_api(payload: Record<string, any>): GraphResult {
    return GraphResult.fromApi(payload);
  }

  to_dict(): Record<string, any> {
    return {
      node: this.node.to_dict(),
      depth: this.depth,
      rank: this.rank,
      graph_score: this.graph_score,
      path: this.path,
      edge_path: this.edge_path,
      readable_path: this.readable_path,
      relationships: [...this.relationships],
    };
  }

  toJSON(): Record<string, any> {
    return this.to_dict();
  }
}

export class VectorResult {
  readonly schema: string;
  readonly table: string;
  readonly id: string;
  readonly properties: Record<string, any>;
  readonly distance: number | null;
  readonly similarity: number | null;
  readonly score: number | null;

  constructor(data: {
    schema: string;
    table: string;
    id: string;
    properties: Record<string, any>;
    distance?: number | null;
    similarity?: number | null;
    score?: number | null;
  }) {
    this.schema = data.schema;
    this.table = data.table;
    this.id = data.id;
    this.properties = data.properties;
    this.distance = data.distance ?? null;
    this.similarity = data.similarity ?? null;
    this.score = data.score ?? null;
  }

  static fromApi(payload: Record<string, any>): VectorResult {
    return new VectorResult({
      schema: String(payload.schema),
      table: String(payload.table),
      id: String(payload.id),
      properties: payload.properties && typeof payload.properties === 'object' ? { ...payload.properties } : {},
      distance: floatOrNull(payload.distance),
      similarity: floatOrNull(payload.similarity),
      score: floatOrNull(payload.score),
    });
  }

  static from_api(payload: Record<string, any>): VectorResult {
    return VectorResult.fromApi(payload);
  }

  to_dict(): Record<string, any> {
    return {
      schema: this.schema,
      table: this.table,
      id: this.id,
      properties: { ...this.properties },
      distance: this.distance,
      similarity: this.similarity,
      score: this.score,
    };
  }

  toJSON(): Record<string, any> {
    return this.to_dict();
  }
}

export class TextResult {
  readonly schema: string;
  readonly table: string;
  readonly id: string;
  readonly properties: Record<string, any>;
  readonly score: number;
  readonly similarity: number | null;
  readonly key: Record<string, string> | null;

  constructor(data: {
    schema: string;
    table: string;
    id: string;
    properties: Record<string, any>;
    score: number;
    similarity?: number | null;
    key?: Record<string, string> | null;
  }) {
    this.schema = data.schema;
    this.table = data.table;
    this.id = data.id;
    this.properties = data.properties;
    this.score = data.score;
    this.similarity = data.similarity ?? null;
    this.key = data.key ?? null;
  }

  static fromApi(payload: Record<string, any>): TextResult {
    return new TextResult({
      schema: String(payload.schema),
      table: String(payload.table),
      id: String(payload.id),
      properties: payload.properties && typeof payload.properties === 'object' ? { ...payload.properties } : {},
      score: Number(payload.score),
      similarity: floatOrNull(payload.similarity),
      key: payload.key && typeof payload.key === 'object' ? { ...payload.key } : null,
    });
  }

  static from_api(payload: Record<string, any>): TextResult {
    return TextResult.fromApi(payload);
  }

  to_dict(): Record<string, any> {
    return {
      schema: this.schema,
      table: this.table,
      id: this.id,
      properties: { ...this.properties },
      score: this.score,
      similarity: this.similarity,
      key: this.key ? { ...this.key } : null,
    };
  }

  toJSON(): Record<string, any> {
    return this.to_dict();
  }
}

export class HybridResult {
  readonly schema: string;
  readonly table: string;
  readonly id: string;
  readonly properties: Record<string, any>;
  readonly score: number;
  readonly final_score: number | null;
  readonly rrf_score: number | null;
  readonly vector_score: number | null;
  readonly graph_score: number | null;
  readonly vector_rank: number | null;
  readonly graph_rank: number | null;
  readonly graph_depth: number | null;
  readonly distance: number | null;
  readonly similarity: number | null;
  readonly relationships: any[];

  constructor(data: {
    schema: string;
    table: string;
    id: string;
    properties: Record<string, any>;
    score: number;
    final_score?: number | null;
    rrf_score?: number | null;
    vector_score?: number | null;
    graph_score?: number | null;
    vector_rank?: number | null;
    graph_rank?: number | null;
    graph_depth?: number | null;
    distance?: number | null;
    similarity?: number | null;
    relationships?: any[];
  }) {
    this.schema = data.schema;
    this.table = data.table;
    this.id = data.id;
    this.properties = data.properties;
    this.score = data.score;
    this.final_score = data.final_score ?? null;
    this.rrf_score = data.rrf_score ?? null;
    this.vector_score = data.vector_score ?? null;
    this.graph_score = data.graph_score ?? null;
    this.vector_rank = data.vector_rank ?? null;
    this.graph_rank = data.graph_rank ?? null;
    this.graph_depth = data.graph_depth ?? null;
    this.distance = data.distance ?? null;
    this.similarity = data.similarity ?? null;
    this.relationships = data.relationships ?? [];
  }

  get finalScore(): number | null { return this.final_score; }
  get rrfScore(): number | null { return this.rrf_score; }
  get vectorScore(): number | null { return this.vector_score; }
  get graphScore(): number | null { return this.graph_score; }
  get vectorRank(): number | null { return this.vector_rank; }
  get graphRank(): number | null { return this.graph_rank; }
  get graphDepth(): number | null { return this.graph_depth; }

  static fromApi(payload: Record<string, any>): HybridResult {
    const node = payload.node || payload;
    const scoreVal = payload.score ?? payload.final_score ?? payload.rrf_score ?? 0;
    return new HybridResult({
      schema: String(node.schema),
      table: String(node.table),
      id: String(node.id),
      properties: payload.properties || node.properties || {},
      score: Number(scoreVal),
      final_score: floatOrNull(payload.final_score),
      rrf_score: floatOrNull(payload.rrf_score),
      vector_score: floatOrNull(payload.vector_score),
      graph_score: floatOrNull(payload.graph_score),
      vector_rank: payload.vector_rank !== undefined && payload.vector_rank !== null ? Number(payload.vector_rank) : null,
      graph_rank: payload.graph_rank !== undefined && payload.graph_rank !== null ? Number(payload.graph_rank) : null,
      graph_depth: payload.graph_depth !== undefined && payload.graph_depth !== null ? Number(payload.graph_depth) : null,
      distance: floatOrNull(payload.distance),
      similarity: floatOrNull(payload.similarity),
      relationships: Array.isArray(payload.relationships) ? payload.relationships : [],
    });
  }

  static from_api(payload: Record<string, any>): HybridResult {
    return HybridResult.fromApi(payload);
  }

  to_dict(): Record<string, any> {
    return {
      schema: this.schema,
      table: this.table,
      id: this.id,
      properties: { ...this.properties },
      score: this.score,
      final_score: this.final_score,
      rrf_score: this.rrf_score,
      vector_score: this.vector_score,
      graph_score: this.graph_score,
      vector_rank: this.vector_rank,
      graph_rank: this.graph_rank,
      graph_depth: this.graph_depth,
      distance: this.distance,
      similarity: this.similarity,
      relationships: [...this.relationships],
    };
  }

  toJSON(): Record<string, any> {
    return this.to_dict();
  }
}

export class GraphPathResponse {
  readonly paths: Array<Record<string, any>>;
  readonly request_id: string | null;
  readonly metadata: Record<string, any>;

  constructor(data: {
    paths: Array<Record<string, any>>;
    request_id?: string | null;
    metadata?: Record<string, any>;
  }) {
    this.paths = data.paths;
    this.request_id = data.request_id ?? null;
    this.metadata = data.metadata ?? {};
  }

  get requestId(): string | null { return this.request_id; }

  static fromApi(payload: Record<string, any>): GraphPathResponse {
    const metadata: Record<string, any> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (k !== 'paths' && k !== 'request_id') {
        metadata[k] = v;
      }
    }
    return new GraphPathResponse({
      paths: Array.isArray(payload.paths) ? payload.paths : [],
      request_id: payload.request_id ?? null,
      metadata,
    });
  }

  static from_api(payload: Record<string, any>): GraphPathResponse {
    return GraphPathResponse.fromApi(payload);
  }

  to_dict(): Record<string, any> {
    return {
      paths: [...this.paths],
      request_id: this.request_id,
      metadata: { ...this.metadata },
    };
  }

  toJSON(): Record<string, any> {
    return this.to_dict();
  }
}

export class GraphConnectionResponse {
  readonly connections: Array<Record<string, any>>;
  readonly request_id: string | null;
  readonly metadata: Record<string, any>;

  constructor(data: {
    connections: Array<Record<string, any>>;
    request_id?: string | null;
    metadata?: Record<string, any>;
  }) {
    this.connections = data.connections;
    this.request_id = data.request_id ?? null;
    this.metadata = data.metadata ?? {};
  }

  get requestId(): string | null { return this.request_id; }

  static fromApi(payload: Record<string, any>): GraphConnectionResponse {
    const metadata: Record<string, any> = {};
    for (const [k, v] of Object.entries(payload)) {
      if (k !== 'connections' && k !== 'request_id') {
        metadata[k] = v;
      }
    }
    return new GraphConnectionResponse({
      connections: Array.isArray(payload.connections) ? payload.connections : [],
      request_id: payload.request_id ?? null,
      metadata,
    });
  }

  static from_api(payload: Record<string, any>): GraphConnectionResponse {
    return GraphConnectionResponse.fromApi(payload);
  }

  to_dict(): Record<string, any> {
    return {
      connections: [...this.connections],
      request_id: this.request_id,
      metadata: { ...this.metadata },
    };
  }

  toJSON(): Record<string, any> {
    return this.to_dict();
  }
}
