import {
  CapabilitiesResponse,
  BackfillPointsRequest,
  BulkPointKeysRequest,
  CandidateSearchRequest,
  ClearPayloadRequest,
  CollectionAliasDropResponse,
  CollectionAliasListResponse,
  CollectionAliasRequest,
  CollectionAliasResponse,
  CollectionCreateRequest,
  CollectionDeleteRequest,
  CollectionGetResponse,
  CollectionLimitsRequest,
  CollectionLimitsResponse,
  CollectionListResponse,
  CollectionSetDefaultRequest,
  CollectionStatusResponse,
  CollectionUpdateRequest,
  CollectionVectorsResponse,
  ContextCollection,
  ContextCollectionStatus,
  ContextJointResponse,
  ContextOnboardingResponse,
  ContextOperation,
  ContextOperationKind,
  ContextOperationStatus,
  ContextPointDiscoveryRequest,
  ContextQueryPlan,
  ContextVectorCreateRequest,
  CountRequest,
  CountResponse,
  CreateEmbeddingMigrationRequest,
  DeletePayloadRequest,
  DenseSearchRequest,
  DiagnosticsResponse,
  DiscoveryRequest,
  DiscoveryResponse,
  EmbeddingMigrationsResponse,
  EmptyRequest,
  FacetsRequest,
  FacetsResponse,
  FilterColumnRequest,
  FilterJsonbPathRequest,
  FilterListResponse,
  GraphFirstSearchRequest,
  GroupedSearchRequest,
  IndexAdvisorResponse,
  IndexDiagnosticsResponse,
  IndexMemoryEstimateResponse,
  IndexStatusResponse,
  JointSearchRequest,
  ModelVersionsResponse,
  OperationEnvelope,
  OperationListResponse,
  OptimizationStatusResponse,
  PayloadMutationResponse,
  PgContextCollectionInfoResponse,
  PgContextScoredResponse,
  PointBatchResponse,
  PointKeysRequest,
  PointMapping,
  PointMutationResponse,
  PointScrollResponse,
  PointStatusResponse,
  PreflightResponse,
  QueryCohortStatsResponse,
  QueryExecuteRequest,
  QueryExecutionResponse,
  QueryExecutionStatsResponse,
  QueryExplainRequest,
  QueryExplainResponse,
  RankedResponse,
  RankFusionSearchRequest,
  RawVectorSearchRequest,
  RawVectorSearchResponse,
  RecallCheckRequest,
  RecallCheckResponse,
  RecommendRequest,
  RegisterModelVersionRequest,
  SetPayloadRequest,
  TelemetryResponse,
  TextHybridSearchRequest,
  UpdateEmbeddingMigrationRequest,
  VacuumAdviceResponse,
  VectorConfigureRequest,
  VectorConfigureResponse,
  VectorFirstSearchRequest,
  VerificationResponse,
} from './context-models';
import {
  contextCollection,
  contextIdempotencyKey,
  contextIdentifier,
  contextQuery,
  contextUuid,
} from './context-validation';
import { waitForContextOperation } from './context-wait';
import { PolygresRuntimeError, PolygresValidationError } from './errors';
import { Page } from './models';
import type { Project } from './client';

export class ContextNamespace {
  private readonly _project: Project;
  private _capabilitiesCache: CapabilitiesResponse | null = null;
  private _capabilitiesCachedAt: number | null = null;

  constructor(project: Project) {
    this._project = project;
  }

  async getCapabilities(options: { timeout?: number | null } = {}): Promise<CapabilitiesResponse> {
    const res = await this._project._client._get('/context/capabilities', {
      timeout: options.timeout,
    });
    this._capabilitiesCache = res as CapabilitiesResponse;
    this._capabilitiesCachedAt = Date.now() / 1000;
    return res as CapabilitiesResponse;
  }

  get_capabilities(options: { timeout?: number | null } = {}): Promise<CapabilitiesResponse> {
    return this.getCapabilities(options);
  }

  async createCollectionAlias(
    aliasName: string,
    targetCollectionName: string,
    options: { timeout?: number | null } = {}
  ): Promise<CollectionAliasResponse> {
    const payload: CollectionAliasRequest = {
      alias_name: contextIdentifier(aliasName, 'alias_name'),
      target_collection_name: contextIdentifier(targetCollectionName, 'target_collection_name'),
    };
    const res = await this._project._client._post('/context/aliases', payload, {
      timeout: options.timeout,
      retryable: false,
    });
    return res as CollectionAliasResponse;
  }

  create_collection_alias(
    aliasName: string,
    targetCollectionName: string,
    options: any = {}
  ): Promise<CollectionAliasResponse> {
    return this.createCollectionAlias(aliasName, targetCollectionName, options);
  }

  async collectionAliases(options: { timeout?: number | null } = {}): Promise<CollectionAliasListResponse> {
    const res = await this._project._client._get('/context/aliases', {
      timeout: options.timeout,
    });
    return res as CollectionAliasListResponse;
  }

  collection_aliases(options: any = {}): Promise<CollectionAliasListResponse> {
    return this.collectionAliases(options);
  }

  async dropCollectionAlias(
    aliasName: string,
    options: { timeout?: number | null } = {}
  ): Promise<CollectionAliasDropResponse> {
    const alias = contextIdentifier(aliasName, 'alias_name');
    const res = await this._project._client._delete(`/context/aliases/${alias}`, undefined, {
      timeout: options.timeout,
      retryable: false,
    });
    return res as CollectionAliasDropResponse;
  }

  drop_collection_alias(aliasName: string, options: any = {}): Promise<CollectionAliasDropResponse> {
    return this.dropCollectionAlias(aliasName, options);
  }

  async collectionInfo(
    collectionName: string,
    options: { timeout?: number | null } = {}
  ): Promise<PgContextCollectionInfoResponse> {
    const collection = contextIdentifier(collectionName, 'collection_name');
    const res = await this._project._client._get(
      `/context/collections/by-name/${collection}/info`,
      { timeout: options.timeout }
    );
    return res as PgContextCollectionInfoResponse;
  }

  collection_info(collectionName: string, options: any = {}): Promise<PgContextCollectionInfoResponse> {
    return this.collectionInfo(collectionName, options);
  }

  async collectionLimits(
    collectionName: string,
    options: { timeout?: number | null } = {}
  ): Promise<CollectionLimitsResponse> {
    const collection = contextIdentifier(collectionName, 'collection_name');
    const res = await this._project._client._get(
      `/context/collections/by-name/${collection}/limits`,
      { timeout: options.timeout }
    );
    return res as CollectionLimitsResponse;
  }

  collection_limits(collectionName: string, options: any = {}): Promise<CollectionLimitsResponse> {
    return this.collectionLimits(collectionName, options);
  }

  async configureCollectionLimits(
    collectionName: string,
    options: {
      strictMode: boolean;
      strict_mode?: boolean;
      maxDimensions?: number | null;
      max_dimensions?: number | null;
      maxVectors?: number | null;
      max_vectors?: number | null;
      maxPoints?: number | null;
      max_points?: number | null;
      maxFilterNodes?: number | null;
      max_filter_nodes?: number | null;
      maxSearchLimit?: number | null;
      max_search_limit?: number | null;
      maxCandidateBudget?: number | null;
      max_candidate_budget?: number | null;
      queryTimeoutMs?: number | null;
      query_timeout_ms?: number | null;
      maxIndexMemoryBytes?: number | null;
      max_index_memory_bytes?: number | null;
      timeout?: number | null;
    }
  ): Promise<CollectionLimitsResponse> {
    const collection = contextIdentifier(collectionName, 'collection_name');
    const payload: CollectionLimitsRequest = {
      strict_mode: options.strictMode ?? options.strict_mode ?? false,
      max_dimensions: options.maxDimensions ?? options.max_dimensions ?? undefined,
      max_vectors: options.maxVectors ?? options.max_vectors ?? undefined,
      max_points: options.maxPoints ?? options.max_points ?? undefined,
      max_filter_nodes: options.maxFilterNodes ?? options.max_filter_nodes ?? undefined,
      max_search_limit: options.maxSearchLimit ?? options.max_search_limit ?? undefined,
      max_candidate_budget: options.maxCandidateBudget ?? options.max_candidate_budget ?? undefined,
      query_timeout_ms: options.queryTimeoutMs ?? options.query_timeout_ms ?? undefined,
      max_index_memory_bytes: options.maxIndexMemoryBytes ?? options.max_index_memory_bytes ?? undefined,
    };
    const res = await this._project._client._patch(
      `/context/collections/by-name/${collection}/limits`,
      payload,
      {
        timeout: options.timeout,
        retryable: false,
      }
    );
    return res as CollectionLimitsResponse;
  }

  configure_collection_limits(collectionName: string, options: any): Promise<CollectionLimitsResponse> {
    return this.configureCollectionLimits(collectionName, options);
  }

  async collectionVectors(
    collectionName: string,
    options: { timeout?: number | null } = {}
  ): Promise<CollectionVectorsResponse> {
    const collection = contextIdentifier(collectionName, 'collection_name');
    const res = await this._project._client._get(
      `/context/collections/by-name/${collection}/vectors`,
      { timeout: options.timeout }
    );
    return res as CollectionVectorsResponse;
  }

  collection_vectors(collectionName: string, options: any = {}): Promise<CollectionVectorsResponse> {
    return this.collectionVectors(collectionName, options);
  }

