/**
 * Cloudflare Worker example integrating Workers AI with Polygres pgContext.
 *
 * Requirements:
 * - wrangler.toml with [ai] binding
 * - POLYGRES_API_KEY and POLYGRES_RUNTIME_URL configured in secrets
 */

import { Polygres } from 'polygres-sdk-ts';

interface Env {
  POLYGRES_API_KEY: string;
  POLYGRES_RUNTIME_URL: string;
  AI: any; // Cloudflare Workers AI binding
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const query = url.searchParams.get('q');

    if (!query) {
      return Response.json({ error: 'Missing query parameter ?q=' }, { status: 400 });
    }

    // 1. Initialize Polygres Client
    const client = new Polygres({
      apiKey: env.POLYGRES_API_KEY,
      runtimeUrl: env.POLYGRES_RUNTIME_URL,
      timeout: 10.0,
      maxRetries: 1,
      checkVersionNotices: false, // Recommended for edge runtimes to conserve subrequest quota
    });

    const context = client.project().context;

    // 2. Generate embedding using Cloudflare Workers AI
    const aiResponse = await env.AI.run('@cf/baai/bge-base-en-v1.5', {
      text: [query],
    });
    const embedding = aiResponse.data[0];

    // 3. Execute hybrid semantic + lexical search on pgContext
    const results = await context.query('articles', embedding, {
      query,
      limit: 10,
    });

    return Response.json({
      query,
      total: results.results.length,
      matches: results.results.map((item) => ({
        pointId: item.point_id,
        score: item.score,
        properties: item.properties,
      })),
    });
  },
};
