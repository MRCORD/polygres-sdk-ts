import { describe, it, expect, vi } from 'vitest';
import {
  Polygres,
  PolygresValidationError,
  PolygresAmbiguousWriteError,
  PolygresRuntimeError,
  RowWriteResult,
  RowWriteValidation,
} from '../src';

const API_KEY = 'poly_live_0123456789abcdef0123456789abcdef';
const RUNTIME_URL = 'https://p0123456789abcdef0123456.api.db.polygres.com/v1';

describe('RowsNamespace', () => {
  it('validates schema, table, and row values', async () => {
    const client = new Polygres({ apiKey: API_KEY, runtimeUrl: RUNTIME_URL });
    const rows = client.project().rows;

    await expect(
      rows.insert({ schema: 'invalid-schema!', table: 'users', row: { id: 1 } })
    ).rejects.toThrow('schema must match ^[A-Za-z_][A-Za-z0-9_]*$');

    await expect(
      rows.insert({ schema: 'public', table: 'users', row: {} })
    ).rejects.toThrow('row must be a non-empty object');

    await expect(
      rows.insert({ schema: 'public', table: 'users', row: { date: new Date() } })
    ).rejects.toThrow('row.date must use JSON-native strings or numbers');

    await expect(
      rows.insert({
        schema: 'public',
        table: 'users',
        row: { id: 1 },
        conflictColumns: ['id'],
      } as any)
    ).rejects.toThrow('insert does not accept conflict or update columns');

    await expect(
      rows.upsert({
        schema: 'public',
        table: 'users',
        row: { id: 1 },
        conflictColumns: [],
      })
    ).rejects.toThrow('upsert requires conflict_columns');

    await expect(
      rows.insert({
        schema: 'public',
        table: 'users',
        row: { id: 1 },
        reconcileContext: true,
      })
    ).rejects.toThrow('Context-backed row writes require idempotency_key');

    await expect(
      rows.insert({
        schema: 'public',
        table: 'users',
        row: { id: 1 },
        contextCollectionId: 'not-a-uuid',
        idempotencyKey: 'key_123',
      })
    ).rejects.toThrow('context_collection_id must be a UUID');
  });

  it('validates row write via validate() without executing', async () => {
    let calledUrl = '';
    const mockFetch = vi.fn(async (url: string) => {
      calledUrl = url;
      return new Response(
        JSON.stringify({
          valid: true,
          operation: 'insert',
          schema: 'public',
          table: 'events',
          writable_columns: ['id', 'title'],
          conflict_constraint: null,
          context: null,
          request_id: 'req_val',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const client = new Polygres({
      apiKey: API_KEY,
      runtimeUrl: RUNTIME_URL,
      fetch: mockFetch as any,
    });

    const val = await client.project().rows.validate({
      schema: 'public',
      table: 'events',
      row: { id: 1, title: 'Test' },
    });

    expect(calledUrl).toContain('/tables/public/events/rows/validate');
    expect(val).toBeInstanceOf(RowWriteValidation);
    expect(val.valid).toBe(true);
    expect(val.writableColumns).toEqual(['id', 'title']);
  });

  it('never automatically retries a row mutation', async () => {
    let callCount = 0;
    const mockFetch = vi.fn(async () => {
      callCount++;
      return new Response(
        JSON.stringify({
          error: {
            code: 'ROW_WRITE_OUTCOME_AMBIGUOUS',
            message: 'The row write outcome is unknown.',
          },
          request_id: 'req_ambiguous',
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

    await expect(
      client.project().rows.insert({
        schema: 'public',
        table: 'memories',
        row: { id: 1 },
      })
    ).rejects.toThrow(PolygresAmbiguousWriteError);

    expect(callCount).toBe(1);
  });

  it('does not reclassify known catalog errors as ambiguous write error', async () => {
    const mockFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          error: {
            code: 'ROW_STATEMENT_TIMEOUT',
            message: 'The row statement timed out.',
          },
        }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const client = new Polygres({
      apiKey: API_KEY,
      runtimeUrl: RUNTIME_URL,
      fetch: mockFetch as any,
    });

    await expect(
      client.project().rows.insert({
        schema: 'public',
        table: 'memories',
        row: { id: 1 },
      })
    ).rejects.toThrow(PolygresRuntimeError);

    try {
      await client.project().rows.insert({
        schema: 'public',
        table: 'memories',
        row: { id: 1 },
      });
    } catch (err: any) {
      expect(err).toBeInstanceOf(PolygresRuntimeError);
      expect(err).not.toBeInstanceOf(PolygresAmbiguousWriteError);
      expect(err.code).toBe('ROW_STATEMENT_TIMEOUT');
    }
  });

  it('executes upsert and parses RowWriteResult with context reconciliation', async () => {
    const collectionId = '2e172638-bd77-4a2c-bc42-406f4f2938d7';
    let headerKey: string | null = null;

    const mockFetch = vi.fn(async (url: string, init: any) => {
      headerKey = init.headers['Idempotency-Key'];
      return new Response(
        JSON.stringify({
          operation: 'upsert',
          schema: 'public',
          table: 'memories',
          returned: { id: 'm_1' },
          status: 'completed',
          row_committed: true,
          context: {
            collection_id: collectionId,
            status: 'completed',
            operation_id: 'op_123',
            operation_status: 'succeeded',
            retry_until: null,
            error: null,
          },
          idempotency_key: 'idem_test',
          request_id: 'req_upsert',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    });

    const client = new Polygres({
      apiKey: API_KEY,
      runtimeUrl: RUNTIME_URL,
      fetch: mockFetch as any,
    });

    const result = await client.project().rows.upsert({
      schema: 'public',
      table: 'memories',
      row: { id: 'm_1', text: 'hello' },
      conflictColumns: ['id'],
      reconcileContext: true,
      contextCollectionId: collectionId,
      idempotencyKey: 'idem_test',
    });

    expect(headerKey).toBe('idem_test');
    expect(result).toBeInstanceOf(RowWriteResult);
    expect(result.operation).toBe('upsert');
    expect(result.rowCommitted).toBe(true);
    expect(result.context?.collectionId).toBe(collectionId);
    expect(result.context?.status).toBe('completed');
  });
});
