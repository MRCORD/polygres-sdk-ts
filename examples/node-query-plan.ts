/**
 * Node.js / Bun script demonstrating pgContext declarative query plan construction.
 *
 * Demonstrates:
 * 1. Parallel candidate prefetch across vector similarity and full-text search.
 * 2. Score threshold filtering.
 * 3. Dynamic reranking of merged candidate branches.
 */

import { Polygres } from 'polygres-sdk-ts';

const client = new Polygres({
  apiKey: process.env.POLYGRES_API_KEY || 'poly_live_0123456789abcdef0123456789abcdef',
  runtimeUrl: process.env.POLYGRES_RUNTIME_URL || 'https://p0123456789abcdef0123456.api.db.polygres.com/v1',
});

async function main() {
  const context = client.project().context;

  const mockQueryVector = Array(1536).fill(0.01);
  const textQuery = 'distributed consensus algorithms';

  console.log('Composing declarative pgContext retrieval plan...');

  // Branch 1: Vector search with minimum similarity threshold
  const vectorBranch = context.queryScoreThreshold(
    context.queryNearest(mockQueryVector, 25),
    0.65, // minimum similarity score
    1.0
  );

  // Branch 2: Weighted PostgreSQL tsvector search
  const textBranch = context.queryWeight(
    context.queryFullText(textQuery, 'content', 25),
    0.35 // weight applied to text ranking
  );

  // Combine both branches into a parallel prefetch AST and rerank the top 10
  const compositePlan = context.queryRerank(
    context.queryPrefetch([vectorBranch, textBranch]),
    10 // final top-K limit
  );

  console.log('Query Plan AST:', JSON.stringify(compositePlan, null, 2));

  // Execute on database
  // const response = await context.executeQuery('research_papers', compositePlan);
  // console.log(`Retrieved ${response.results.length} ranked items.`);
}

main().catch(console.error);
