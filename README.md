# Polygres TypeScript SDK (`polygres-sdk-ts`)

[![npm version](https://img.shields.io/badge/npm-0.4.1-blue.svg)](https://www.npmjs.com/package/polygres-sdk-ts)
[![License](https://img.shields.io/badge/license-Apache--2.0-green.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)]()
[![Runtime Support](https://img.shields.io/badge/runtimes-Node%20%7C%20Cloudflare%20%7C%20Deno%20%7C%20Bun%20%7C%20Browser-purple.svg)]()

The official TypeScript/JavaScript SDK for **[Polygres](https://polygres.com)** — enabling high-performance graph traversal, vector similarity search, PostgreSQL full-text search, and **pgContext** hybrid retrieval.

The SDK connects to a Polygres project's Runtime API using a Project API Key. It is fully typed, works across Node.js (18+) and Edge runtimes (Cloudflare Workers, Deno, Bun) via native WHATWG `fetch`, and never exposes direct PostgreSQL credentials.

- [Official Documentation](https://docs.polygres.com)
- [Polygres Platform](https://polygres.com)
- [Discord Community](https://discord.gg/GnHR8ezuwG)

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Client Configuration](#client-configuration)
- [pgContext Guide](#pgcontext-guide)
  - [1. Collections & Lifecycle](#1-collections--lifecycle)
  - [2. Multi-Vector & Filter Configuration](#2-multi-vector--filter-configuration)
  - [3. Points Synchronization & Scrolling](#3-points-synchronization--scrolling)
  - [4. Search & Retrieval Modes](#4-search--retrieval-modes)
  - [5. Knowledge Graph & Rank Fusion](#5-knowledge-graph--rank-fusion)
  - [6. Declarative Query Plan AST Engine](#6-declarative-query-plan-ast-engine)
  - [7. Background Operations & Polling Engine](#7-background-operations--polling-engine)
- [Retrieval Namespaces](#retrieval-namespaces)
  - [Vector Search](#vector-search)
  - [Full-Text & Fuzzy Search](#full-text--fuzzy-search)
  - [Graph Traversal](#graph-traversal)
  - [Hybrid Retrieval](#hybrid-retrieval)
- [Row Mutations & Context Reconciliation](#row-mutations--context-reconciliation)
- [Pagination & Async Iteration](#pagination--async-iteration)
- [Error Handling & Secret Scrubbing](#error-handling--secret-scrubbing)
- [Deployment Guides](#deployment-guides)
  - [Cloudflare Workers](#cloudflare-workers)
  - [Next.js (App Router)](#nextjs-app-router)
  - [Deno & Bun](#deno--bun)
  - [Browsers](#browsers)
- [Dual API Conventions](#dual-api-conventions)
- [Examples](#examples)
- [License](#license)

---

## Features

- **Zero Runtime Dependencies**: Pure WHATWG Web standards (`fetch`, `Headers`, `Response`, `AbortController`, `crypto.randomUUID()`).
- **Edge & Serverless Ready**: Native compatibility with Cloudflare Workers, Vercel Edge, Deno, Bun, and Node.js without native C++ addons.
- **Complete pgContext 0.2.0 Parity**: Full collection management, multi-vector indexing, keyset point scrolling, ColBERT-style late interaction, and declarative query trees.
- **Resilient Transport Engine**: Exponential backoff with jitter for transient HTTP errors (`408, 429, 500, 502, 503, 504`), server `Retry-After` header parsing, and wall-clock deadline enforcement.
- **Client-Side Secret Masking**: Live API keys (`poly_live_...`) are automatically scrubbed from all exception messages, details, and logs.
- **Dual Package Distribution**: Modern ESM (`dist/index.mjs`) and CommonJS (`dist/index.js`) with comprehensive `.d.ts` declarations.

---

## Installation

```bash
# npm
npm install polygres-sdk-ts

# pnpm
pnpm add polygres-sdk-ts

# bun
bun add polygres-sdk-ts

# yarn
yarn add polygres-sdk-ts
```

---

## Quick Start

Initialize the client with your Project API Key and Runtime URL (found under **Connect** in the Polygres Console):

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

---

## Client Configuration

`new Polygres(options)` accepts the following options:

| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `apiKey` / `api_key` | `string` | **Required** | Project API key matching `poly_live_[32hex]`. |
| `runtimeUrl` / `runtime_url` | `string` | **Required** | Base HTTPS Runtime API URL (HTTP allowed for `localhost`). |
| `timeout` | `number` | `30.0` | Global subrequest timeout in seconds. |
| `connectTimeout` / `connect_timeout` | `number` | `10.0` | Transport connect timeout in seconds. |
| `maxRetries` / `max_retries` | `number` | `2` | Number of automatic retries on retryable 5xx / 429 status codes (0 to 5). |
| `headers` | `Record<string, string>` | `{}` | Custom HTTP request headers. |
| `fetch` | `typeof fetch` | `globalThis.fetch` | Custom fetch implementation (useful for Cloudflare Service Bindings or tests). |
| `checkVersionNotices` | `boolean` | `true` | When `false`, disables background SDK version notice polling (recommended on edge). |

---

## pgContext Guide

**pgContext** provides PostgreSQL-native vector collections, inverted lexical indexes, and structured query plan execution.

### 1. Collections & Lifecycle

```typescript
const ctx = project.context;

// Create a collection over an existing PostgreSQL table
const operation = await ctx.createCollection('support_kb', {
  source: { schema: 'public', table: 'kb_articles' },
  vector: { column_name: 'embedding', dimensions: 1536, metric: 'cosine' },
  textColumn: 'content',
  filterColumns: ['tenant_id', 'status'],
  jsonbFilterPaths: [{ key: 'category', column: 'metadata', path: ['category'] }],
  indexKind: 'hnsw', // 'hnsw' | 'ivfflat'
});

// Wait for asynchronous index creation
await ctx.waitForOperation(operation);

// List, inspect, and update collections
const collections = await ctx.listCollections({ limit: 20 });
const details = await ctx.getCollection('support_kb');
await ctx.updateCollection('support_kb', { maxSearchLimit: 500 });
```

### 2. Multi-Vector & Filter Configuration

```typescript
// Register an additional vector column (e.g., summary embedding)
await ctx.registerVector('support_kb', 'summary_embedding', 768, {
  metric: 'cosine',
});

// Register standard columns and nested JSONB paths as indexed filters
await ctx.registerFilterColumn('support_kb', 'author_id', 'author_id');
await ctx.registerJsonbPath('support_kb', 'tag', 'metadata', ['tags', 'primary']);
```

### 3. Points Synchronization & Scrolling

```typescript
// Direct point mutations by source primary keys
await ctx.upsertPoints('support_kb', ['doc_101', 'doc_102']);
await ctx.deletePoints('support_kb', ['doc_999']);

// High-throughput bulk operations & backfills
await ctx.bulkUpsertPoints('support_kb', ['doc_1', 'doc_2'], { batchSize: 1000 });
await ctx.backfillPoints('support_kb', { batchSize: 500 });

// Keyset pagination across indexed points
const page = await ctx.scroll('support_kb', { limit: 50 });
for await (const point of page) {
  console.log(point.point_id, point.source_key);
}
```

### 4. Search & Retrieval Modes

#### Dense Semantic Search
```typescript
const searchResults = await ctx.search('support_kb', queryVector, {
  limit: 10,
  filter: { tenant_id: 'org_123', status: 'published' },
});
```

#### Hybrid Lexical + Semantic Search
Blends dense embeddings with PostgreSQL full-text search:
```typescript
const hybridResults = await ctx.query('support_kb', queryVector, {
  query: 'distributed database replication lag',
  limit: 10,
});
```

#### Grouped Search & Recommendation
```typescript
// Top N chunks grouped by parent document
const grouped = await ctx.groupedSearch('support_kb', queryVector, {
  groupBy: 'parent_id',
  groupLimit: 2,
  limit: 10,
});

// Example-based recommendations
const recs = await ctx.recommend('support_kb', {
  positivePointIds: [12, 34],
  negativePointIds: [56],
  limit: 5,
});
```

### 5. Knowledge Graph & Rank Fusion

Combine knowledge graph topology with vector embeddings:

```typescript
// Graph-first: explore graph neighborhood, then score by semantic vector
const graphFirst = await ctx.graphFirst('support_kb', queryVector, {
  start: { schema: 'public', table: 'authors', id: 'author_42' },
  maxDepth: 2,
  graphLimit: 100,
  limit: 10,
});

// Reciprocal Rank Fusion (RRF) across graph and vector distances
const rrf = await ctx.rankFusion('support_kb', queryVector, {
  start: { schema: 'public', table: 'topics', id: 'topic_postgres' },
  contextWeight: 0.7,
  graphWeight: 0.3,
  limit: 10,
});

// Multi-lane Joint Retrieval (semantic + lexical + graph)
const joint = await ctx.joint('support_kb', queryVector, {
  query: 'WAL archiving',
  starts: [{ schema: 'public', table: 'categories', id: 'cat_infra' }],
  semanticWeight: 0.6,
  lexicalWeight: 0.2,
  graphWeight: 0.2,
  limit: 10,
});
```

### 6. Declarative Query Plan AST Engine

Build composable query trees that execute directly on PostgreSQL:

```typescript
// 1. Vector branch with score threshold
const vectorBranch = ctx.queryScoreThreshold(
  ctx.queryNearest(queryVector, 20),
  0.7, // minScore
  1.0  // maxScore
);

// 2. Weighted lexical full-text branch
const textBranch = ctx.queryWeight(
  ctx.queryFullText('database tuning', 'content', 20),
  0.35
);

// 3. Compose parallel prefetch AST and rerank top 10
const plan = ctx.queryRerank(
  ctx.queryPrefetch([vectorBranch, textBranch]),
  10
);

// Execute on server
const response = await ctx.executeQuery('support_kb', plan);
console.log(response.results);
```

### 7. Background Operations & Polling Engine

Long-running operations (such as re-indexing or backfilling) return an operation envelope that can be monitored with stage-aware backoff:

```typescript
const operation = await ctx.reindexCollection('support_kb');

const result = await ctx.waitForOperation(operation, {
  timeout: 300.0, // 5 minutes timeout
});

console.log('Operation status:', result.status); // 'succeeded' | 'failed' | 'cancelled'
```

---

## Retrieval Namespaces

### Vector Search

```typescript
// Search by vector embedding
const results = await project.vector.search([0.021, -0.043, 0.128], {
  config: 'docs_vec',
  limit: 10,
  minSimilarity: 0.75, // mutually exclusive with maxDistance
});

// Find rows similar to an existing row
const similar = await project.vector.similarTo('doc_123', {
  config: 'docs_vec',
  limit: 5,
});
```

### Full-Text & Fuzzy Search

```typescript
// PostgreSQL tsvector search
const textResults = await project.text.tsvector('postgres performance', {
  config: 'english',
  limit: 10,
});

// Trigram fuzzy search (tolerant to misspellings)
const fuzzyResults = await project.text.fuzzy('postgre', {
  config: 'english',
  limit: 5,
});
```

### Graph Traversal

```typescript
const startNode = { schema: 'public', table: 'users', id: 'u_1' };

// Expand neighborhood
const graph = await project.graph.expand(startNode, {
  maxDepth: 3,
  direction: 'out', // 'out' | 'in' | 'any' | 'both'
  limit: 50,
});

// Find shortest relationship path between entities
const path = await project.graph.path(
  startNode,
  { schema: 'public', table: 'companies', id: 'c_9' },
  { maxDepth: 5 }
);

// Discover multi-entity connections
const connections = await project.graph.connection([
  startNode,
  { schema: 'public', table: 'teams', id: 't_3' },
]);
```

### Hybrid Retrieval

```typescript
// Graph-first hybrid search
const hybrid = await project.hybrid.graphFirst(startNode, queryVector, {
  maxDepth: 2,
  vectorWeight: 0.7,
  graphWeight: 0.3,
  limit: 10,
});

// Vector-first hybrid search
const vectorFirst = await project.hybrid.vectorFirst(queryVector, {
  vectorLimit: 20,
  maxDepth: 1,
  limit: 10,
});
```

---

## Row Mutations & Context Reconciliation

Perform validated row mutations with optional automatic pgContext vector synchronization:

```typescript
const result = await project.rows.insert({
  schema: 'public',
  table: 'memories',
  row: { id: 'mem_1', user_id: 'u_42', content: 'Prefers dark mode' },
  reconcileContext: true,
  idempotencyKey: 'custom_or_uuid_key',
  waitForContext: true,
  waitTimeout: 10.0,
});

console.log('Committed to Postgres:', result.rowCommitted);
console.log('pgContext sync status:', result.context?.status); // 'completed' | 'pending' | 'partial_failed'
```

Row mutations are non-retryable by default to prevent duplicate writes. Ambiguous 5xx errors or network disconnects throw `PolygresAmbiguousWriteError`.

---

## Pagination & Async Iteration

All search and list methods return a `Page<T>` object supporting standard array access and ECMAScript `Symbol.asyncIterator`:

```typescript
const page = await project.vector.search(queryVector, { limit: 50 });

// Seamless streaming iteration across all pages
for await (const item of page) {
  console.log(item.id, item.similarity);
}

// Or autoPagingIter()
for await (const item of page.autoPagingIter()) {
  console.log(item);
}
```

---

## Error Handling & Secret Scrubbing

All SDK errors inherit from `PolygresError` and map to canonical error codes:

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
  await project.vector.search(queryVector);
} catch (err) {
  if (err instanceof PolygresRateLimitError) {
    console.error(`Rate limited. Request ID: ${err.requestId}`);
  } else if (err instanceof PolygresMaintenanceError) {
    console.error('System is in scheduled maintenance.');
  } else if (err instanceof PolygresAmbiguousWriteError) {
    console.error('Write outcome ambiguous; inspect before retrying.');
  } else if (err instanceof PolygresError) {
    console.error(`[${err.code}] ${err.message} (HTTP ${err.statusCode})`);
  }
}
```

---

## Deployment Guides

### Cloudflare Workers

Workers runs on V8 isolates using standard Web APIs. Configure secrets via Wrangler and set `checkVersionNotices: false` to conserve subrequest quota:

```typescript
import { Polygres } from 'polygres-sdk-ts';

interface Env {
  POLYGRES_API_KEY: string;
  POLYGRES_RUNTIME_URL: string;
  AI: any; // Cloudflare Workers AI binding
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const client = new Polygres({
      apiKey: env.POLYGRES_API_KEY,
      runtimeUrl: env.POLYGRES_RUNTIME_URL,
      checkVersionNotices: false,
    });

    const ai = await env.AI.run('@cf/baai/bge-base-en-v1.5', { text: ['search query'] });
    const results = await client.project().context.search('kb', ai.data[0], { limit: 5 });

    return Response.json(results.results);
  },
};
```

### Next.js (App Router)

Use in Server Components, Route Handlers (`app/api/search/route.ts`), or Server Actions:

```typescript
import { NextResponse } from 'next/server';
import { Polygres } from 'polygres-sdk-ts';

const client = new Polygres({
  apiKey: process.env.POLYGRES_API_KEY!,
  runtimeUrl: process.env.POLYGRES_RUNTIME_URL!,
});

export async function POST(request: Request) {
  const { queryVector } = await request.json();
  const results = await client.project().context.search('docs', queryVector);
  return NextResponse.json(results.results);
}
```

### Deno & Bun

`polygres-sdk-ts` runs natively in Deno and Bun without configuration:

```typescript
// Bun / Deno
import { Polygres } from 'polygres-sdk-ts';

const client = new Polygres({
  apiKey: process.env.POLYGRES_API_KEY!,
  runtimeUrl: process.env.POLYGRES_RUNTIME_URL!,
});
```

### Browsers

In browser contexts, the SDK automatically suppresses setting forbidden `User-Agent` headers and uses the browser's native `fetch`.

---

## Dual API Conventions

Every method and parameter accepts both modern JavaScript `camelCase` and Python-aligned `snake_case`:

```typescript
// Both are identical
await project.vector.similarTo('doc_1', { minSimilarity: 0.8 });
await project.vector.similar_to('doc_1', { min_similarity: 0.8 });

// Both are identical
await project.context.createCollection('col', { textColumn: 'body' });
await project.context.create_collection('col', { text_column: 'body' });
```

---

## Examples

Check the [`examples/`](./examples) directory for complete projects:
- [Cloudflare Worker with Workers AI](./examples/cloudflare-worker.ts)
- [Next.js App Router Route Handler](./examples/nextjs-route-handler.ts)
- [Node.js Declarative Query Plan AST](./examples/node-query-plan.ts)

---

## License

[Apache-2.0](./LICENSE)
