import { ERROR_CATALOG } from './errors-catalog';
import {
  PolygresAmbiguousWriteError,
  PolygresAPIError,
  PolygresError,
  PolygresValidationError,
} from './errors';
import { RowWriteResult, RowWriteValidation } from './models';

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export interface RowWriteBaseOptions {
  schema: string;
  table: string;
  row: Record<string, any>;
  returning?: string[] | null;
  reconcileContext?: boolean;
  reconcile_context?: boolean;
  contextCollectionId?: string | null;
  context_collection_id?: string | null;
  idempotencyKey?: string | null;
  idempotency_key?: string | null;
  waitForContext?: boolean;
  wait_for_context?: boolean;
  waitTimeout?: number;
  wait_timeout?: number;
  timeout?: number | null;
}

export interface RowValidateOptions {
  schema: string;
  table: string;
  row: Record<string, any>;
  mode?: 'insert' | 'upsert' | 'ignore';
  conflictColumns?: string[] | null;
  conflict_columns?: string[] | null;
  updateColumns?: string[] | null;
  update_columns?: string[] | null;
  returning?: string[] | null;
  reconcileContext?: boolean;
  reconcile_context?: boolean;
  contextCollectionId?: string | null;
  context_collection_id?: string | null;
  timeout?: number | null;
}

export interface RowInsertOptions extends RowWriteBaseOptions {}

export interface RowUpsertOptions extends RowWriteBaseOptions {
  conflictColumns?: string[];
  conflict_columns?: string[];
  updateColumns?: string[] | null;
  update_columns?: string[] | null;
}

export interface RowIgnoreOptions extends RowWriteBaseOptions {
  conflictColumns?: string[];
  conflict_columns?: string[];
}

export class RowsNamespace {
  private readonly _project: any;

  constructor(project: any) {
    this._project = project;
  }

  async validate(options: RowValidateOptions): Promise<RowWriteValidation> {
    const conflictCols = options.conflictColumns ?? options.conflict_columns ?? null;
    const updateCols = options.updateColumns ?? options.update_columns ?? null;
    const reconcileCtx = Boolean(options.reconcileContext ?? options.reconcile_context);
    const contextColId = options.contextCollectionId ?? options.context_collection_id ?? null;

    const [payload] = buildPayload({
      schema: options.schema,
      table: options.table,
      row: options.row,
      mode: options.mode || 'insert',
      conflict_columns: conflictCols,
      update_columns: updateCols,
      returning: options.returning ?? null,
      reconcile_context: reconcileCtx,
      context_collection_id: contextColId,
      idempotency_key: null,
      execution: false,
    });

    const response = await this._project._client._post(
      rowPath(options.schema, options.table, true),
      payload,
      {
        timeout: options.timeout,
        retryable: true,
      }
    );
    return RowWriteValidation.fromApi(response);
  }

  async insert(options: RowInsertOptions): Promise<RowWriteResult> {
    const conflictCols = (options as any).conflictColumns ?? (options as any).conflict_columns ?? null;
    const updateCols = (options as any).updateColumns ?? (options as any).update_columns ?? null;
    return this._write({
      ...options,
      mode: 'insert',
      conflict_columns: conflictCols,
      update_columns: updateCols,
    });
  }

  async upsert(options: RowUpsertOptions): Promise<RowWriteResult> {
    const conflictCols = options.conflictColumns ?? options.conflict_columns ?? null;
    const updateCols = options.updateColumns ?? options.update_columns ?? null;
    return this._write({
      ...options,
      mode: 'upsert',
      conflict_columns: conflictCols,
      update_columns: updateCols,
    });
  }

  async ignore(options: RowIgnoreOptions): Promise<RowWriteResult> {
    const conflictCols = options.conflictColumns ?? options.conflict_columns ?? null;
    const updateCols = (options as any).updateColumns ?? (options as any).update_columns ?? null;
    return this._write({
      ...options,
      mode: 'ignore',
      conflict_columns: conflictCols,
      update_columns: updateCols,
    });
  }

