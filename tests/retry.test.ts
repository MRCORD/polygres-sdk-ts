import { describe, it, expect, vi } from 'vitest';
import {
  Polygres,
  PolygresRuntimeError,
  PolygresMaintenanceError,
  RETRY_STATUSES,
  parseRetryAfterSeconds,
} from '../src';

const API_KEY = 'poly_live_0123456789abcdef0123456789abcdef';
const RUNTIME_URL = 'https://p0123456789abcdef0123456.api.db.polygres.com/v1';

describe('Retry and backoff logic', () => {
  it('defines the canonical retry statuses', () => {
    expect(RETRY_STATUSES).toEqual(new Set([408, 429, 500, 502, 503, 504]));
    expect(RETRY_STATUSES.has(426)).toBe(false);
  });

  it('parses Retry-After headers in seconds or HTTP dates', () => {
    expect(parseRetryAfterSeconds('5')).toBe(5);
    expect(parseRetryAfterSeconds('0')).toBe(0);
    expect(parseRetryAfterSeconds('invalid')).toBe(null);
    expect(parseRetryAfterSeconds(null)).toBe(null);

    const futureDate = new Date(Date.now() + 10000).toUTCString();
    const parsed = parseRetryAfterSeconds(futureDate);
    expect(parsed).not.toBeNull();
    expect(parsed!).toBeGreaterThan(5);
    expect(parsed!).toBeLessThanOrEqual(10);
  });

  it('retries on retryable status up to max_retries', async () => {
    let callCount = 0;
    const mockFetch = vi.fn(async () => {
      callCount++;
      if (callCount < 3) {
        return new Response(JSON.stringify({ error: { message: 'Server error' } }), {
          status: 503,
          headers: { 'Content-Type': 'application/json', 'Retry-After': '0.001' },
        });
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new Polygres({
      apiKey: API_KEY,
      runtimeUrl: RUNTIME_URL,
      maxRetries: 2,
      fetch: mockFetch as any,
    });

    const res = await client._get('/test');
    expect(callCount).toBe(3);
    expect(res).toEqual({ ok: true });
  });

  it('does not retry when retryable is false', async () => {
    let callCount = 0;
    const mockFetch = vi.fn(async () => {
      callCount++;
      return new Response(JSON.stringify({ error: { message: 'Server error' } }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const client = new Polygres({
      apiKey: API_KEY,
      runtimeUrl: RUNTIME_URL,
      maxRetries: 3,
      fetch: mockFetch as any,
    });

    await expect(
      client._get('/test', { retryable: false })
    ).rejects.toThrow(PolygresRuntimeError);

    expect(callCount).toBe(1);
  });

  it('does not retry PolygresMaintenanceError', async () => {
    let callCount = 0;
    const mockFetch = vi.fn(async () => {
      callCount++;
      return new Response(
        JSON.stringify({
          error: { code: 'MAINTENANCE_READ_ONLY', message: 'System in maintenance' },
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const client = new Polygres({
      apiKey: API_KEY,
      runtimeUrl: RUNTIME_URL,
      maxRetries: 3,
      fetch: mockFetch as any,
    });

    await expect(client._get('/test')).rejects.toThrow(PolygresMaintenanceError);
    expect(callCount).toBe(1);
  });

  it('throws deadline error when deadline is exceeded', async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(JSON.stringify({ error: { message: 'Server error' } }), {
        status: 503,
        headers: { 'Content-Type': 'application/json', 'Retry-After': '5' },
      });
    });

    const client = new Polygres({
      apiKey: API_KEY,
      runtimeUrl: RUNTIME_URL,
      maxRetries: 2,
      fetch: mockFetch as any,
    });

    const pastDeadline = Date.now() / 1000 - 1;
    await expect(client._get('/test', { deadline: pastDeadline })).rejects.toThrow(
      'Polygres GET /test exceeded its deadline'
    );
  });
});
