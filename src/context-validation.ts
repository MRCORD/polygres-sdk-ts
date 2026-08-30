import { PolygresValidationError } from './errors';

const IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CANONICAL_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PRINTABLE_ASCII_RE = /^[\x20-\x7E]+$/;

export interface ContextViolation {
  field: string;
  rule: string;
  context?: Record<string, any>;
}

export function validateIdentifier(value: string, field = 'identifier'): ContextViolation[] {
  const violations: ContextViolation[] = [];
  if (typeof value !== 'string' || !IDENTIFIER_RE.test(value)) {
    violations.push({ field, rule: 'ascii_sql_identifier', context: {} });
  } else if (new TextEncoder().encode(value).length > 63) {
    violations.push({ field, rule: 'max_utf8_bytes', context: { limit: 63 } });
  }
  return violations;
}

export function validateUuid(value: string, field: string): ContextViolation[] {
  if (typeof value !== 'string' || !UUID_RE.test(value)) {
    return [{ field, rule: 'uuid', context: {} }];
  }
  if (!CANONICAL_UUID_RE.test(value)) {
    return [{ field, rule: 'canonical_uuid', context: {} }];
  }
  return [];
}

export function validateIdempotencyKey(value: string, field = 'idempotency_key'): ContextViolation[] {
  if (
    typeof value !== 'string' ||
    value.length < 1 ||
    value.length > 128 ||
    !PRINTABLE_ASCII_RE.test(value)
  ) {
    return [{ field, rule: 'printable_ascii_1_128', context: {} }];
  }
  return [];
}

export function contextIdentifier(value: string, field = 'identifier'): string {
  const violations = validateIdentifier(value, field);
  if (violations.length > 0) {
    const violation = violations[0];
    const fieldDisplayName = field.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
    throw new PolygresValidationError(`${fieldDisplayName} must be a valid identifier.`, {
      code: 'CONTEXT_REQUEST_INVALID',
      details: { field: violation.field, rule: violation.rule },
    });
  }
  return value;
}

export function contextUuid(value: string, field: string): string {
  const normalized = String(value);
  const violations = validateUuid(normalized, field);
  if (violations.length > 0) {
    const violation = violations[0];
    const fieldDisplayName = field.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
    throw new PolygresValidationError(`${fieldDisplayName} must be a canonical UUID.`, {
      code: 'CONTEXT_REQUEST_INVALID',
      details: { field: violation.field, rule: violation.rule },
    });
  }
  return normalized;
}

export function contextCollection(value: string): string {
  if (typeof value !== 'string' || !value) {
    throw new PolygresValidationError(
      'Collection must be a UUID or exact Context collection name.',
      {
        code: 'CONTEXT_REQUEST_INVALID',
        details: { field: 'collection', rule: 'uuid_or_identifier' },
      }
    );
  }
  // Check if it looks like UUID
  if (UUID_RE.test(value)) {
    const uuidViolations = validateUuid(value, 'collection');
    if (uuidViolations.length === 0) {
      return value;
    }
  }
  // Try as identifier
  const idViolations = validateIdentifier(value, 'collection');
  if (idViolations.length > 0) {
    const violation = idViolations[0];
    throw new PolygresValidationError(
      'Collection must be a UUID or exact Context collection name.',
      {
        code: 'CONTEXT_REQUEST_INVALID',
        details: { field: violation.field, rule: violation.rule },
      }
    );
  }
  return value;
}

export function contextIdempotencyKey(value?: string | null): string {
  let key: string;
  if (value !== undefined && value !== null) {
    key = value;
  } else {
    key = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);
  }
  const violations = validateIdempotencyKey(key);
  if (violations.length > 0) {
    const violation = violations[0];
    throw new PolygresValidationError(
      'Idempotency key must be 1 to 128 printable ASCII characters.',
      {
        code: 'CONTEXT_REQUEST_INVALID',
        details: { field: violation.field, rule: violation.rule },
      }
    );
  }
  return key;
}

export function contextQuery(value: string, field = 'query'): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new PolygresValidationError('Query must contain non-whitespace text.', {
      code: 'CONTEXT_REQUEST_INVALID',
      details: { field, rule: 'non_blank' },
    });
  }
  return value;
}
