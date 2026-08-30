# Polygres TypeScript SDK Examples

This directory contains reference implementations and integration patterns for `polygres-sdk-ts`:

- **[`cloudflare-worker.ts`](./cloudflare-worker.ts)**: Cloudflare Worker integrating **Workers AI** embeddings with **pgContext** hybrid text + semantic search.
- **[`nextjs-route-handler.ts`](./nextjs-route-handler.ts)**: Next.js 14/15 App Router Route Handler (`app/api/search/route.ts`) demonstrating error handling and metadata filtering.
- **[`node-query-plan.ts`](./node-query-plan.ts)**: Node.js / Bun script building multi-branch declarative pgContext query plans (`queryPrefetch`, `queryScoreThreshold`, `queryRerank`).

## Running Examples Locally

Make sure you have installed the SDK dependencies:

```bash
npm install
npm run build
```

Set your project credentials:

```bash
export POLYGRES_API_KEY="poly_live_your_32_hex_characters"
export POLYGRES_RUNTIME_URL="https://your_project_id.api.db.polygres.com/v1"
```

Run with `npx tsx`:

```bash
npx tsx examples/node-query-plan.ts
```