  async configureVector(
    collectionName: string,
    vectorName: string,
    options: {
      hnswOptions?: Record<string, any>;
      hnsw_options?: Record<string, any>;
      quantizationOptions?: Record<string, any>;
      quantization_options?: Record<string, any>;
      status: string;
      timeout?: number | null;
    }
  ): Promise<VectorConfigureResponse> {
    const collection = contextIdentifier(collectionName, 'collection_name');
    const vector = contextIdentifier(vectorName, 'vector_name');
    const payload: VectorConfigureRequest = {
      hnsw_options: options.hnswOptions ?? options.hnsw_options ?? {},
      quantization_options: options.quantizationOptions ?? options.quantization_options ?? {},
      status: options.status as any,
    };
    const res = await this._project._client._patch(
      `/context/collections/by-name/${collection}/vectors/${vector}`,
      payload,
      {
        timeout: options.timeout,
        retryable: false,
      }
    );
    return res as VectorConfigureResponse;
  }

  configure_vector(collectionName: string, vectorName: string, options: any): Promise<VectorConfigureResponse> {
    return this.configureVector(collectionName, vectorName, options);
  }

  async getOnboarding(options: { timeout?: number | null } = {}): Promise<ContextOnboardingResponse> {
    const res = await this._project._client._get('/context/onboarding', {
      timeout: options.timeout,
    });
    return res as ContextOnboardingResponse;
  }

  get_onboarding(options: any = {}): Promise<ContextOnboardingResponse> {
    return this.getOnboarding(options);
  }

  async evaluateOnboarding(options: { timeout?: number | null } = {}): Promise<ContextOnboardingResponse> {
    return this._onboardingMutation('evaluate', options);
  }

  evaluate_onboarding(options: any = {}): Promise<ContextOnboardingResponse> {
    return this.evaluateOnboarding(options);
  }

  async refreshOnboarding(options: { timeout?: number | null } = {}): Promise<ContextOnboardingResponse> {
    return this._onboardingMutation('refresh', options);
  }

  refresh_onboarding(options: any = {}): Promise<ContextOnboardingResponse> {
    return this.refreshOnboarding(options);
  }

  async acknowledgeOnboarding(options: { timeout?: number | null } = {}): Promise<ContextOnboardingResponse> {
    return this._onboardingMutation('acknowledge', options);
  }

  acknowledge_onboarding(options: any = {}): Promise<ContextOnboardingResponse> {
    return this.acknowledgeOnboarding(options);
  }

  async dismissOnboarding(options: { timeout?: number | null } = {}): Promise<ContextOnboardingResponse> {
    return this._onboardingMutation('dismiss', options);
  }

  dismiss_onboarding(options: any = {}): Promise<ContextOnboardingResponse> {
    return this.dismissOnboarding(options);
  }

  private async _onboardingMutation(
    action: string,
    options: { timeout?: number | null }
  ): Promise<ContextOnboardingResponse> {
    const res = await this._project._client._post(`/context/onboarding/${action}`, {}, {
      timeout: options.timeout,
      retryable: true,
    });
    return res as ContextOnboardingResponse;
  }

  private async _collectionIndexRead(
    collection: string,
    indexName: string,
    suffix: string,
    options: { timeout?: number | null }
  ): Promise<any> {
    const col = contextIdentifier(collection, 'collection');
    const idx = contextIdentifier(indexName, 'index_name');
    return this._project._client._get(
      `/context/collections/by-name/${col}/indexes/${idx}/${suffix}`,
      { timeout: options.timeout }
    );
  }

  async indexStatus(
    collection: string,
    indexName: string,
    options: { timeout?: number | null } = {}
  ): Promise<IndexStatusResponse> {
    return this._collectionIndexRead(collection, indexName, 'status', options);
  }

  index_status(collection: string, indexName: string, options: any = {}): Promise<IndexStatusResponse> {
    return this.indexStatus(collection, indexName, options);
  }

  async indexDiagnostics(
    collection: string,
    indexName: string,
    options: { timeout?: number | null } = {}
  ): Promise<IndexDiagnosticsResponse> {
    return this._collectionIndexRead(collection, indexName, 'diagnostics', options);
  }

  index_diagnostics(collection: string, indexName: string, options: any = {}): Promise<IndexDiagnosticsResponse> {
    return this.indexDiagnostics(collection, indexName, options);
  }

  async estimateIndexMemory(
    collection: string,
    indexName: string,
    options: { timeout?: number | null } = {}
  ): Promise<IndexMemoryEstimateResponse> {
    return this._collectionIndexRead(collection, indexName, 'memory-estimate', options);
  }

  estimate_index_memory(collection: string, indexName: string, options: any = {}): Promise<IndexMemoryEstimateResponse> {
    return this.estimateIndexMemory(collection, indexName, options);
  }

  async vacuumAdvice(
    collection: string,
    indexName: string,
    options: { timeout?: number | null } = {}
  ): Promise<VacuumAdviceResponse> {
    return this._collectionIndexRead(collection, indexName, 'vacuum-advice', options);
  }

  vacuum_advice(collection: string, indexName: string, options: any = {}): Promise<VacuumAdviceResponse> {
    return this.vacuumAdvice(collection, indexName, options);
  }

  async indexAdvisor(
    collection: string,
    options: { timeout?: number | null } = {}
  ): Promise<IndexAdvisorResponse> {
    const col = contextIdentifier(collection, 'collection');
    return (await this._project._client._get(
      `/context/collections/by-name/${col}/index-advisor`,
      { timeout: options.timeout }
    )) as IndexAdvisorResponse;
  }

  index_advisor(collection: string, options: any = {}): Promise<IndexAdvisorResponse> {
    return this.indexAdvisor(collection, options);
  }

  async optimizationStatus(
    collection: string,
    options: { timeout?: number | null } = {}
  ): Promise<OptimizationStatusResponse> {
    const col = contextIdentifier(collection, 'collection');
    return (await this._project._client._get(
      `/context/collections/by-name/${col}/optimization-status`,
      { timeout: options.timeout }
    )) as OptimizationStatusResponse;
  }

  optimization_status(collection: string, options: any = {}): Promise<OptimizationStatusResponse> {
    return this.optimizationStatus(collection, options);
  }

  async telemetry(
    collection: string,
    options: { timeout?: number | null } = {}
  ): Promise<TelemetryResponse> {
    const col = contextIdentifier(collection, 'collection');
    return (await this._project._client._get(
      `/context/collections/by-name/${col}/telemetry`,
      { timeout: options.timeout }
    )) as TelemetryResponse;
  }

  async queryCohortStats(
    collection: string,
    options: { timeout?: number | null } = {}
  ): Promise<QueryCohortStatsResponse> {
    const col = contextIdentifier(collection, 'collection');
    return (await this._project._client._get(
      `/context/collections/by-name/${col}/query-cohort-stats`,
      { timeout: options.timeout }
    )) as QueryCohortStatsResponse;
  }

  query_cohort_stats(collection: string, options: any = {}): Promise<QueryCohortStatsResponse> {
    return this.queryCohortStats(collection, options);
  }

  async queryExecutionStats(
    collection: string,
    options: { timeout?: number | null } = {}
  ): Promise<QueryExecutionStatsResponse> {
    const col = contextIdentifier(collection, 'collection');
    return (await this._project._client._get(
      `/context/collections/by-name/${col}/query-execution-stats`,
      { timeout: options.timeout }
    )) as QueryExecutionStatsResponse;
  }

  query_execution_stats(collection: string, options: any = {}): Promise<QueryExecutionStatsResponse> {
    return this.queryExecutionStats(collection, options);
  }

  async modelVersions(
    collection: string,
    options: { timeout?: number | null } = {}
  ): Promise<ModelVersionsResponse> {
    const col = contextIdentifier(collection, 'collection');
    return (await this._project._client._get(
      `/context/collections/by-name/${col}/model-versions`,
      { timeout: options.timeout }
    )) as ModelVersionsResponse;
  }

  model_versions(collection: string, options: any = {}): Promise<ModelVersionsResponse> {
    return this.modelVersions(collection, options);
  }

  async registerModelVersion(
    collection: string,
    modelName: string,
    modelVersion: string,
    dimensions: number,
    metric: string,
    options: { timeout?: number | null } = {}
  ): Promise<ModelVersionsResponse> {
    const col = contextIdentifier(collection, 'collection');
    const payload: RegisterModelVersionRequest = {
      collection: col,
      model_name: modelName,
      model_version: modelVersion,
      dimensions,
      metric: metric as any,
    };
    return (await this._project._client._post(
      `/context/collections/by-name/${col}/model-versions`,
      payload,
      { timeout: options.timeout, retryable: false }
    )) as ModelVersionsResponse;
  }

  register_model_version(
    collection: string,
    modelName: string,
    modelVersion: string,
    dimensions: number,
    metric: string,
    options: any = {}
  ): Promise<ModelVersionsResponse> {
    return this.registerModelVersion(collection, modelName, modelVersion, dimensions, metric, options);
  }

  async embeddingMigrations(
    collection: string,
    options: { timeout?: number | null } = {}
  ): Promise<EmbeddingMigrationsResponse> {
    const col = contextIdentifier(collection, 'collection');
    return (await this._project._client._get(
      `/context/collections/by-name/${col}/embedding-migrations`,
      { timeout: options.timeout }
    )) as EmbeddingMigrationsResponse;
  }

