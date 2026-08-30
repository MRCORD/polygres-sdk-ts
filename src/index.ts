export { VERSION, VERSION as __version__, DEFAULT_API_VERSION, API_VERSION_HEADER, CLIENT_INFO_HEADER } from './version';
export { Polygres, Project, GraphNamespace, VectorNamespace, TextNamespace, HybridNamespace, RETRY_STATUSES, parseApiError } from './client';
export type { PolygresOptions, ProjectMode, TransportResponse } from './client';
export {
  Page,
  ConnectionInfo,
  RetrievalReadiness,
  GraphNode,
  GraphPathStep,
  GraphResult,
  VectorResult,
  TextResult,
  HybridResult,
  GraphPathResponse,
  GraphConnectionResponse,
  RowWriteResult,
  RowWriteValidation,
  RowContextReconciliationResult,
} from './models';
export {
  PolygresError,
  PolygresValidationError,
  PolygresAPIError,
  PolygresAuthError,
  PolygresPermissionError,
  PolygresNotFoundError,
  PolygresRateLimitError,
  PolygresMaintenanceError,
  PolygresRuntimeError,
  PolygresAmbiguousWriteError,
  syncedProjectSurfaceUnavailableError,
  synced_project_surface_unavailable_error,
  canonicalErrorDetails,
  canonical_error_details,
  redactText,
  redactValue,
  ERROR_CATALOG,
} from './errors';
export type { PolygresErrorOptions, CanonicalErrorDetails } from './errors';
export { RowsNamespace, isContextErrorRetryable } from './rows';
export type {
  RowWriteBaseOptions,
  RowValidateOptions,
  RowInsertOptions,
  RowUpsertOptions,
  RowIgnoreOptions,
} from './rows';
export { ContextNamespace } from './context';
export * from './context-models';
export {
  validateIdentifier,
  validateUuid,
  validateIdempotencyKey,
  contextIdentifier,
  contextUuid,
  contextCollection,
  contextIdempotencyKey,
  contextQuery,
} from './context-validation';
export type { ContextViolation } from './context-validation';
export {
  waitForContextOperation,
  contextPollInterval,
  parseRetryAfterSeconds,
} from './context-wait';
export type { OperationFetcher } from './context-wait';
export {
  parseVersionNotice,
  emitVersionNotice,
  checkCentralVersionNotices,
  compareSemver,
} from './version-notices';
export type { PolygresVersionNotice } from './version-notices';

export { Polygres as default } from './client';
