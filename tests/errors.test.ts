import { describe, it, expect } from 'vitest';
import {
  PolygresError,
  PolygresAPIError,
  PolygresAuthError,
  PolygresPermissionError,
  PolygresNotFoundError,
  PolygresRateLimitError,
  PolygresMaintenanceError,
  PolygresRuntimeError,
  PolygresAmbiguousWriteError,
  PolygresValidationError,
  canonicalErrorDetails,
  redactText,
  redactValue,
  parseApiError,
  syncedProjectSurfaceUnavailableError,
} from '../src';

describe('Error classes hierarchy and mapping', () => {
  it('preserves error inheritance hierarchy', () => {
    const err = new PolygresAuthError('Auth failed');
    expect(err).toBeInstanceOf(PolygresError);
    expect(err).toBeInstanceOf(PolygresAPIError);
    expect(err).toBeInstanceOf(PolygresAuthError);
    expect(err.name).toBe('PolygresAuthError');
  });

  it('maps HTTP status codes to specific error classes', async () => {
    const makeRes = (status: number, body: any = {}) =>
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });

    expect(await parseApiError(makeRes(401))).toBeInstanceOf(PolygresAuthError);
    expect(await parseApiError(makeRes(403))).toBeInstanceOf(PolygresPermissionError);
    expect(await parseApiError(makeRes(404))).toBeInstanceOf(PolygresNotFoundError);
    expect(await parseApiError(makeRes(429))).toBeInstanceOf(PolygresRateLimitError);
    expect(await parseApiError(makeRes(500))).toBeInstanceOf(PolygresRuntimeError);
    expect(await parseApiError(makeRes(502))).toBeInstanceOf(PolygresRuntimeError);
    expect(await parseApiError(makeRes(503))).toBeInstanceOf(PolygresRuntimeError);
    expect(await parseApiError(makeRes(504))).toBeInstanceOf(PolygresRuntimeError);
    expect(await parseApiError(makeRes(408))).toBeInstanceOf(PolygresRuntimeError);
  });

  it('maps specific codes to special error types', async () => {
    const makeRes = (status: number, code: string, details: any = {}) =>
      new Response(
        JSON.stringify({
          error: { code, message: 'Custom message', details },
        }),
        { status, headers: { 'Content-Type': 'application/json' } }
      );

    // Maintenance
    const maint1 = await parseApiError(makeRes(503, 'MAINTENANCE_READ_ONLY'));
    expect(maint1).toBeInstanceOf(PolygresMaintenanceError);
    const maint2 = await parseApiError(makeRes(503, 'MAINTENANCE_FULL'));
    expect(maint2).toBeInstanceOf(PolygresMaintenanceError);

    // Ambiguous write
    const amb = await parseApiError(makeRes(500, 'ROW_WRITE_OUTCOME_AMBIGUOUS'));
    expect(amb).toBeInstanceOf(PolygresAmbiguousWriteError);

    // Vector creation retired (HTTP 410 maps to validation error)
    const retired = await parseApiError(makeRes(410, 'VECTOR_CREATION_RETIRED'));
    expect(retired).toBeInstanceOf(PolygresValidationError);

    // Unsupported API version
    const apiVer = await parseApiError(makeRes(400, 'UNSUPPORTED_API_VERSION'));
    expect(apiVer).toBeInstanceOf(PolygresValidationError);

    // Context error codes (400 + CONTEXT_*)
    const ctxErr = await parseApiError(makeRes(400, 'CONTEXT_REQUEST_INVALID'));
    expect(ctxErr).toBeInstanceOf(PolygresValidationError);

    // Row error codes (400, 413, 422 + ROW_*)
    const rowErr = await parseApiError(makeRes(422, 'ROW_CONFLICT_NOT_FOUND'));
    expect(rowErr).toBeInstanceOf(PolygresValidationError);
  });

  it('resolves canonical error details and filters safe fields', () => {
    const canonical = canonicalErrorDetails('SYNCED_PROJECT_SURFACE_UNAVAILABLE', null, {
      unsafe_field: 'secret',
    });
    expect(canonical).not.toBeNull();
    expect(canonical?.message).toBe('This operation is unavailable for a synchronized project.');
    expect(canonical?.statusCode).toBe(403);
    expect(canonical?.details).toEqual({});
  });

  it('syncedProjectSurfaceUnavailableError produces exact catalog-owned error', () => {
    const err = syncedProjectSurfaceUnavailableError();
    expect(err).toBeInstanceOf(PolygresPermissionError);
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe('SYNCED_PROJECT_SURFACE_UNAVAILABLE');
    expect(err.message).toBe('This operation is unavailable for a synchronized project.');
  });

  it('redacts secrets from messages, details, and request ids', () => {
    const secretKey = 'poly_live_0123456789abcdef0123456789abcdef';
    const rawMessage = `Error occurred with key ${secretKey}`;
    expect(redactText(rawMessage, secretKey)).toBe('Error occurred with key [REDACTED]');

    const rawDetails = {
      apiKey: secretKey,
      nested: { token: 'poly_live_fedcba9876543210fedcba9876543210' },
      list: [secretKey, 'safe value'],
    };
    const redacted = redactValue(rawDetails, secretKey);
    expect(redacted.apiKey).toBe('[REDACTED]');
    expect(redacted.nested.token).toBe('[REDACTED]');
    expect(redacted.list[0]).toBe('[REDACTED]');
    expect(redacted.list[1]).toBe('safe value');
  });
});