  embedding_migrations(collection: string, options: any = {}): Promise<EmbeddingMigrationsResponse> {
    return this.embeddingMigrations(collection, options);
  }

  async createEmbeddingMigration(
    collection: string,
    sourceModelName: string,
    sourceModelVersion: string,
    targetModelName: string,
    targetModelVersion: string,
    totalPoints: number,
    options: { timeout?: number | null } = {}
  ): Promise<EmbeddingMigrationsResponse> {
    const col = contextIdentifier(collection, 'collection');
    const payload: CreateEmbeddingMigrationRequest = {
      collection: col,
      source_model_name: sourceModelName,
      source_model_version: sourceModelVersion,
      target_model_name: targetModelName,
      target_model_version: targetModelVersion,
      total_points: totalPoints,
    };
    return (await this._project._client._post(
      `/context/collections/by-name/${col}/embedding-migrations`,
      payload,
      { timeout: options.timeout, retryable: false }
    )) as EmbeddingMigrationsResponse;
  }

  create_embedding_migration(
    collection: string,
    sourceModelName: string,
    sourceModelVersion: string,
    targetModelName: string,
    targetModelVersion: string,
    totalPoints: number,
    options: any = {}
  ): Promise<EmbeddingMigrationsResponse> {
    return this.createEmbeddingMigration(
      collection,
      sourceModelName,
      sourceModelVersion,
      targetModelName,
      targetModelVersion,
      totalPoints,
      options
    );
  }

  async updateEmbeddingMigration(
    collection: string,
    migrationId: number,
    processedPoints: number,
    status: string,
    options: { timeout?: number | null } = {}
  ): Promise<EmbeddingMigrationsResponse> {
    const col = contextIdentifier(collection, 'collection');
    if (migrationId < 0) {
      throw new PolygresValidationError('migration_id must not be negative', {
        code: 'INVALID_ARGUMENT',
      });
    }
    const payload: UpdateEmbeddingMigrationRequest = {
      processed_points: processedPoints,
      status: status as any,
    };
    return (await this._project._client._patch(
      `/context/collections/by-name/${col}/embedding-migrations/${migrationId}`,
      payload,
      { timeout: options.timeout, retryable: false }
    )) as EmbeddingMigrationsResponse;
  }

  update_embedding_migration(
    collection: string,
    migrationId: number,
    processedPoints: number,
    status: string,
    options: any = {}
  ): Promise<EmbeddingMigrationsResponse> {
    return this.updateEmbeddingMigration(collection, migrationId, processedPoints, status, options);
  }

  async discoverSources(options: {
    schemaNames?: string[] | null;
    schema_names?: string[] | null;
    timeout?: number | null;
  } = {}): Promise<DiscoveryResponse> {
    const payload: DiscoveryRequest = {
      schema_names: options.schemaNames ?? options.schema_names ?? undefined,
    };
    return (await this._project._client._post('/context/discover', payload, {
      timeout: options.timeout,
      retryable: true,
    })) as DiscoveryResponse;
  }

  discover_sources(options: any = {}): Promise<DiscoveryResponse> {
    return this.discoverSources(options);
  }

  async preflight(
    name: string,
    options: {
      source: any;
      vector: any;
      textColumn?: string | null;
      text_column?: string | null;
      resultColumns?: string[] | null;
      result_columns?: string[] | null;
      filterColumns?: string[] | null;
      filter_columns?: string[] | null;
      jsonbFilterPaths?: any[] | null;
      jsonb_filter_paths?: any[] | null;
      indexKind?: string;
      index_kind?: string;
      maxSearchLimit?: number;
      max_search_limit?: number;
      timeout?: number | null;
    }
  ): Promise<PreflightResponse> {
    const payload = this._collectionPayload({
      name,
      source: options.source,
      vector: options.vector,
      text_column: options.textColumn ?? options.text_column ?? null,
      result_columns: options.resultColumns ?? options.result_columns ?? null,
      filter_columns: options.filterColumns ?? options.filter_columns ?? null,
      jsonb_filter_paths: options.jsonbFilterPaths ?? options.jsonb_filter_paths ?? null,
      index_kind: options.indexKind ?? options.index_kind ?? 'hnsw',
      max_search_limit: options.maxSearchLimit ?? options.max_search_limit ?? 1000,
    });
    return (await this._project._client._post('/context/preflight', payload, {
      timeout: options.timeout,
      retryable: true,
    })) as PreflightResponse;
  }

  async listCollections(options: {
    status?: ContextCollectionStatus | string | null;
    limit?: number;
    cursor?: string | null;
    timeout?: number | null;
  } = {}): Promise<Page<ContextCollection>> {
    const limit = options.limit ?? 50;
    pageLimit(limit, 'limit');
    const res = (await this._project._client._get('/context/collections', {
      params: { status: options.status ?? undefined, limit, cursor: options.cursor ?? undefined },
      timeout: options.timeout,
    })) as CollectionListResponse;

    const fetchNext = (nextCursor: string): Promise<Page<ContextCollection>> => {
      return this.listCollections({
        ...options,
        cursor: nextCursor,
      });
    };

    return new Page<ContextCollection>({
      results: res.collections || [],
      next_cursor: res.next_cursor ?? null,
      has_more: Boolean(res.has_more),
      request_id: res.request_id ?? null,
      metadata: res as any,
      fetchNext,
    });
  }

  list_collections(options: any = {}): Promise<Page<ContextCollection>> {
    return this.listCollections(options);
  }

  async getCollection(
    collectionId: string,
    options: { timeout?: number | null } = {}
  ): Promise<CollectionGetResponse> {
    const uuid = contextUuid(collectionId, 'collection_id');
    return (await this._project._client._get(`/context/collections/${uuid}`, {
      timeout: options.timeout,
    })) as CollectionGetResponse;
  }

  get_collection(collectionId: string, options: any = {}): Promise<CollectionGetResponse> {
    return this.getCollection(collectionId, options);
  }

  async getCollectionStatus(
    collectionId: string,
    options: { timeout?: number | null } = {}
  ): Promise<CollectionStatusResponse> {
    const uuid = contextUuid(collectionId, 'collection_id');
    return (await this._project._client._get(`/context/collections/${uuid}/status`, {
      timeout: options.timeout,
    })) as CollectionStatusResponse;
  }

  get_collection_status(collectionId: string, options: any = {}): Promise<CollectionStatusResponse> {
    return this.getCollectionStatus(collectionId, options);
  }

  async verifyCollection(
    collectionId: string,
    options: { timeout?: number | null } = {}
  ): Promise<VerificationResponse> {
    const uuid = contextUuid(collectionId, 'collection_id');
    return (await this._project._client._post(`/context/collections/${uuid}/verify`, {}, {
      timeout: options.timeout,
      retryable: true,
    })) as VerificationResponse;
  }

  verify_collection(collectionId: string, options: any = {}): Promise<VerificationResponse> {
    return this.verifyCollection(collectionId, options);
  }

  async getCollectionDiagnostics(
    collectionId: string,
    options: { timeout?: number | null } = {}
  ): Promise<DiagnosticsResponse> {
    const uuid = contextUuid(collectionId, 'collection_id');
    return (await this._project._client._get(`/context/collections/${uuid}/diagnostics`, {
      timeout: options.timeout,
    })) as DiagnosticsResponse;
  }

  get_collection_diagnostics(collectionId: string, options: any = {}): Promise<DiagnosticsResponse> {
    return this.getCollectionDiagnostics(collectionId, options);
  }

  async createCollection(
    name: string,
    options: {
      source: any;
      vector: any;
      textColumn?: string | null;
      text_column?: string | null;
      resultColumns?: string[] | null;
      result_columns?: string[] | null;
      filterColumns?: string[] | null;
      filter_columns?: string[] | null;
      jsonbFilterPaths?: any[] | null;
      jsonb_filter_paths?: any[] | null;
      indexKind?: string;
      index_kind?: string;
      maxSearchLimit?: number;
      max_search_limit?: number;
      idempotencyKey?: string | null;
      idempotency_key?: string | null;
      timeout?: number | null;
    }
  ): Promise<ContextOperation> {
    const payload = this._collectionPayload({
      name,
      source: options.source,
      vector: options.vector,
      text_column: options.textColumn ?? options.text_column ?? null,
      result_columns: options.resultColumns ?? options.result_columns ?? null,
      filter_columns: options.filterColumns ?? options.filter_columns ?? null,
      jsonb_filter_paths: options.jsonbFilterPaths ?? options.jsonb_filter_paths ?? null,
      index_kind: options.indexKind ?? options.index_kind ?? 'hnsw',
      max_search_limit: options.maxSearchLimit ?? options.max_search_limit ?? 1000,
    });
    return this._operationMutation('POST', '/context/collections', payload, {
      idempotencyKey: options.idempotencyKey ?? options.idempotency_key ?? null,
      timeout: options.timeout,
    });
  }

  create_collection(name: string, options: any): Promise<ContextOperation> {
    return this.createCollection(name, options);
  }