  private async _write(params: {
    schema: string;
    table: string;
    row: Record<string, any>;
    mode: 'insert' | 'upsert' | 'ignore';
    conflict_columns?: string[] | null;
    update_columns?: string[] | null;
    returning?: string[] | null;
    reconcileContext?: boolean;
    reconcile_context?: boolean;
    contextCollectionId?: string | null;
    context_collection_id?: string | null;
    idempotencyKey?: string | null;
    idempotency_key?: string | null;
    waitForContext?: boolean;
    wait_for_context?: boolean;
    waitTimeout?: number;
    wait_timeout?: number;
    timeout?: number | null;
  }): Promise<RowWriteResult> {
    const waitForCtx = Boolean(params.waitForContext ?? params.wait_for_context);
    const waitTimeoutVal = params.waitTimeout ?? params.wait_timeout ?? 300.0;
    if (waitForCtx) {
      if (
        typeof waitTimeoutVal !== 'number' ||
        waitTimeoutVal <= 0 ||
        !Number.isFinite(waitTimeoutVal)
      ) {
        throw new PolygresValidationError('wait_timeout must be a positive finite number');
      }
    }

    const reconcileCtx = Boolean(params.reconcileContext ?? params.reconcile_context);
    const contextColId = params.contextCollectionId ?? params.context_collection_id ?? null;
    const idemKey = params.idempotencyKey ?? params.idempotency_key ?? null;

    const [payload, key] = buildPayload({
      schema: params.schema,
      table: params.table,
      row: params.row,
      mode: params.mode,
      conflict_columns: params.conflict_columns ?? null,
      update_columns: params.update_columns ?? null,
      returning: params.returning ?? null,
      reconcile_context: reconcileCtx,
      context_collection_id: contextColId,
      idempotency_key: idemKey,
      execution: true,
    });

    const headers: Record<string, string> = {};
    if (key !== null) {
      headers['Idempotency-Key'] = key;
    }

    let response: Record<string, any>;
    try {
      response = await this._project._client._post(
        rowPath(params.schema, params.table, false),
        payload,
        {
          headers,
          timeout: params.timeout,
          retryable: false,
        }
      );
    } catch (exc: any) {
      if (exc instanceof PolygresAPIError) {
        if (exc.code && exc.code in ERROR_CATALOG && exc.code !== 'ROW_WRITE_OUTCOME_AMBIGUOUS') {
          throw exc;
        }
        if (
          exc.code === 'ROW_WRITE_OUTCOME_AMBIGUOUS' ||
          exc.statusCode === null ||
          [408, 500, 502, 503, 504].includes(exc.statusCode)
        ) {
          throw new PolygresAmbiguousWriteError(exc.message, {
            statusCode: exc.statusCode,
            requestId: exc.requestId,
            code: exc.code || 'ROW_WRITE_OUTCOME_AMBIGUOUS',
            details: exc.details,
          });
        }
      }
      throw exc;
    }

    const result = RowWriteResult.fromApi(response);
    if (!waitForCtx || result.status !== 'pending' || !result.context) {
      return result;
    }

    try {
      await this._project.context.waitForOperation(result.context.operation_id, {
        timeout: waitTimeoutVal,
      });
    } catch (exc: any) {
      if (exc instanceof PolygresError) {
        const code = (exc as any).code;
        const details = (exc as any).details || {};
        if (code === 'TIMEOUT' || code === 'CONTEXT_OPERATION_TIMEOUT') {
          return result;
        }
        const opStatus = details.operation_status;
        if (opStatus !== 'failed' && opStatus !== 'cancelled') {
          if (!details.operation_id) details.operation_id = result.context.operation_id;
          if (!details.idempotency_key) details.idempotency_key = key;
          if (!details.row_request_id) details.row_request_id = result.request_id;
          throw exc;
        }

        result.status = 'partial_failed';
        result.context.status = 'partial_failed';
        result.context.operation_status = String(opStatus);
        result.context.error = {
          code: 'ROW_CONTEXT_RECONCILIATION_FAILED',
          message: 'The row committed, but Context reconciliation failed.',
          retryable: isContextErrorRetryable(code),
          details: {
            operation_id: result.context.operation_id,
            underlying_code: code || 'CONTEXT_OPERATION_FAILED',
          },
        };
        return result;
      }
      throw exc;
    }

    const replay = await this._project._client._post(
      rowPath(params.schema, params.table, false),
      payload,
      {
        headers,
        timeout: params.timeout,
        retryable: false,
      }
    );
    return RowWriteResult.fromApi(replay);
  }
}

export function isContextErrorRetryable(code: string | null): boolean {
  const descriptor = ERROR_CATALOG[code || 'CONTEXT_OPERATION_FAILED'];
  return (
    descriptor !== undefined &&
    ['after_delay', 'bounded_retry', 'user_retry'].includes(descriptor.retry_class)
  );
}

function rowPath(schema: string, table: string, validate = false): string {
  const suffix = validate ? '/validate' : '';
  return `/tables/${encodeURIComponent(schema)}/${encodeURIComponent(table)}/rows${suffix}`;
}

function validateIdentifier(value: string, field: string): void {
  if (
    typeof value !== 'string' ||
    !IDENTIFIER_RE.test(value) ||
    new TextEncoder().encode(value).length > 63
  ) {
    throw new PolygresValidationError(
      `${field} must match ^[A-Za-z_][A-Za-z0-9_]*$ and be at most 63 bytes`
    );
  }
}

