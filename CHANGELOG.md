# Changelog

All notable changes to the Polygres TypeScript SDK (`polygres-sdk-ts`) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.4.1] - 2026-08-30

### Initial Release — Full TypeScript Port

Initial release of the official TypeScript/JavaScript SDK for Polygres (`polygres-sdk-ts`), bringing 100% parity with Python SDK 0.4.1 and pgContext 0.2.0.

#### Added
- **Core Client (`Polygres`)**:
  - Pure Web-standard HTTP client using global `fetch` and `AbortController`.
  - Zero Node-only runtime dependencies (runs out-of-the-box on Node 18+, Cloudflare Workers, Deno, Bun, and browsers).
  - Robust retry engine with exponential backoff and jitter for transient errors (`408, 429, 500, 502, 503, 504`).
  - Automatic `Retry-After` header parsing (seconds and HTTP-date).
  - Wall-clock deadline enforcement and configurable request timeouts.
  - Optional `fetch` override for Cloudflare Service Bindings, custom proxies, and test mocking.
  - Configurable `checkVersionNotices` option to control background SDK notice polling in serverless environments.
- **pgContext Namespace (`project.context`)**:
  - Full collection lifecycle management (`createCollection`, `listCollections`, `getCollection`, `updateCollection`, `dropCollection`, `reindexCollection`).
  - Multi-vector registration (`registerVector`) and metadata filtering (`registerFilterColumn`, `registerJsonbPath`).
  - Point synchronization: direct upsert/delete, keyset scrolling (`scroll`), high-throughput bulk mutations (`bulkUpsertPoints`), and table backfills (`backfillPoints`).
  - Search modes: dense semantic (`search`), hybrid lexical+vector (`query`), candidate search, recommendation (`recommend`), grouped search (`groupedSearch`), and recall validation (`recallCheck`).
  - Graph-aware hybrid retrieval: graph-first (`graphFirst`), vector-first (`vectorFirst`), reciprocal rank fusion (`rankFusion`), and multi-lane 3-way ranking (`joint`).
  - Declarative Query Plan AST builder (`queryNearest`, `querySparseNearest`, `queryFullText`, `queryLateInteraction`, `queryPrefetch`, `queryWeight`, `queryScoreThreshold`, `queryFormula`, `queryRerank`) with server-side Postgres execution via `executeQuery()`.
  - Adaptive stage-aware background operation polling (`waitForOperation`).
- **Retrieval Namespaces**:
  - `project.graph`: `expand`, `neighborhood`, `related`, `path`, and `connection` with direction validation (`out`, `in`, `any`, `both`).
  - `project.vector`: `search` and `similarTo` with mutual exclusion enforcement between `maxDistance` and `minSimilarity`.
  - `project.text`: `tsvector` and `fuzzy` search.
  - `project.hybrid`: `graphFirst`, `vectorFirst`, and `joint`.
- **Row Mutations & Reconciliation (`project.rows`)**:
  - Validated single-row operations (`validate`, `insert`, `upsert`, `ignore`).
  - Strict SQL identifier validation and JSON-native payload checking.
  - Optional Context reconciliation with idempotent background task tracking and wait replay.
  - Reclassification safeguards ensuring pre-mutation validation failures are never masked as ambiguous writes.
- **Error Hierarchy & Security**:
  - Full canonical error catalog mapping 688 error codes with safe field filtering.
  - Typed exceptions: `PolygresError`, `PolygresAPIError`, `PolygresValidationError`, `PolygresAuthError`, `PolygresPermissionError`, `PolygresNotFoundError`, `PolygresRateLimitError`, `PolygresMaintenanceError`, `PolygresRuntimeError`, and `PolygresAmbiguousWriteError`.
  - Automated client-side secret scrubbing for API keys (`poly_live_...`) in error messages, detail objects, and request IDs.
- **Async Pagination**:
  - `Page<T>` class implementing ECMAScript `Symbol.asyncIterator` protocol for `for await (const item of page)` and `page.autoPagingIter()`.
- **Packaging & Typing**:
  - Dual ESM (`dist/index.mjs`) and CommonJS (`dist/index.js`) distribution with `.d.ts` and `.d.mts` type declarations.
  - Dual naming conventions: idiomatic camelCase methods and properties with snake_case aliases.