  async registerVector(
    collectionId: string,
    columnName: string,
    dimensions: number,
    options: {
      name?: string | null;
      mode?: string;
      metric?: string;
      indexKind?: string;
      index_kind?: string;
      setDefault?: boolean;
      set_default?: boolean;
      idempotencyKey?: string | null;
      idempotency_key?: string | null;
      timeout?: number | null;
    } = {}
  ): Promise<ContextOperation> {
    const uuid = contextUuid(collectionId, 'collection_id');
    const payload: ContextVectorCreateRequest = {
      name: options.name ?? undefined,
      column_name: columnName,
      dimensions,
      mode: (options.mode || 'existing') as any,
      metric: (options.metric || 'cosine') as any,
      index_kind: (options.indexKind ?? options.index_kind ?? 'hnsw') as any,
      set_default: Boolean(options.setDefault ?? options.set_default),
    };
    return this._operationMutation('POST', `/context/collections/${uuid}/vectors`, payload, {
      idempotencyKey: options.idempotencyKey ?? options.idempotency_key ?? null,
      timeout: options.timeout,
    });
  }

  register_vector(col: string, colName: string, dims: number, options: any = {}): Promise<ContextOperation> {
    return this.registerVector(col, colName, dims, options);
  }

  addVector(col: string, colName: string, dims: number, options: any = {}): Promise<ContextOperation> {
    return this.registerVector(col, colName, dims, options);
  }

  add_vector(col: string, colName: string, dims: number, options: any = {}): Promise<ContextOperation> {
    return this.registerVector(col, colName, dims, options);
  }

  async updateCollection(
    collectionId: string,
    options: {
      textColumn?: string | null;
      text_column?: string | null;
      resultColumns?: string[];
      result_columns?: string[];
      maxSearchLimit?: number;
      max_search_limit?: number;
      defaultVectorName?: string;
      default_vector_name?: string;
      idempotencyKey?: string | null;
      idempotency_key?: string | null;
      timeout?: number | null;
    } = {}
  ): Promise<ContextOperation> {
    const uuid = contextUuid(collectionId, 'collection_id');
    const payload: CollectionUpdateRequest = {};
    if (options.textColumn !== undefined || options.text_column !== undefined) {
      payload.text_column = (options.textColumn ?? options.text_column) as any;
    }
    if (options.resultColumns !== undefined || options.result_columns !== undefined) {
      payload.result_columns = (options.resultColumns ?? options.result_columns) as any;
    }
    if (options.maxSearchLimit !== undefined || options.max_search_limit !== undefined) {
      payload.max_search_limit = (options.maxSearchLimit ?? options.max_search_limit) as any;
    }
    if (options.defaultVectorName !== undefined || options.default_vector_name !== undefined) {
      payload.default_vector_name = (options.defaultVectorName ?? options.default_vector_name) as any;
    }
    return this._operationMutation('PATCH', `/context/collections/${uuid}`, payload, {
      idempotencyKey: options.idempotencyKey ?? options.idempotency_key ?? null,
      timeout: options.timeout,
    });
  }

  update_collection(collectionId: string, options: any = {}): Promise<ContextOperation> {
    return this.updateCollection(collectionId, options);
  }

  async setDefaultCollection(
    collectionId: string,
    options: {
      idempotencyKey?: string | null;
      idempotency_key?: string | null;
      timeout?: number | null;
    } = {}
  ): Promise<ContextOperation> {
    const uuid = contextUuid(collectionId, 'collection_id');
    const payload: CollectionSetDefaultRequest = { is_default: true };
    return this._operationMutation('PATCH', `/context/collections/${uuid}`, payload, {
      idempotencyKey: options.idempotencyKey ?? options.idempotency_key ?? null,
      timeout: options.timeout,
    });
  }

  set_default_collection(collectionId: string, options: any = {}): Promise<ContextOperation> {
    return this.setDefaultCollection(collectionId, options);
  }

  async reindexCollection(
    collectionId: string,
    options: {
      idempotencyKey?: string | null;
      idempotency_key?: string | null;
      timeout?: number | null;
    } = {}
  ): Promise<ContextOperation> {
    const uuid = contextUuid(collectionId, 'collection_id');
    return this._operationMutation('POST', `/context/collections/${uuid}/reindex`, {}, {
      idempotencyKey: options.idempotencyKey ?? options.idempotency_key ?? null,
      timeout: options.timeout,
    });
  }

  reindex_collection(collectionId: string, options: any = {}): Promise<ContextOperation> {
    return this.reindexCollection(collectionId, options);
  }

  async dropCollection(
    collectionId: string,
    options: {
      confirmCollectionId?: string;
      confirm_collection_id?: string;
      idempotencyKey?: string | null;
      idempotency_key?: string | null;
      timeout?: number | null;
    }
  ): Promise<ContextOperation> {
    const uuid = contextUuid(collectionId, 'collection_id');
    const confirmUuid = contextUuid(
      options.confirmCollectionId ?? options.confirm_collection_id ?? '',
      'confirm_collection_id'
    );
    if (confirmUuid !== uuid) {
      throw new PolygresValidationError('confirm_collection_id must exactly match collection_id.', {
        code: 'CONTEXT_DELETE_CONFIRMATION_INVALID',
        details: { collection_id: uuid },
      });
    }
    const payload: CollectionDeleteRequest = { confirm_collection_id: confirmUuid };
    return this._operationMutation('DELETE', `/context/collections/${uuid}`, payload, {
      idempotencyKey: options.idempotencyKey ?? options.idempotency_key ?? null,
      timeout: options.timeout,
    });
  }

  drop_collection(collectionId: string, options: any): Promise<ContextOperation> {
    return this.dropCollection(collectionId, options);
  }

  deleteCollection(collectionId: string, options: any): Promise<ContextOperation> {
    return this.dropCollection(collectionId, options);
  }

  delete_collection(collectionId: string, options: any): Promise<ContextOperation> {
    return this.dropCollection(collectionId, options);
  }

  async listFilters(
    collectionId: string,
    options: { timeout?: number | null } = {}
  ): Promise<FilterListResponse> {
    const uuid = contextUuid(collectionId, 'collection_id');
    return (await this._project._client._get(`/context/collections/${uuid}/filters`, {
      timeout: options.timeout,
    })) as FilterListResponse;
  }

  list_filters(collectionId: string, options: any = {}): Promise<FilterListResponse> {
    return this.listFilters(collectionId, options);
  }

  async registerFilterColumn(
    collectionId: string,
    key: string,
    column: string,
    options: {
      idempotencyKey?: string | null;
      idempotency_key?: string | null;
      timeout?: number | null;
    } = {}
  ): Promise<ContextOperation> {
    const uuid = contextUuid(collectionId, 'collection_id');
    const payload: FilterColumnRequest = { key, column };
    return this._operationMutation('POST', `/context/collections/${uuid}/filters/columns`, payload, {
      idempotencyKey: options.idempotencyKey ?? options.idempotency_key ?? null,
      timeout: options.timeout,
    });
  }

  register_filter_column(col: string, key: string, column: string, options: any = {}): Promise<ContextOperation> {
    return this.registerFilterColumn(col, key, column, options);
  }

  addFilterColumn(col: string, key: string, column: string, options: any = {}): Promise<ContextOperation> {
    return this.registerFilterColumn(col, key, column, options);
  }

  add_filter_column(col: string, key: string, column: string, options: any = {}): Promise<ContextOperation> {
    return this.registerFilterColumn(col, key, column, options);
  }

  async registerJsonbPath(
    collectionId: string,
    key: string,
    column: string,
    path: string[],
    options: {
      idempotencyKey?: string | null;
      idempotency_key?: string | null;
      timeout?: number | null;
    } = {}
  ): Promise<ContextOperation> {
    const uuid = contextUuid(collectionId, 'collection_id');
    const payload: FilterJsonbPathRequest = { key, column, path };
    return this._operationMutation('POST', `/context/collections/${uuid}/filters/jsonb-paths`, payload, {
      idempotencyKey: options.idempotencyKey ?? options.idempotency_key ?? null,
      timeout: options.timeout,
    });
  }

  register_jsonb_path(col: string, key: string, column: string, path: string[], options: any = {}): Promise<ContextOperation> {
    return this.registerJsonbPath(col, key, column, path, options);
  }

  addJsonbFilterPath(col: string, key: string, column: string, path: string[], options: any = {}): Promise<ContextOperation> {
    return this.registerJsonbPath(col, key, column, path, options);
  }

  add_jsonb_filter_path(col: string, key: string, column: string, path: string[], options: any = {}): Promise<ContextOperation> {
    return this.registerJsonbPath(col, key, column, path, options);
  }

  async getPointStatus(
    collectionId: string,
    options: { timeout?: number | null } = {}
  ): Promise<PointStatusResponse> {
    const uuid = contextUuid(collectionId, 'collection_id');
    return (await this._project._client._get(`/context/collections/${uuid}/points/status`, {
      timeout: options.timeout,
    })) as PointStatusResponse;
  }

  get_point_status(collectionId: string, options: any = {}): Promise<PointStatusResponse> {
    return this.getPointStatus(collectionId, options);
  }

  async scroll(
    collectionId: string,
    options: {
      limit?: number;
      cursor?: string | null;
      timeout?: number | null;
    } = {}
  ): Promise<Page<PointMapping>> {
    const uuid = contextUuid(collectionId, 'collection_id');
    const limit = options.limit ?? 50;
    pageLimit(limit, 'limit');
    await this._validateCapabilityRequest('point_scroll', {}, { timeout: options.timeout });

    const res = (await this._project._client._get(`/context/collections/${uuid}/points`, {
      params: { limit, cursor: options.cursor ?? undefined },
      timeout: options.timeout,
    })) as PointScrollResponse;

    const fetchNext = (nextCursor: string): Promise<Page<PointMapping>> => {
      return this.scroll(uuid, {
        ...options,
        cursor: nextCursor,
      });
    };

    return new Page<PointMapping>({
      results: res.points || [],
      next_cursor: res.next_cursor ?? null,
      has_more: Boolean(res.has_more),
      request_id: res.request_id ?? null,
      metadata: res as any,
      fetchNext,
    });
  }

