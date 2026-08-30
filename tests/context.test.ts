import { describe, it, expect, vi } from 'vitest';
import {
  Polygres,
  PolygresValidationError,
  PolygresAPIError,
  PolygresRuntimeError,
  waitForContextOperation,
  contextIdentifier,
  contextUuid,
  contextCollection,
  contextQuery,
} from '../src';

const API_KEY = 'poly_live_0123456789abcdef0123456789abcdef';
const RUNTIME_URL = 'https://p0123456789abcdef0123456.api.db.polygres.com/v1';

describe('Context namespace and query builders', () => {
  const client = new Polygres({ apiKey: API_KEY, runtimeUrl: RUNTIME_URL });
  const ctx = client.project().context;

  it('validates identifiers, UUIDs, collections, and queries', () => {
    expect(contextIdentifier('valid_name')).toBe('valid_name');
    expect(() => contextIdentifier('123_invalid')).toThrow(PolygresValidationError);

    const validUuid = '11111111-2222-3333-4444-555555555555';
    expect(contextUuid(validUuid, 'test_id')).toBe(validUuid);
    expect(() => contextUuid('invalid-uuid', 'test_id')).toThrow(PolygresValidationError);

    // Collection accepts valid identifier or UUID
    expect(contextCollection('my_collection')).toBe('my_collection');
    expect(contextCollection(validUuid)).toBe(validUuid);
    expect(() => contextCollection('invalid name with spaces')).toThrow(PolygresValidationError);

    expect(contextQuery('semantic text search')).toBe('semantic text search');
    expect(() => contextQuery('   ')).toThrow('Query must contain non-whitespace text.');
  });

  it('builds valid query plan structures', () => {
    const nearest = ctx.queryNearest([0.1, 0.2], 5, { vectorName: 'summary' });
    expect(nearest).toEqual({
      kind: 'nearest',
      vector: [0.1, 0.2],
      limit: 5,
      vector_name: 'summary',
    });

    const fullText = ctx.queryFullText('term query', 'body_text', 10);
    expect(fullText).toEqual({
      kind: 'full_text',
      text_query: 'term query',
      text_column: 'body_text',
      limit: 10,
    });

    const weighted = ctx.queryWeight(nearest, 0.8);
    expect(weighted).toEqual({
      kind: 'weight',
      branch: nearest,
      weight: 0.8,
    });

    const prefetch = ctx.queryPrefetch([nearest, fullText]);
    expect(prefetch).toEqual({
      kind: 'prefetch',
      branches: [nearest, fullText],
    });

    const threshold = ctx.queryScoreThreshold(nearest, 0.5, 1.0);
    expect(threshold).toEqual({
      kind: 'score_threshold',
      branch: nearest,
      min_score: 0.5,
      max_score: 1.0,
    });

    const formula = ctx.queryFormula(nearest, 'log(score) * 2');
    expect(formula).toEqual({
      kind: 'formula',
      branch: nearest,
      formula: 'log(score) * 2',
    });

    const rerank = ctx.queryRerank(nearest, 20);
    expect(rerank).toEqual({
      kind: 'rerank',
      branch: nearest,
      limit: 20,
    });
  });

  it('checks capabilities and enforces limits on context requests', async () => {
    const mockFetch = vi.fn(async (url: string) => {
      if (url.endsWith('/context/capabilities')) {
        return new Response(
          JSON.stringify({
            count: true,
            dense_search: true,
            max_search_limit: 100,
            max_dimensions: 128,
            max_relationship_types: 10,
            max_context_limit: 50,
            max_graph_limit: 200,
            max_joint_seed_limit: 8,
            max_joint_traversal_limit: 500,
            max_graph_depth: 5,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }
      return new Response(JSON.stringify({ count: 42 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    });

    const clientWithCaps = new Polygres({
      apiKey: API_KEY,
      runtimeUrl: RUNTIME_URL,
      fetch: mockFetch as any,
    });

    const res = await clientWithCaps.project().context.count('my_collection');
    expect(res.count).toBe(42);

    // Call search with limit exceeding max_search_limit (100)
    await expect(
      clientWithCaps.project().context.search('my_collection', [0.1, 0.2], { limit: 150 })
    ).rejects.toThrow('limit must be 100 or less for this project');
  });

  describe('waitForContextOperation', () => {
    const opId = '11111111-1111-1111-1111-111111111111';

    it('returns operation on success', async () => {
      let attempts = 0;
      const fetcher = async () => {
        attempts++;
        if (attempts < 2) {
          return [{ id: opId, status: 'running', stage: 'indexing' } as any, '0.001'];
        }
        return [{ id: opId, status: 'succeeded' } as any, null];
      };

      const result = await waitForContextOperation(opId, {
        fetch: fetcher,
        timeout: 10,
      });
      expect(result.status).toBe('succeeded');
      expect(attempts).toBe(2);
    });

    it('throws error on failed operation', async () => {
      const fetcher = async () => [
        {
          id: opId,
          status: 'failed',
          error: { code: 'CONTEXT_OPERATION_FAILED', message: 'Index failed' },
        } as any,
        null,
      ];

      await expect(
        waitForContextOperation(opId, { fetch: fetcher as any, timeout: 5 })
      ).rejects.toThrow(PolygresRuntimeError);
    });

    it('throws error on cancelled operation', async () => {
      const fetcher = async () => [
        {
          id: opId,
          status: 'cancelled',
        } as any,
        null,
      ];

      await expect(
        waitForContextOperation(opId, { fetch: fetcher as any, timeout: 5 })
      ).rejects.toThrow(PolygresAPIError);
    });
  });
});
