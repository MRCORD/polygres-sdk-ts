# Polygres TypeScript SDK

Build TypeScript and JavaScript applications with Polygres graph, vector, text, and hybrid retrieval.

The SDK connects to a project's Runtime API using a Polygres API key. It is fully typed, works across Node.js and edge/browser runtimes via native `fetch`, and does not expose direct PostgreSQL credentials.

- [Documentation](https://docs.polygres.com)
- [Polygres](https://polygres.com)
- [Discord](https://discord.gg/GnHR8ezuwG)

## Install

Requires Node.js 18 or newer (or any runtime with standard `fetch` and `AbortController` support, such as Cloudflare Workers, Deno, or Bun).

```bash
npm install polygres-sdk-ts
```

## Quick Start

Initialize the client with your Project API key and Runtime API URL:

```typescript
import { Polygres } from 'polygres-sdk-ts';

const client = new Polygres({
  apiKey: process.env.POLYGRES_API_KEY!,
  runtimeUrl: process.env.POLYGRES_RUNTIME_URL!,
});

const project = client.project();

// Check retrieval readiness
const readiness = await project.readiness();
console.log('Graph ready:', readiness.graph.ready);
console.log('Vector ready:', readiness.vector.ready);
console.log('Hybrid ready:', readiness.hybrid.ready);
```

Both camelCase (`apiKey`, `runtimeUrl`, `maxRetries`, `timeout`) and snake_case (`api_key`, `runtime_url`, `max_retries`) are accepted throughout the SDK.

## Retrieval Methods

### Vector Search

Search by embedding vector or query rows similar to an existing row:

```typescript
// Search by vector embedding
const results = await project.vector.search([0.021, -0.043, 0.128], {
  config: 'docs_vec',
  limit: 10,
  minSimilarity: 0.75,
});

for (const result of results) {
  console.log(result.id, result.similarity, result.properties);
}

// Find rows similar to an existing row
const similar = await project.vector.similarTo('doc_123', {
  config: 'docs_vec',
  limit: 5,
});
```

### Full-Text and Fuzzy Search

```typescript
// PostgreSQL tsvector search
const textResults = await project.text.tsvector('postgresql index performance', {
  config: 'english',
  limit: 10,
});

// Trigram fuzzy search (tolerant to typos)
const fuzzyResults = await project.text.fuzzy('postgresl', {
  config: 'english',
  limit: 5,
});
```

### Graph Traversal

Traverse relationships between entities:

```typescript
const startNode = { schema: 'public', table: 'users', id: 'user_42' };

// Expand graph neighborhood
const graphResults = await project.graph.expand(startNode, {
  maxDepth: 3,
  direction: 'out', // 'out' | 'in' | 'any' | 'both'
  limit: 50,
});

// Find path between two nodes
const path = await project.graph.path(
  startNode,
  { schema: 'public', table: 'organizations', id: 'org_9' },
  { maxDepth: 5 }
);

// Find connections between multiple entities
const connections = await project.graph.connection([
  startNode,
  { schema: 'public', table: 'teams', id: 'team_3' },
]);
```

### Hybrid Retrieval

Combine graph and vector relevance with customizable weights:

```typescript
// Graph-first hybrid search
const hybridResults = await project.hybrid.graphFirst(
  startNode,
  [0.021, -0.043, 0.128],
  {
    maxDepth: 2,
    vectorWeight: 0.7,
    graphWeight: 0.3,
    limit: 10,
  }
);

// Vector-first hybrid search
const vectorFirst = await project.hybrid.vectorFirst(
  [0.021, -0.043, 0.128],
  {
    vectorLimit: 20,
    maxDepth: 1,
    limit: 10,
  }
);
```

## pgContext Namespace

Manage collections, index points, configure vectors, and execute complex query plans via `project.context`:

```typescript
// Create collection
const operation = await project.context.createCollection('support_docs', {
  source: { schema: 'public', table: 'documents' },
  vector: { column_name: 'embedding', dimensions: 1536 },
});

// Wait for operation to complete
const completed = await project.context.waitForOperation(operation);

// Search within collection
const scored = await project.context.search('support_docs', [0.1, 0.2, 0.3], {
  limit: 10,
});

// Build and execute advanced query plan
const plan = project.context.queryPrefetch([
  project.context.queryNearest([0.1, 0.2], 10),
  project.context.queryFullText('support query', 'body', 10),
]);
const execution = await project.context.executeQuery('support_docs', plan);
```

## Rows Namespace & Context Reconciliation

Perform validated row mutations (`validate`, `insert`, `upsert`, `ignore`) with optional context reconciliation:

```typescript
// Insert row with automatic pgContext synchronization
const result = await project.rows.insert({
  schema: 'public',
  table: 'memories',
  row: { id: 'mem_1', user_id: 'u_42', note: 'Prefers dark mode' },
  reconcileContext: true,
  idempotencyKey: 'idem_key_uuid_or_string',
  waitForContext: true,
  waitTimeout: 30.0,
});

console.log('Row committed:', result.rowCommitted);
console.log('Context status:', result.context?.status); // 'completed' | 'pending' | 'partial_failed'
```

Row mutations are non-retryable by default to prevent duplicate writes. Network timeouts or ambiguous 5xx errors surface as `PolygresAmbiguousWriteError`.

## Pagination

All search and list methods return a `Page<T>` object supporting both manual pagination and automatic async iteration:

```typescript
const page = await project.vector.search(queryVector, { limit: 50 });

// Async iteration through all pages seamlessly
for await (const item of page) {
  console.log(item.id, item.similarity);
}

// Or autoPagingIter()
for await (const item of page.autoPagingIter()) {
  console.log(item);
}
```

## Error Handling

The SDK exposes typed error classes matching the Polygres canonical error catalog:

```typescript
import {
  PolygresError,
  PolygresValidationError,
  PolygresAuthError,
  PolygresPermissionError,
  PolygresNotFoundError,
  PolygresRateLimitError,
  PolygresMaintenanceError,
  PolygresRuntimeError,
  PolygresAmbiguousWriteError,
} from 'polygres-sdk-ts';

try {
  await project.vector.search(embedding);
} catch (err) {
  if (err instanceof PolygresRateLimitError) {
    console.error(`Rate limited. Request ID: ${err.requestId}`);
  } else if (err instanceof PolygresMaintenanceError) {
    console.error('System undergoing scheduled maintenance.');
  } else if (err instanceof PolygresAmbiguousWriteError) {
    console.error('Write outcome ambiguous; check idempotency status before retrying.');
  } else if (err instanceof PolygresError) {
    console.error(`Polygres error [${err.code}]: ${err.message}`);
  }
}
```

Sensitive tokens and API keys are automatically redacted from error messages, request IDs, and details objects.

## Edge & Cloudflare Workers

The SDK uses the standard `fetch` and Web Streams APIs with zero native Node-only C++ dependencies. It runs seamlessly in:
- Cloudflare Workers
- Node.js (18+)
- Deno
- Bun
- Web Browsers

### Cloudflare Workers Example

In Cloudflare Workers, read API secrets from `env` bindings and optionally disable background version checks to preserve subrequest quota:

```typescript
import { Polygres } from 'polygres-sdk-ts';

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const client = new Polygres({
      apiKey: env.POLYGRES_API_KEY,
      runtimeUrl: env.POLYGRES_RUNTIME_URL,
      checkVersionNotices: false, // Recommended for edge to save subrequests
    });

    const results = await client.project().context.search('docs', [0.1, 0.2, 0.3], {
      limit: 5,
    });

    return Response.json(results.results);
  },
};
```

## Development & Testing

```bash
# Install dependencies
npm install

# Typecheck with tsc
npm run typecheck

# Build ESM, CJS, and TypeScript declaration files (.d.ts, .d.mts)
npm run build

# Run unit and integration tests with Vitest
npm test
```

## License

Apache-2.0
