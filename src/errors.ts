import { ERROR_CATALOG } from './errors-catalog';

export interface PolygresErrorOptions {
  statusCode?: number | null;
  status_code?: number | null;
  requestId?: string | null;
  request_id?: string | null;
  code?: string | null;
  details?: Record<string, any> | null;
}

export class PolygresError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PolygresError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class PolygresValidationError extends PolygresError {
  readonly statusCode: number | null;
  readonly status_code: number | null;
  readonly requestId: string | null;
  readonly request_id: string | null;
  readonly code: string | null;
  readonly details: Record<string, any>;

  constructor(message: string, options: PolygresErrorOptions = {}) {
    super(message);
    this.name = 'PolygresValidationError';
    const status = options.statusCode !== undefined ? options.statusCode : options.status_code ?? null;
    const reqId = options.requestId !== undefined ? options.requestId : options.request_id ?? null;
    this.statusCode = status;
    this.status_code = status;
    this.requestId = reqId;
    this.request_id = reqId;
    this.code = options.code ?? null;
    this.details = options.details ? { ...options.details } : {};
    Object.setPrototypeOf(this, PolygresValidationError.prototype);
  }
}

export class PolygresAPIError extends PolygresError {
  readonly statusCode: number | null;
  readonly status_code: number | null;
  readonly requestId: string | null;
  readonly request_id: string | null;
  readonly code: string | null;
  readonly details: Record<string, any>;

  constructor(message: string, options: PolygresErrorOptions = {}) {
    super(message);
    this.name = 'PolygresAPIError';
    const status = options.statusCode !== undefined ? options.statusCode : options.status_code ?? null;
    const reqId = options.requestId !== undefined ? options.requestId : options.request_id ?? null;
    this.statusCode = status;
    this.status_code = status;
    this.requestId = reqId;
    this.request_id = reqId;
    this.code = options.code ?? null;
    this.details = options.details ? { ...options.details } : {};
    Object.setPrototypeOf(this, PolygresAPIError.prototype);
  }
}

export class PolygresAuthError extends PolygresAPIError {
  constructor(message: string, options: PolygresErrorOptions = {}) {
    super(message, options);
    this.name = 'PolygresAuthError';
    Object.setPrototypeOf(this, PolygresAuthError.prototype);
  }
}

export class PolygresPermissionError extends PolygresAPIError {
  constructor(message: string, options: PolygresErrorOptions = {}) {
    super(message, options);
    this.name = 'PolygresPermissionError';
    Object.setPrototypeOf(this, PolygresPermissionError.prototype);
  }
}

export class PolygresNotFoundError extends PolygresAPIError {
  constructor(message: string, options: PolygresErrorOptions = {}) {
    super(message, options);
    this.name = 'PolygresNotFoundError';
    Object.setPrototypeOf(this, PolygresNotFoundError.prototype);
  }
}

export class PolygresRateLimitError extends PolygresAPIError {
  constructor(message: string, options: PolygresErrorOptions = {}) {
    super(message, options);
    this.name = 'PolygresRateLimitError';
    Object.setPrototypeOf(this, PolygresRateLimitError.prototype);
  }
}

export class PolygresMaintenanceError extends PolygresAPIError {
  constructor(message: string, options: PolygresErrorOptions = {}) {
    super(message, options);
    this.name = 'PolygresMaintenanceError';
    Object.setPrototypeOf(this, PolygresMaintenanceError.prototype);
  }
}

export class PolygresRuntimeError extends PolygresAPIError {
  constructor(message: string, options: PolygresErrorOptions = {}) {
    super(message, options);
    this.name = 'PolygresRuntimeError';
    Object.setPrototypeOf(this, PolygresRuntimeError.prototype);
  }
}

export class PolygresAmbiguousWriteError extends PolygresRuntimeError {
  constructor(message: string, options: PolygresErrorOptions = {}) {
    super(message, options);
    this.name = 'PolygresAmbiguousWriteError';
    Object.setPrototypeOf(this, PolygresAmbiguousWriteError.prototype);
  }
}

export function redactText(value: string, secret?: string | null): string {
  let redacted = secret ? value.split(secret).join('[REDACTED]') : value;
  return redacted.replace(/poly_live_[0-9a-fA-F]{32}/g, '[REDACTED]');
}

export function redactValue(value: any, secret?: string | null): any {
  if (typeof value === 'string') {
    return redactText(value, secret);
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactValue(item, secret));
  }
  if (value !== null && typeof value === 'object') {
    const result: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = redactValue(v, secret);
    }
    return result;
  }
  return value;
}

export function syncedProjectSurfaceUnavailableError(): PolygresPermissionError {
  const descriptor = ERROR_CATALOG['SYNCED_PROJECT_SURFACE_UNAVAILABLE'];
  return new PolygresPermissionError(descriptor.message, {
    statusCode: descriptor.http_status,
    code: 'SYNCED_PROJECT_SURFACE_UNAVAILABLE',
    details: {},
  });
}

export const synced_project_surface_unavailable_error = syncedProjectSurfaceUnavailableError;

export interface CanonicalErrorDetails {
  code: string;
  message: string;
  statusCode: number | null;
  status_code: number | null;
  details: Record<string, any>;
}

export function canonicalErrorDetails(
  code: unknown,
  variant: unknown,
  details: Record<string, any> = {}
): CanonicalErrorDetails | null {
  if (typeof code !== 'string') {
    return null;
  }
  const descriptor = ERROR_CATALOG[code];
  if (!descriptor) {
    return null;
  }
  const selectedVariant =
    typeof variant === 'string' && descriptor.variants
      ? descriptor.variants[variant]
      : undefined;
  const message = selectedVariant?.message ?? descriptor.message;
  const statusCode = selectedVariant?.http_status ?? descriptor.http_status;
  const safeFields = new Set(descriptor.safe_detail_fields);
  const safeDetails: Record<string, any> = {};
  for (const [key, val] of Object.entries(details)) {
    if (safeFields.has(key)) {
      safeDetails[key] = val;
    }
  }
  return {
    code,
    message,
    statusCode,
    status_code: statusCode,
    details: safeDetails,
  };
}

export const canonical_error_details = canonicalErrorDetails;

export { ERROR_CATALOG };