  scroll_points(collectionId: string, options: any = {}): Promise<Page<PointMapping>> {
    return this.scroll(collectionId, options);
  }

  async upsertPoints(
    collectionId: string,
    sourceKeys: string[],
    options: {
      idempotencyKey?: string | null;
      idempotency_key?: string | null;
      timeout?: number | null;
    } = {}
  ): Promise<PointMutationResponse | ContextOperation> {
    return this._pointMutation(collectionId, sourceKeys, 'upsert', options);
  }

  upsert_points(col: string, keys: string[], options: any = {}): Promise<PointMutationResponse | ContextOperation> {
    return this.upsertPoints(col, keys, options);
  }

  async deletePoints(
    collectionId: string,
    sourceKeys: string[],
    options: {
      idempotencyKey?: string | null;
      idempotency_key?: string | null;
      timeout?: number | null;
    } = {}
  ): Promise<PointMutationResponse | ContextOperation> {
    return this._pointMutation(collectionId, sourceKeys, 'delete', options);
  }

  delete_points(col: string, keys: string[], options: any = {}): Promise<PointMutationResponse | ContextOperation> {
    return this.deletePoints(col, keys, options);
  }

  async bulkUpsertPoints(
    collection: string,
    sourceKeys: string[],
    options: {
      batchSize?: number;
      batch_size?: number;
      timeout?: number | null;
    } = {}
  ): Promise<PointBatchResponse> {
    const payload: BulkPointKeysRequest = {
      collection,
      source_keys: sourceKeys,
      batch_size: options.batchSize ?? options.batch_size ?? 1000,
    };
    return (await this._project._client._post('/context/points/bulk-upsert', payload, {
      timeout: options.timeout,
      retryable: false,
    })) as PointBatchResponse;
  }

  bulk_upsert_points(col: string, keys: string[], options: any = {}): Promise<PointBatchResponse> {
    return this.bulkUpsertPoints(col, keys, options);
  }

  async bulkDeletePoints(
    collection: string,
    sourceKeys: string[],
    options: {
      batchSize?: number;
      batch_size?: number;
      timeout?: number | null;
    } = {}
  ): Promise<PointBatchResponse> {
    const payload: BulkPointKeysRequest = {
      collection,
      source_keys: sourceKeys,
      batch_size: options.batchSize ?? options.batch_size ?? 1000,
    };
    return (await this._project._client._post('/context/points/bulk-delete', payload, {
      timeout: options.timeout,
      retryable: false,
    })) as PointBatchResponse;
  }

  bulk_delete_points(col: string, keys: string[], options: any = {}): Promise<PointBatchResponse> {
    return this.bulkDeletePoints(col, keys, options);
  }

  async backfillPoints(
    collection: string,
    options: {
      batchSize?: number;
      batch_size?: number;
      timeout?: number | null;
    } = {}
  ): Promise<PointBatchResponse> {
    const payload: BackfillPointsRequest = {
      collection,
      batch_size: options.batchSize ?? options.batch_size ?? 1000,
    };
    return (await this._project._client._post('/context/points/backfill', payload, {
      timeout: options.timeout,
      retryable: false,
    })) as PointBatchResponse;
  }

  backfill_points(col: string, options: any = {}): Promise<PointBatchResponse> {
    return this.backfillPoints(col, options);
  }

  async setPayload(
    collection: string,
    sourceKeys: string[],
    payload: Record<string, any>,
    options: { timeout?: number | null } = {}
  ): Promise<PayloadMutationResponse> {
    const body: SetPayloadRequest = {
      collection,
      source_keys: sourceKeys,
      payload,
    };
    return (await this._project._client._request('PUT', '/context/points/payload', {
      json: body,
      timeout: options.timeout,
      retryable: false,
    })) as PayloadMutationResponse;
  }

  set_payload(col: string, keys: string[], payload: any, options: any = {}): Promise<PayloadMutationResponse> {
    return this.setPayload(col, keys, payload, options);
  }

  async deletePayload(
    collection: string,
    sourceKeys: string[],
    payloadKeys: string[],
    options: { timeout?: number | null } = {}
  ): Promise<PayloadMutationResponse> {
    const body: DeletePayloadRequest = {
      collection,
      source_keys: sourceKeys,
      payload_keys: payloadKeys,
    };
    return (await this._project._client._post('/context/points/payload/delete', body, {
      timeout: options.timeout,
      retryable: false,
    })) as PayloadMutationResponse;
  }

  delete_payload(col: string, keys: string[], pkeys: string[], options: any = {}): Promise<PayloadMutationResponse> {
    return this.deletePayload(col, keys, pkeys, options);
  }

  async clearPayload(
    collection: string,
    sourceKeys: string[],
    options: { timeout?: number | null } = {}
  ): Promise<PayloadMutationResponse> {
    const body: ClearPayloadRequest = {
      collection,
      source_keys: sourceKeys,
    };
    return (await this._project._client._post('/context/points/payload/clear', body, {
      timeout: options.timeout,
      retryable: false,
    })) as PayloadMutationResponse;
  }

  clear_payload(col: string, keys: string[], options: any = {}): Promise<PayloadMutationResponse> {
    return this.clearPayload(col, keys, options);
  }

  async reconcilePoints(
    collectionId: string,
    options: {
      idempotencyKey?: string | null;
      idempotency_key?: string | null;
      timeout?: number | null;
    } = {}
  ): Promise<ContextOperation> {
    const uuid = contextUuid(collectionId, 'collection_id');
    return this._operationMutation('POST', `/context/collections/${uuid}/points/reconcile`, {}, {
      idempotencyKey: options.idempotencyKey ?? options.idempotency_key ?? null,
      timeout: options.timeout,
    });
  }

  reconcile_points(col: string, options: any = {}): Promise<ContextOperation> {
    return this.reconcilePoints(col, options);
  }

  async listOperations(options: {
    collectionId?: string | null;
    collection_id?: string | null;
    kind?: ContextOperationKind | string | null;
    status?: ContextOperationStatus | string | null;
    limit?: number;
    cursor?: string | null;
    timeout?: number | null;
  } = {}): Promise<Page<ContextOperation>> {
    const limit = options.limit ?? 50;
    pageLimit(limit, 'limit');
    const colId = options.collectionId ?? options.collection_id;
    const colUuid = colId ? contextUuid(colId, 'collection_id') : undefined;

    const res = (await this._project._client._get('/context/operations', {
      params: {
        collection_id: colUuid,
        kind: options.kind ?? undefined,
        status: options.status ?? undefined,
        limit,
        cursor: options.cursor ?? undefined,
      },
      timeout: options.timeout,
    })) as OperationListResponse;

    const operations = (res.operations || []).map((op) => ({
      ...op,
      request_id: res.request_id,
    }));

    const fetchNext = (nextCursor: string): Promise<Page<ContextOperation>> => {
      return this.listOperations({
        ...options,
        cursor: nextCursor,
      });
    };

    return new Page<ContextOperation>({
      results: operations,
      next_cursor: res.next_cursor ?? null,
      has_more: Boolean(res.has_more),
      request_id: res.request_id ?? null,
      metadata: res as any,
      fetchNext,
    });
  }

  list_operations(options: any = {}): Promise<Page<ContextOperation>> {
    return this.listOperations(options);
  }

  async getOperation(
    operationId: string,
    options: { timeout?: number | null } = {}
  ): Promise<ContextOperation> {
    const uuid = contextUuid(operationId, 'operation_id');
    const res = await this._project._client._get(`/context/operations/${uuid}`, {
      timeout: options.timeout,
    });
    return operationResponse(res, uuid);
  }

  get_operation(operationId: string, options: any = {}): Promise<ContextOperation> {
    return this.getOperation(operationId, options);
  }

  async waitForOperation(
    operationOrId: ContextOperation | string,
    options: { timeout?: number } = {}
  ): Promise<ContextOperation> {
    let initial: ContextOperation | null = null;
    let operationUuid: string;
    if (typeof operationOrId === 'object' && operationOrId !== null && 'id' in operationOrId) {
      initial = operationOrId;
      operationUuid = contextUuid(operationOrId.id, 'operation_id');
    } else {
      operationUuid = contextUuid(String(operationOrId), 'operation_id');
    }

    const fetch = async (deadline: number): Promise<[ContextOperation, string | null]> => {
      const response = await this._project._client._requestResponse(
        'GET',
        `/context/operations/${operationUuid}`,
        { deadline }
      );
      const op = operationResponse(response.payload, operationUuid);
      const retryAfter = response.headers.get('Retry-After');
      return [op, retryAfter];
    };

    return waitForContextOperation(operationUuid, {
      initial,
      fetch,
      timeout: options.timeout ?? 1800.0,
    });
  }

  wait_for_operation(operationOrId: any, options: any = {}): Promise<ContextOperation> {
    return this.waitForOperation(operationOrId, options);
  }

