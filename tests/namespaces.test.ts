import { describe, it, expect, vi } from 'vitest';
import {
  Polygres,
  PolygresValidationError,
  GraphResult,
  VectorResult,
  TextResult,
  HybridResult,
  GraphPathResponse,
  GraphConnectionResponse,
} from '../src';

const API_KEY = 'poly_live_0123456789abcdef0123456789abcdef';
const RUNTIME_URL = 'https://p0123456789abcdef0123456.api.db.polygres.com/v1';

describe('Retrieval namespaces and payload shapes', () => {
  describe('Graph namespace', () => {
    it('validates expand arguments', async () => {
      const client = new Polygres({ apiKey: API_KEY, runtimeUrl: RUNTIME_URL });
      const graph = client.project().graph;

      await expect(graph.expand(null as any)).rejects.toThrow('start is required');
      await expect(graph.expand({ id: '1' }, { maxDepth: 0 })).rejects.toThrow(
        'max_depth must be between 1 and 20'
      );
      await expect(graph.expand({ id: '1' }, { limit: 1001 })).rejects.toThrow(
        'limit must be between 1 and 1000'
      );
      await expect(graph.expand({ id: '1' }, { direction: 'invalid' as any })).rejects.toThrow(
        'direction must be out, in, any, or both'
      );
    });

    it('sends proper payload for expand and parses results', async () => {
      let sentPayload: any = null;
      const mockFetch = vi.fn(async (url: string, init: any) => {
        sentPayload = JSON.parse(init.body);
        return new Response(
          JSON.stringify({
            results: [
              {
                node: { schema: 'public', table: 'users', id: 'u_1', properties: { name: 'Alice' } },
                depth: 1,
                rank: 1,
                graph_score: 0.95,
                readable_path: 'users:u_1',
              },
            ],
            has_more: false,
            next_cursor: null,
            request_id: 'req_graph',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const client = new Polygres({
        apiKey: API_KEY,
        runtimeUrl: RUNTIME_URL,
        fetch: mockFetch as any,
      });

      const start = { schema: 'public', table: 'users', id: 'u_0' };
      const page = await client.project().graph.expand(start, {
        maxDepth: 3,
        direction: 'both',
        limit: 25,
      });

      expect(sentPayload.max_depth).toBe(3);
      expect(sentPayload.direction).toBe('any'); // 'both' aliases to 'any'
      expect(sentPayload.limit).toBe(25);
      expect(sentPayload.start).toEqual(start);

      expect(page.results.length).toBe(1);
      const res = page.results[0];
      expect(res).toBeInstanceOf(GraphResult);
      expect(res.node.id).toBe('u_1');
      expect(res.depth).toBe(1);
      expect(res.graphScore).toBe(0.95);
      expect(res.readablePath).toBe('users:u_1');
    });

    it('sends proper payload for path and connection', async () => {
      let pathPayload: any = null;
      let connPayload: any = null;

      const mockFetch = vi.fn(async (url: string, init: any) => {
        if (url.endsWith('/graph/path')) {
          pathPayload = JSON.parse(init.body);
          return new Response(JSON.stringify({ paths: [[{ id: '1' }, { id: '2' }]] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.endsWith('/graph/connection')) {
          connPayload = JSON.parse(init.body);
          return new Response(JSON.stringify({ connections: [{ id: '1' }] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return new Response('{}', { status: 200 });
      });

      const client = new Polygres({
        apiKey: API_KEY,
        runtimeUrl: RUNTIME_URL,
        fetch: mockFetch as any,
      });
      const graph = client.project().graph;

      const src = { schema: 'public', table: 'users', id: '1' };
      const tgt = { schema: 'public', table: 'users', id: '2' };
      const pathRes = await graph.path(src, tgt, { maxDepth: 4 });
      expect(pathRes).toBeInstanceOf(GraphPathResponse);
      expect(pathPayload.max_depth).toBe(4);
      expect(pathPayload.source).toEqual(src);
      expect(pathPayload.target).toEqual(tgt);

      const connRes = await graph.connection([src, tgt], { maxDepth: 3 });
      expect(connRes).toBeInstanceOf(GraphConnectionResponse);
      expect(connPayload.entities.length).toBe(2);

      await expect(graph.connection([src])).rejects.toThrow('entities must contain 2..10 items');
    });
  });

  describe('Vector namespace', () => {
    it('validates embeddings and options', async () => {
      const client = new Polygres({ apiKey: API_KEY, runtimeUrl: RUNTIME_URL });
      const vector = client.project().vector;

      await expect(vector.search([])).rejects.toThrow('embedding must be non-empty');
      await expect(vector.search([NaN])).rejects.toThrow('embedding values must be finite numbers');
      await expect(
        vector.search([0.1], { maxDistance: 0.5, minSimilarity: 0.8 })
      ).rejects.toThrow('max_distance and min_similarity are mutually exclusive');

      await expect(vector.similarTo('')).rejects.toThrow('row_id is required');
    });

    it('sends search request and parses VectorResult', async () => {
      let sentPayload: any = null;
      const mockFetch = vi.fn(async (url: string, init: any) => {
        sentPayload = JSON.parse(init.body);
        return new Response(
          JSON.stringify({
            results: [
              {
                schema: 'public',
                table: 'docs',
                id: 'doc_1',
                properties: { title: 'Doc' },
                distance: 0.1,
                similarity: 0.9,
                score: 0.9,
              },
            ],
            has_more: true,
            next_cursor: 'cur_next',
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const client = new Polygres({
        apiKey: API_KEY,
        runtimeUrl: RUNTIME_URL,
        fetch: mockFetch as any,
      });

      const page = await client.project().vector.search([0.1, 0.2, 0.3], {
        config: 'docs_vec',
        minSimilarity: 0.75,
        limit: 10,
      });

      expect(sentPayload.config).toBe('docs_vec');
      expect(sentPayload.min_similarity).toBe(0.75);
      expect(sentPayload.limit).toBe(10);

      expect(page.hasMore).toBe(true);
      expect(page.nextCursor).toBe('cur_next');
      expect(page.results[0]).toBeInstanceOf(VectorResult);
      expect(page.results[0].id).toBe('doc_1');
      expect(page.results[0].similarity).toBe(0.9);
      expect(page.results[0].distance).toBe(0.1);
    });
  });

  describe('Text namespace', () => {
    it('validates queries and limits', async () => {
      const client = new Polygres({ apiKey: API_KEY, runtimeUrl: RUNTIME_URL });
      const text = client.project().text;

      await expect(text.tsvector('  ', { config: 'cfg' })).rejects.toThrow(
        'query must be non-empty'
      );
      await expect(text.fuzzy('test', { config: 'cfg', limit: 0 })).rejects.toThrow(
        'limit must be between 1 and 1000'
      );
    });

    it('sends tsvector and fuzzy requests and parses TextResult', async () => {
      let sentPayload: any = null;
      const mockFetch = vi.fn(async (url: string, init: any) => {
        sentPayload = JSON.parse(init.body);
        return new Response(
          JSON.stringify({
            results: [
              {
                schema: 'public',
                table: 'docs',
                id: 'doc_1',
                properties: { body: 'Content' },
                score: 0.85,
              },
            ],
            has_more: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const client = new Polygres({
        apiKey: API_KEY,
        runtimeUrl: RUNTIME_URL,
        fetch: mockFetch as any,
      });

      const page = await client.project().text.tsvector('postgresql search', {
        config: 'english',
        limit: 5,
      });

      expect(sentPayload.query).toBe('postgresql search');
      expect(sentPayload.config).toBe('english');
      expect(sentPayload.limit).toBe(5);

      expect(page.results[0]).toBeInstanceOf(TextResult);
      expect(page.results[0].score).toBe(0.85);
    });
  });

  describe('Hybrid namespace', () => {
    it('sends graphFirst, vectorFirst, and joint retrieval requests', async () => {
      let endpoint = '';
      let sentPayload: any = null;

      const mockFetch = vi.fn(async (url: string, init: any) => {
        endpoint = url;
        sentPayload = JSON.parse(init.body);
        return new Response(
          JSON.stringify({
            results: [
              {
                node: { schema: 'public', table: 'docs', id: 'doc_1' },
                properties: { title: 'Doc' },
                score: 0.92,
                final_score: 0.92,
                vector_score: 0.9,
                graph_score: 0.95,
                relationships: [],
              },
            ],
            has_more: false,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      });

      const client = new Polygres({
        apiKey: API_KEY,
        runtimeUrl: RUNTIME_URL,
        fetch: mockFetch as any,
      });
      const hybrid = client.project().hybrid;

      const start = { schema: 'public', table: 'docs', id: 'doc_0' };
      const gfPage = await hybrid.graphFirst(start, [0.1, 0.2], {
        maxDepth: 2,
        vectorWeight: 0.6,
        graphWeight: 0.4,
      });
      expect(endpoint).toContain('/hybrid/graph-first');
      expect(sentPayload.weights).toEqual({ vector: 0.6, graph: 0.4 });
      expect(gfPage.results[0]).toBeInstanceOf(HybridResult);
      expect(gfPage.results[0].score).toBe(0.92);

      await hybrid.vectorFirst([0.1, 0.2], {
        vectorLimit: 50,
        maxDepth: 1,
      });
      expect(endpoint).toContain('/hybrid/vector-first');
      expect(sentPayload.vector_limit).toBe(50);

      await hybrid.joint([0.1, 0.2], start, {
        maxDepth: 3,
        vectorLimit: 30,
      });
      expect(endpoint).toContain('/hybrid/joint');
      expect(sentPayload.max_depth).toBe(3);
    });
  });
});