function validateColumnList(
  value: string[] | null | undefined,
  field: string,
  allowNone = false
): string[] {
  if (value === null || value === undefined) {
    return [];
  }
  if (!Array.isArray(value) || (allowNone && value.length === 0)) {
    throw new PolygresValidationError(`${field} must be a non-empty list when supplied`);
  }
  for (const item of value) {
    validateIdentifier(item, field);
  }
  if (new Set(value).size !== value.length) {
    throw new PolygresValidationError(`${field} must not contain duplicates`);
  }
  return [...value];
}

function validateJsonNative(value: any, field: string): void {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return;
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new PolygresValidationError(`${field} numbers must be finite`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, idx) => validateJsonNative(item, `${field}.${idx}`));
    return;
  }
  if (value instanceof Date) {
    throw new PolygresValidationError(`${field} must use JSON-native strings or numbers`);
  }
  if (typeof value === 'object' && value !== null) {
    // Check if it looks like a UUID object or Decimal or unsupported class instance
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new PolygresValidationError(`${field} must use JSON-native strings or numbers`);
    }
    for (const [k, v] of Object.entries(value)) {
      if (typeof k !== 'string') {
        throw new PolygresValidationError(`${field} object keys must be strings`);
      }
      validateJsonNative(v, `${field}.${k}`);
    }
    return;
  }
  throw new PolygresValidationError(`${field} contains a non-JSON value`);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function buildPayload(params: {
  schema: string;
  table: string;
  row: Record<string, any>;
  mode: 'insert' | 'upsert' | 'ignore';
  conflict_columns: string[] | null;
  update_columns: string[] | null;
  returning: string[] | null;
  reconcile_context: boolean;
  context_collection_id: string | null;
  idempotency_key: string | null;
  execution: boolean;
}): [Record<string, any>, string | null] {
  validateIdentifier(params.schema, 'schema');
  validateIdentifier(params.table, 'table');
  if (!['insert', 'upsert', 'ignore'].includes(params.mode)) {
    throw new PolygresValidationError('mode must be insert, upsert, or ignore');
  }
  if (!params.row || typeof params.row !== 'object' || Array.isArray(params.row) || Object.keys(params.row).length === 0) {
    throw new PolygresValidationError('row must be a non-empty object');
  }
  validateJsonNative(params.row, 'row');
  for (const col of Object.keys(params.row)) {
    validateIdentifier(col, 'row column');
  }

  const conflict = validateColumnList(params.conflict_columns, 'conflict_columns');
  const updates = params.update_columns !== null ? validateColumnList(params.update_columns, 'update_columns', true) : null;
  const returned = validateColumnList(params.returning || [], 'returning');

  if (params.mode === 'insert' && (conflict.length > 0 || params.update_columns !== null)) {
    throw new PolygresValidationError('insert does not accept conflict or update columns');
  }
  if (['upsert', 'ignore'].includes(params.mode) && conflict.length === 0) {
    throw new PolygresValidationError(`${params.mode} requires conflict_columns`);
  }
  if (params.mode === 'ignore' && params.update_columns !== null) {
    throw new PolygresValidationError('ignore does not accept update_columns');
  }

  const contextRequested = params.reconcile_context || params.context_collection_id !== null;
  if (contextRequested && params.execution && !params.idempotency_key) {
    throw new PolygresValidationError('Context-backed row writes require idempotency_key');
  }
  if (!contextRequested && params.idempotency_key !== null) {
    throw new PolygresValidationError('idempotency_key requires Context reconciliation');
  }
  if (params.idempotency_key !== null) {
    const key = params.idempotency_key;
    const isPrintableAscii = /^[\x20-\x7E]+$/.test(key);
    if (key.length === 0 || key.length > 128 || !isPrintableAscii) {
      throw new PolygresValidationError('idempotency_key must be 1-128 printable ASCII characters');
    }
  }

  const payload: Record<string, any> = {
    mode: params.mode,
    row: params.row,
    returning: returned,
  };
  if (params.conflict_columns !== null) {
    payload.conflict_columns = conflict;
  }
  if (params.update_columns !== null) {
    payload.update_columns = updates;
  }
  if (contextRequested) {
    const context: Record<string, any> = { reconcile: true };
    if (params.context_collection_id !== null) {
      const colIdStr = String(params.context_collection_id);
      if (!UUID_RE.test(colIdStr)) {
        throw new PolygresValidationError('context_collection_id must be a UUID');
      }
      context.collection_id = colIdStr.toLowerCase();
    }
    payload.context = context;
  }

  return [payload, params.idempotency_key];
}