  async cancelOperation(
    operationId: string,
    options: {
      idempotencyKey?: string | null;
      idempotency_key?: string | null;
      timeout?: number | null;
    } = {}
  ): Promise<ContextOperation> {
    const uuid = contextUuid(operationId, 'operation_id');
    return this._operationMutation('POST', `/context/operations/${uuid}/cancel`, {}, {
      idempotencyKey: options.idempotencyKey ?? options.idempotency_key ?? null,
      timeout: options.timeout,
    });
  }

  cancel_operation(opId: string, options: any = {}): Promise<ContextOperation> {
    return this.cancelOperation(opId, options);
  }

  async retryOperation(
    operationId: string,
    options: {
      idempotencyKey?: string | null;
      idempotency_key?: string | null;
      timeout?: number | null;
    } = {}
  ): Promise<ContextOperation> {
    const uuid = contextUuid(operationId, 'operation_id');
    return this._operationMutation('POST', `/context/operations/${uuid}/retry`, {}, {
      idempotencyKey: options.idempotencyKey ?? options.idempotency_key ?? null,
      timeout: options.timeout,
    });
  }

  retry_operation(opId: string, options: any = {}): Promise<ContextOperation> {
    return this.retryOperation(opId, options);
  }

  async count(
    collection: string,
    options: {
      filter?: Record<string, any> | null;
      timeout?: number | null;
    } = {}
  ): Promise<CountResponse> {
    const payload: CountRequest = {
      collection: contextCollection(collection),
      filter: options.filter ?? undefined,
    };
    await this._validateCapabilityRequest('count', payload, { timeout: options.timeout });
    return (await this._project._client._post('/context/count', payload, {
      timeout: options.timeout,
      retryable: true,
    })) as CountResponse;
  }

  async facets(
    collection: string,
    field: string,
    options: {
      filter?: Record<string, any> | null;
      limit?: number;
      timeout?: number | null;
    } = {}
  ): Promise<FacetsResponse> {
    const payload: FacetsRequest = {
      collection: contextCollection(collection),
      field,
      filter: options.filter ?? undefined,
      limit: options.limit ?? 10,
    };
    await this._validateCapabilityRequest('facets', payload, {
      timeout: options.timeout,
      validateLimits: false,
    });
    return (await this._project._client._post('/context/facets', payload, {
      timeout: options.timeout,
      retryable: true,
    })) as FacetsResponse;
  }

  facet(collection: string, field: string, options: any = {}): Promise<FacetsResponse> {
    return this.facets(collection, field, options);
  }

  async search(
    collection: string,
    embedding: number[],
    options: {
      vectorName?: string | null;
      vector_name?: string | null;
      filter?: Record<string, any> | null;
      limit?: number;
      timeout?: number | null;
    } = {}
  ): Promise<RankedResponse> {
    const payload: DenseSearchRequest = {
      collection: contextCollection(collection),
      vector_name: options.vectorName ?? options.vector_name ?? undefined,
      embedding,
      filter: options.filter ?? undefined,
      limit: options.limit ?? 10,
    };
    return this._ranked('/context/search', 'dense_search', payload, options.timeout);
  }

  async rawVectorSearch(
    query: number[],
    pointIds: number[],
    vectors: number[][],
    metric: string,
    options: {
      limit?: number;
      timeout?: number | null;
    } = {}
  ): Promise<RawVectorSearchResponse> {
    const payload: RawVectorSearchRequest = {
      query,
      point_ids: pointIds,
      vectors,
      metric: metric as any,
      limit: options.limit ?? 10,
    };
    return (await this._project._client._post('/context/search/raw', payload, {
      timeout: options.timeout,
      retryable: true,
    })) as RawVectorSearchResponse;
  }

  raw_vector_search(query: number[], pids: number[], vecs: number[][], metric: string, options: any = {}): Promise<RawVectorSearchResponse> {
    return this.rawVectorSearch(query, pids, vecs, metric, options);
  }

  async candidateSearch(
    collection: string,
    embedding: number[],
    candidatePointIds: number[],
    options: {
      vectorName?: string | null;
      vector_name?: string | null;
      filter?: Record<string, any> | null;
      limit?: number;
      timeout?: number | null;
    } = {}
  ): Promise<PgContextScoredResponse> {
    const payload: CandidateSearchRequest = {
      collection,
      embedding,
      candidate_point_ids: candidatePointIds,
      vector_name: options.vectorName ?? options.vector_name ?? undefined,
      filter: options.filter ?? undefined,
      limit: options.limit ?? 10,
    };
    return (await this._project._client._post('/context/search/candidates', payload, {
      timeout: options.timeout,
      retryable: true,
    })) as PgContextScoredResponse;
  }

  candidate_search(col: string, emb: number[], cpids: number[], options: any = {}): Promise<PgContextScoredResponse> {
    return this.candidateSearch(col, emb, cpids, options);
  }

  async recommend(
    collection: string,
    options: {
      positivePointIds?: number[] | null;
      positive_point_ids?: number[] | null;
      negativePointIds?: number[] | null;
      negative_point_ids?: number[] | null;
      positiveVectors?: number[][] | null;
      positive_vectors?: number[][] | null;
      negativeVectors?: number[][] | null;
      negative_vectors?: number[][] | null;
      limit?: number;
      timeout?: number | null;
    } = {}
  ): Promise<PgContextScoredResponse> {
    const payload: RecommendRequest = {
      collection,
      positive_point_ids: options.positivePointIds ?? options.positive_point_ids ?? undefined,
      negative_point_ids: options.negativePointIds ?? options.negative_point_ids ?? [],
      positive_vectors: options.positiveVectors ?? options.positive_vectors ?? undefined,
      negative_vectors: options.negativeVectors ?? options.negative_vectors ?? [],
      limit: options.limit ?? 10,
    };
    return (await this._project._client._post('/context/recommend', payload, {
      timeout: options.timeout,
      retryable: true,
    })) as PgContextScoredResponse;
  }

  async discover(
    collection: string,
    contextPointIds: number[],
    options: {
      limit?: number;
      timeout?: number | null;
    } = {}
  ): Promise<PgContextScoredResponse> {
    const payload: ContextPointDiscoveryRequest = {
      collection,
      context_point_ids: contextPointIds,
      limit: options.limit ?? 10,
    };
    return (await this._project._client._post('/context/search/discover', payload, {
      timeout: options.timeout,
      retryable: true,
    })) as PgContextScoredResponse;
  }

  async explore(
    collection: string,
    contextPointIds: number[],
    options: {
      limit?: number;
      timeout?: number | null;
    } = {}
  ): Promise<PgContextScoredResponse> {
    const payload: ContextPointDiscoveryRequest = {
      collection,
      context_point_ids: contextPointIds,
      limit: options.limit ?? 10,
    };
    return (await this._project._client._post('/context/explore', payload, {
      timeout: options.timeout,
      retryable: true,
    })) as PgContextScoredResponse;
  }

  async groupedSearch(
    collection: string,
    embedding: number[],
    options: {
      vectorName?: string | null;
      vector_name?: string | null;
      groupBy: string;
      group_by?: string;
      groupLimit?: number;
      group_limit?: number;
      limit?: number;
      timeout?: number | null;
    }
  ): Promise<RankedResponse> {
    const payload: GroupedSearchRequest = {
      collection: contextCollection(collection),
      vector_name: options.vectorName ?? options.vector_name ?? undefined,
      embedding,
      group_by: options.groupBy ?? options.group_by ?? '',
      group_limit: options.groupLimit ?? options.group_limit ?? 1,
      limit: options.limit ?? 10,
    };
    return this._ranked('/context/grouped-search', 'grouped_search', payload, options.timeout);
  }

  grouped_search(col: string, emb: number[], options: any): Promise<RankedResponse> {
    return this.groupedSearch(col, emb, options);
  }

  async recallCheck(
    collection: string,
    embedding: number[],
    options: {
      vectorName?: string | null;
      vector_name?: string | null;
      filter?: Record<string, any> | null;
      limit?: number;
      minimumRecall?: number;
      minimum_recall?: number;
      timeout?: number | null;
    } = {}
  ): Promise<RecallCheckResponse> {
    const payload: RecallCheckRequest = {
      collection: contextCollection(collection),
      vector_name: options.vectorName ?? options.vector_name ?? undefined,
      embedding,
      filter: options.filter ?? undefined,
      limit: options.limit ?? 10,
      minimum_recall: options.minimumRecall ?? options.minimum_recall ?? 0.95,
    };
    await this._validateCapabilityRequest('recall_check', payload, { timeout: options.timeout });
    return (await this._project._client._post('/context/recall-check', payload, {
      timeout: options.timeout,
      retryable: false,
    })) as RecallCheckResponse;
  }

  recall_check(col: string, emb: number[], options: any = {}): Promise<RecallCheckResponse> {
    return this.recallCheck(col, emb, options);
  }

  async query(
    collection: string,
    embedding: number[],
    options: {
      vectorName?: string | null;
      vector_name?: string | null;
      query: string;
      limit?: number;
      timeout?: number | null;
    }
  ): Promise<RankedResponse> {
    const payload: TextHybridSearchRequest = {
      collection: contextCollection(collection),
      vector_name: options.vectorName ?? options.vector_name ?? undefined,
      embedding,
      query: contextQuery(options.query),
      limit: options.limit ?? 10,
    };
    return this._ranked('/context/hybrid/text', 'text_hybrid', payload, options.timeout);
  }

