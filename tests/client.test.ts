import { describe, it, expect } from 'vitest';
import {
  Polygres,
  PolygresValidationError,
  PolygresPermissionError,
  ConnectionInfo,
  RetrievalReadiness,
} from '../src';

const API_KEY = 'poly_live_0123456789abcdef0123456789abcdef';
const RUNTIME_URL = 'https://p0123456789abcdef0123456.api.db.polygres.com/v1';
const PROJECT_ID = 'p0123456789abcdef0123456';

describe('Polygres client construction and validation', () => {
  it('instantiates successfully with valid parameters', () => {
    const client = new Polygres({
      apiKey: API_KEY,
      runtimeUrl: RUNTIME_URL,
    });
    expect(client._apiKey).toBe(API_KEY);
    expect(client._baseUrl).toBe(RUNTIME_URL);
  });

  it('accepts snake_case construction parameters', () => {
    const client = new Polygres({
      api_key: API_KEY,
      runtime_url: RUNTIME_URL,
      max_retries: 3,
    });
    expect(client._maxRetries).toBe(3);
  });

  it('validates API key format', () => {
    expect(() => new Polygres({ apiKey: 'invalid_key', runtimeUrl: RUNTIME_URL })).toThrow(
      PolygresValidationError
    );
    expect(() => new Polygres({ apiKey: 'invalid_key', runtimeUrl: RUNTIME_URL })).toThrow(
      'API key must match poly_live_[32hex]'
    );
  });

  it('validates runtime URL presence', () => {
    expect(() => new Polygres({ apiKey: API_KEY })).toThrow(PolygresValidationError);
    expect(() => new Polygres({ apiKey: API_KEY })).toThrow('runtime_url is required');
  });

  it('validates matching runtime_url and base_url', () => {
    expect(
      () =>
        new Polygres({
          apiKey: API_KEY,
          runtimeUrl: 'https://a.test',
          baseUrl: 'https://b.test',
        })
    ).toThrow('runtime_url and base_url must match when both are provided');
  });

  it('enforces HTTPS except localhost', () => {
    expect(
      () => new Polygres({ apiKey: API_KEY, runtimeUrl: 'http://insecure.test' })
    ).toThrow('base_url must be HTTPS except localhost development');

    // Localhost allowed with http
    const local = new Polygres({
      apiKey: API_KEY,
      runtimeUrl: 'http://localhost:8000',
    });
    expect(local._baseUrl).toBe('http://localhost:8000');

    const localIp = new Polygres({
      apiKey: API_KEY,
      runtimeUrl: 'http://127.0.0.1:8000',
    });
    expect(localIp._baseUrl).toBe('http://127.0.0.1:8000');
  });

  it('validates timeout and retries range', () => {
    expect(
      () => new Polygres({ apiKey: API_KEY, runtimeUrl: RUNTIME_URL, timeout: -1 })
    ).toThrow(PolygresValidationError);

    expect(
      () => new Polygres({ apiKey: API_KEY, runtimeUrl: RUNTIME_URL, maxRetries: 6 })
    ).toThrow('max_retries must be between 0 and 5');
    expect(
      () => new Polygres({ apiKey: API_KEY, runtimeUrl: RUNTIME_URL, maxRetries: -1 })
    ).toThrow('max_retries must be between 0 and 5');
  });

  it('validates project ID and project mode', () => {
    const client = new Polygres({ apiKey: API_KEY, runtimeUrl: RUNTIME_URL });
    expect(() => client.project('invalid_project_id')).toThrow(
      'project id must match ^p[a-z0-9]{23}$'
    );
    expect(() => client.project(PROJECT_ID, { projectMode: 'unknown' as any })).toThrow(
      "project_mode must be 'standard' or 'synced'"
    );

    const project = client.project(PROJECT_ID, { projectMode: 'standard' });
    expect(project.projectId).toBe(PROJECT_ID);
    expect(project.projectMode).toBe('standard');
  });

  it('rejects connectionInfo in synced mode before request', async () => {
    const client = new Polygres({ apiKey: API_KEY, runtimeUrl: RUNTIME_URL });
    const project = client.project(PROJECT_ID, { projectMode: 'synced' });
    await expect(project.connectionInfo()).rejects.toThrow(PolygresPermissionError);
    await expect(project.connectionInfo()).rejects.toThrow(
      'This operation is unavailable for a synchronized project.'
    );
  });

  it('returns connection info and parses payload in standard mode', async () => {
    const mockFetch = async () => {
      return new Response(
        JSON.stringify({
          project_id: PROJECT_ID,
          database: 'polygres',
          username: 'polygres_user',
          port: 5432,
          direct: {
            host: 'direct.example.test',
            connection_string_without_password: 'postgresql://polygres_user@direct.example.test:5432/polygres',
          },
          pooled: {
            host: 'pooled.example.test',
            connection_string_without_password: 'postgresql://polygres_user@pooled.example.test:5432/polygres',
          },
          request_id: 'req_conn',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const client = new Polygres({
      apiKey: API_KEY,
      runtimeUrl: RUNTIME_URL,
      fetch: mockFetch as any,
    });
    const project = client.project();
    const conn = await project.connectionInfo();

    expect(conn).toBeInstanceOf(ConnectionInfo);
    expect(conn.projectId).toBe(PROJECT_ID);
    expect(conn.directHost).toBe('direct.example.test');
    expect(conn.pooledHost).toBe('pooled.example.test');
    expect(conn.port).toBe(5432);
    expect(conn.requestId).toBe('req_conn');
  });

  it('parses readiness payload correctly', async () => {
    const mockFetch = async () => {
      return new Response(
        JSON.stringify({
          project_id: PROJECT_ID,
          graph: { ready: true },
          vector: { ready: true },
          hybrid: { ready: true },
          request_id: 'req_ready',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    };

    const client = new Polygres({
      apiKey: API_KEY,
      runtimeUrl: RUNTIME_URL,
      fetch: mockFetch as any,
    });
    const project = client.project();
    const readiness = await project.readiness();

    expect(readiness).toBeInstanceOf(RetrievalReadiness);
    expect(readiness.projectId).toBe(PROJECT_ID);
    expect(readiness.graph.ready).toBe(true);
    expect(readiness.vector.ready).toBe(true);
    expect(readiness.hybrid.ready).toBe(true);
  });
});