  textHybrid(col: string, emb: number[], options: any): Promise<RankedResponse> {
    return this.query(col, emb, options);
  }

  text_hybrid(col: string, emb: number[], options: any): Promise<RankedResponse> {
    return this.query(col, emb, options);
  }

  async graphFirst(
    collection: string,
    embedding: number[],
    options: {
      start: any;
      vectorName?: string | null;
      vector_name?: string | null;
      maxDepth?: number;
      max_depth?: number;
      graphLimit?: number;
      graph_limit?: number;
      relationshipTypes?: string[] | null;
      relationship_types?: string[] | null;
      direction?: string;
      filter?: Record<string, any> | null;
      limit?: number;
      timeout?: number | null;
    }
  ): Promise<RankedResponse> {
    const payload: GraphFirstSearchRequest = {
      collection: contextCollection(collection),
      vector_name: options.vectorName ?? options.vector_name ?? undefined,
      embedding,
      start: options.start,
      max_depth: options.maxDepth ?? options.max_depth ?? 2,
      graph_limit: options.graphLimit ?? options.graph_limit ?? 200,
      relationship_types: options.relationshipTypes ?? options.relationship_types ?? [],
      direction: (options.direction || 'any') as any,
      filter: options.filter ?? undefined,
      limit: options.limit ?? 10,
    };
    return this._ranked('/context/hybrid/graph-first', 'graph_first', payload, options.timeout);
  }

  graph_first(col: string, emb: number[], options: any): Promise<RankedResponse> {
    return this.graphFirst(col, emb, options);
  }

  async vectorFirst(
    collection: string,
    embedding: number[],
    options: {
      vectorName?: string | null;
      vector_name?: string | null;
      contextLimit?: number;
      context_limit?: number;
      maxDepth?: number;
      max_depth?: number;
      graphLimit?: number;
      graph_limit?: number;
      relationshipTypes?: string[] | null;
      relationship_types?: string[] | null;
      direction?: string;
      filter?: Record<string, any> | null;
      limit?: number;
      timeout?: number | null;
    } = {}
  ): Promise<RankedResponse> {
    const payload: VectorFirstSearchRequest = {
      collection: contextCollection(collection),
      vector_name: options.vectorName ?? options.vector_name ?? undefined,
      embedding,
      context_limit: options.contextLimit ?? options.context_limit ?? 50,
      max_depth: options.maxDepth ?? options.max_depth ?? 2,
      graph_limit: options.graphLimit ?? options.graph_limit ?? 200,
      relationship_types: options.relationshipTypes ?? options.relationship_types ?? [],
      direction: (options.direction || 'any') as any,
      filter: options.filter ?? undefined,
      limit: options.limit ?? 10,
    };
    return this._ranked('/context/hybrid/vector-first', 'vector_first', payload, options.timeout);
  }

  vector_first(col: string, emb: number[], options: any = {}): Promise<RankedResponse> {
    return this.vectorFirst(col, emb, options);
  }

  async rankFusion(
    collection: string,
    embedding: number[],
    options: {
      start: any;
      vectorName?: string | null;
      vector_name?: string | null;
      contextLimit?: number;
      context_limit?: number;
      maxDepth?: number;
      max_depth?: number;
      graphLimit?: number;
      graph_limit?: number;
      relationshipTypes?: string[] | null;
      relationship_types?: string[] | null;
      direction?: string;
      contextWeight?: number;
      context_weight?: number;
      graphWeight?: number;
      graph_weight?: number;
      filter?: Record<string, any> | null;
      limit?: number;
      timeout?: number | null;
    }
  ): Promise<RankedResponse> {
    const payload: RankFusionSearchRequest = {
      collection: contextCollection(collection),
      vector_name: options.vectorName ?? options.vector_name ?? undefined,
      embedding,
      start: options.start,
      context_limit: options.contextLimit ?? options.context_limit ?? 50,
      max_depth: options.maxDepth ?? options.max_depth ?? 2,
      graph_limit: options.graphLimit ?? options.graph_limit ?? 200,
      relationship_types: options.relationshipTypes ?? options.relationship_types ?? [],
      direction: (options.direction || 'any') as any,
      weights: {
        context: options.contextWeight ?? options.context_weight ?? 0.7,
        graph: options.graphWeight ?? options.graph_weight ?? 0.3,
      } as any,
      filter: options.filter ?? undefined,
      limit: options.limit ?? 10,
    };
    return this._ranked('/context/hybrid/rank-fusion', 'rank_fusion', payload, options.timeout);
  }

  rank_fusion(col: string, emb: number[], options: any): Promise<RankedResponse> {
    return this.rankFusion(col, emb, options);
  }

  async joint(
    collection: string,
    embedding: number[],
    options: {
      vectorName?: string | null;
      vector_name?: string | null;
      query?: string | null;
      starts?: any[] | null;
      filter?: Record<string, any> | null;
      relationshipTypes?: string[] | null;
      relationship_types?: string[] | null;
      direction?: string;
      maxDepth?: number;
      max_depth?: number;
      contextLimit?: number;
      context_limit?: number;
      seedLimit?: number;
      seed_limit?: number;
      graphLimit?: number;
      graph_limit?: number;
      traversalLimit?: number;
      traversal_limit?: number;
      semanticWeight?: number;
      semantic_weight?: number;
      lexicalWeight?: number;
      lexical_weight?: number;
      graphWeight?: number;
      graph_weight?: number;
      limit?: number;
      timeout?: number | null;
    } = {}
  ): Promise<ContextJointResponse> {
    const payload: JointSearchRequest = {
      collection: contextCollection(collection),
      vector_name: options.vectorName ?? options.vector_name ?? undefined,
      embedding,
      query: options.query ?? undefined,
      starts: options.starts ?? [],
      filter: options.filter ?? undefined,
      relationship_types: options.relationshipTypes ?? options.relationship_types ?? [],
      direction: (options.direction || 'any') as any,
      max_depth: options.maxDepth ?? options.max_depth ?? 2,
      context_limit: options.contextLimit ?? options.context_limit ?? 50,
      seed_limit: options.seedLimit ?? options.seed_limit ?? 8,
      graph_limit: options.graphLimit ?? options.graph_limit ?? 200,
      traversal_limit: options.traversalLimit ?? options.traversal_limit ?? 500,
      weights: {
        semantic: options.semanticWeight ?? options.semantic_weight ?? 0.7,
        lexical: options.lexicalWeight ?? options.lexical_weight ?? 0.0,
        graph: options.graphWeight ?? options.graph_weight ?? 0.3,
      } as any,
      limit: options.limit ?? 10,
    };
    await this._validateCapabilityRequest('joint', payload, { timeout: options.timeout });
    return (await this._project._client._post('/context/hybrid/joint', payload, {
      timeout: options.timeout,
      retryable: false,
    })) as ContextJointResponse;
  }

  async executeQuery(
    collection: string,
    plan: ContextQueryPlan,
    options: { timeout?: number | null } = {}
  ): Promise<QueryExecutionResponse> {
    const payload: QueryExecuteRequest = {
      collection: contextCollection(collection),
      plan,
    };
    return (await this._project._client._post('/context/query/execute', payload, {
      timeout: options.timeout,
      retryable: false,
    })) as QueryExecutionResponse;
  }

  execute_query(col: string, plan: ContextQueryPlan, options: any = {}): Promise<QueryExecutionResponse> {
    return this.executeQuery(col, plan, options);
  }

  async explain(
    collection: string,
    textColumn: string,
    options: { timeout?: number | null } = {}
  ): Promise<QueryExplainResponse> {
    const payload: QueryExplainRequest = {
      collection: contextCollection(collection),
      text_column: textColumn,
    };
    return (await this._project._client._post('/context/query/explain', payload, {
      timeout: options.timeout,
      retryable: false,
    })) as QueryExplainResponse;
  }

  queryNearest(
    vector: number[],
    limit = 10,
    options: {
      vectorName?: string | null;
      vector_name?: string | null;
      filter?: Record<string, any> | null;
    } = {}
  ): ContextQueryPlan {
    const plan: ContextQueryPlan = {
      kind: 'nearest',
      vector,
      limit,
    };
    const vName = options.vectorName ?? options.vector_name;
    if (vName !== undefined && vName !== null) plan.vector_name = vName;
    if (options.filter !== undefined && options.filter !== null) plan.filter = options.filter;
    return plan;
  }

  query_nearest(vector: number[], limit = 10, options: any = {}): ContextQueryPlan {
    return this.queryNearest(vector, limit, options);
  }

  querySparseNearest(
    vectorName: string,
    vector: string,
    limit = 10,
    options: { filter?: Record<string, any> | null } = {}
  ): ContextQueryPlan {
    const plan: ContextQueryPlan = {
      kind: 'sparse_nearest',
      vector_name: vectorName,
      vector,
      limit,
    };
    if (options.filter !== undefined && options.filter !== null) plan.filter = options.filter;
    return plan;
  }

  query_sparse_nearest(vName: string, vec: string, limit = 10, options: any = {}): ContextQueryPlan {
    return this.querySparseNearest(vName, vec, limit, options);
  }

  queryFullText(textQuery: string, textColumn: string, limit = 10): ContextQueryPlan {
    return {
      kind: 'full_text',
      text_query: textQuery,
      text_column: textColumn,
      limit,
    };
  }

  query_full_text(tq: string, tc: string, limit = 10): ContextQueryPlan {
    return this.queryFullText(tq, tc, limit);
  }

  queryLateInteraction(queryVectors: number[][], candidatesPerQuery: number, limit = 10): ContextQueryPlan {
    return {
      kind: 'late_interaction',
      query_vectors: queryVectors,
      candidates_per_query: candidatesPerQuery,
      limit,
    };
  }

  query_late_interaction(qvs: number[][], cpq: number, limit = 10): ContextQueryPlan {
    return this.queryLateInteraction(qvs, cpq, limit);
  }

  queryRecommend(positivePointIds: number[], negativePointIds: number[], limit = 10): ContextQueryPlan {
    return {
      kind: 'recommend',
      positive_point_ids: positivePointIds,
      negative_point_ids: negativePointIds,
      limit,
    };
  }

  query_recommend(pos: number[], neg: number[], limit = 10): ContextQueryPlan {
    return this.queryRecommend(pos, neg, limit);
  }

  queryDiscover(contextPointIds: number[], limit = 10): ContextQueryPlan {
    return {
      kind: 'discover',
      context_point_ids: contextPointIds,
      limit,
    };
  }

  query_discover(cpids: number[], limit = 10): ContextQueryPlan {
    return this.queryDiscover(cpids, limit);
  }

  queryLookup(pointIds: number[]): ContextQueryPlan {
    return {
      kind: 'lookup',
      point_ids: pointIds,
    };
  }

  query_lookup(pids: number[]): ContextQueryPlan {
    return this.queryLookup(pids);
  }

  queryPrefetch(branches: ContextQueryPlan[]): ContextQueryPlan {
    return {
      kind: 'prefetch',
      branches,
    };
  }

  query_prefetch(branches: ContextQueryPlan[]): ContextQueryPlan {
    return this.queryPrefetch(branches);
  }

  queryWeight(branch: ContextQueryPlan, weight: number): ContextQueryPlan {
    return {
      kind: 'weight',
      branch,
      weight,
    };
  }

  query_weight(branch: ContextQueryPlan, weight: number): ContextQueryPlan {
    return this.queryWeight(branch, weight);
  }

  queryScoreThreshold(branch: ContextQueryPlan, minScore?: number | null, maxScore?: number | null): ContextQueryPlan {
    return {
      kind: 'score_threshold',
      branch,
      min_score: minScore ?? undefined,
      max_score: maxScore ?? undefined,
    };
  }

  query_score_threshold(branch: ContextQueryPlan, minScore?: number | null, maxScore?: number | null): ContextQueryPlan {
    return this.queryScoreThreshold(branch, minScore, maxScore);
  }

  queryFormula(branch: ContextQueryPlan, formula: string): ContextQueryPlan {
    return {
      kind: 'formula',
      branch,
      formula,
    };
  }

  query_formula(branch: ContextQueryPlan, formula: string): ContextQueryPlan {
    return this.queryFormula(branch, formula);
  }

  queryRerank(branch: ContextQueryPlan, limit: number): ContextQueryPlan {
    return {
      kind: 'rerank',
      branch,
      limit,
    };
  }

  query_rerank(branch: ContextQueryPlan, limit: number): ContextQueryPlan {
    return this.queryRerank(branch, limit);
  }

  private _collectionPayload(params: {
    name: string;
    source: any;
    vector: any;
    text_column?: string | null;
    result_columns?: string[] | null;
    filter_columns?: string[] | null;
    jsonb_filter_paths?: any[] | null;
    index_kind: string;
    max_search_limit: number;
  }): CollectionCreateRequest {
    return {
      name: params.name,
      source: params.source,
      vector: params.vector,
      text_column: params.text_column ?? undefined,
      result_columns: params.result_columns ?? [],
      filter_columns: params.filter_columns ?? [],
      jsonb_filter_paths: params.jsonb_filter_paths ?? [],
      index_kind: params.index_kind as any,
      max_search_limit: params.max_search_limit,
    };
  }

  private async _pointMutation(
    collectionId: string,
    sourceKeys: string[],
    action: 'upsert' | 'delete',
    options: {
      idempotencyKey?: string | null;
      idempotency_key?: string | null;
      timeout?: number | null;
    }
  ): Promise<PointMutationResponse | ContextOperation> {
    const uuid = contextUuid(collectionId, 'collection_id');
    const payload: PointKeysRequest = { source_keys: sourceKeys };
    const key = contextIdempotencyKey(options.idempotencyKey ?? options.idempotency_key);
    const response = await this._project._client._post(
      `/context/collections/${uuid}/points/${action}`,
      payload,
      {
        headers: { 'Idempotency-Key': key },
        timeout: options.timeout,
        retryable: true,
      }
    );
    if ('operation' in response) {
      return operationResponse(response);
    }
    return response as PointMutationResponse;
  }

  private async _ranked(
    path: string,
    capability: string,
    payload: Record<string, any>,
    timeout?: number | null
  ): Promise<RankedResponse> {
    await this._validateCapabilityRequest(capability, payload, { timeout });
    return (await this._project._client._post(path, payload, {
      timeout,
      retryable: false,
    })) as RankedResponse;
  }

  private async _validateCapabilityRequest(
    capability: string,
    payload: Record<string, any>,
    options: { timeout?: number | null; validateLimits?: boolean }
  ): Promise<void> {
    let capabilities = this._capabilitiesCache;
    const cachedAt = this._capabilitiesCachedAt;
    const expired = cachedAt === null || Date.now() / 1000 - cachedAt >= 60.0;
    if (capabilities === null || expired || !Boolean((capabilities as any)[capability])) {
      capabilities = await this.getCapabilities({ timeout: options.timeout });
    }
    if (!Boolean((capabilities as any)[capability])) {
      const blocker = (capabilities as any)[`${capability}_blocker`];
      const blockerMessage = (capabilities as any)[`${capability}_blocker_message`];
      throw new PolygresValidationError(
        blockerMessage || `Context ${capability.replace(/_/g, ' ')} is unavailable.`,
        {
          code: 'CONTEXT_CAPABILITY_UNAVAILABLE',
          details: { capability, blocker },
        }
      );
    }
    if (options.validateLimits ?? true) {
      validateCapabilityLimits(capabilities, payload);
    }
  }

  private async _operationMutation(
    method: string,
    path: string,
    payload: Record<string, any>,
    options: {
      idempotencyKey?: string | null;
      timeout?: number | null;
    }
  ): Promise<ContextOperation> {
    const key = contextIdempotencyKey(options.idempotencyKey);
    const response = await this._project._client._request(method, path, {
      json: payload,
      headers: { 'Idempotency-Key': key },
      timeout: options.timeout,
      retryable: true,
    });
    return operationResponse(response);
  }
}

function operationResponse(payload: Record<string, any>, expectedId?: string): ContextOperation {
  const envelope = payload as OperationEnvelope;
  const operation = {
    ...envelope.operation,
    request_id: envelope.request_id,
  };
  if (expectedId !== undefined && String(operation.id) !== expectedId) {
    throw new PolygresRuntimeError('Polygres returned a different Context operation.', {
      statusCode: null,
      requestId: envelope.request_id,
      code: 'CONTEXT_OPERATION_RESPONSE_INVALID',
      details: { operation_id: expectedId },
    });
  }
  return operation;
}

function pageLimit(value: number, field: string): void {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1 || value > 100) {
    throw new PolygresValidationError(`${field} must be an integer from 1 through 100.`, {
      code: 'CONTEXT_REQUEST_INVALID',
      details: { field, rule: 'range_1_100' },
    });
  }
}

function validateCapabilityLimits(capabilities: CapabilitiesResponse, payload: Record<string, any>): void {
  const limitFields: Array<[string, keyof CapabilitiesResponse]> = [
    ['limit', 'max_search_limit'],
    ['context_limit', 'max_context_limit'],
    ['graph_limit', 'max_graph_limit'],
    ['seed_limit', 'max_joint_seed_limit'],
    ['traversal_limit', 'max_joint_traversal_limit'],
    ['max_depth', 'max_graph_depth'],
  ];

  for (const [fieldName, capField] of limitFields) {
    const val = payload[fieldName];
    if (val === undefined || val === null) continue;
    const max = Number(capabilities[capField]);
    if (Number(val) > max) {
      throw new PolygresValidationError(`${fieldName} must be ${max} or less for this project`, {
        code: 'CONTEXT_LIMIT_EXCEEDED',
        details: { field: fieldName, limit: max },
      });
    }
  }

  const embedding = payload['embedding'];
  if (Array.isArray(embedding) && embedding.length > capabilities.max_dimensions) {
    throw new PolygresValidationError(
      `embedding must contain at most ${capabilities.max_dimensions} dimensions`,
      {
        code: 'CONTEXT_LIMIT_EXCEEDED',
        details: { field: 'embedding', limit: capabilities.max_dimensions },
      }
    );
  }

  const relationshipTypes = payload['relationship_types'];
  if (Array.isArray(relationshipTypes) && relationshipTypes.length > capabilities.max_relationship_types) {
    throw new PolygresValidationError("relationship_types exceeds this project's capability limit", {
      code: 'CONTEXT_LIMIT_EXCEEDED',
      details: { field: 'relationship_types', limit: capabilities.max_relationship_types },
    });
  }
}
