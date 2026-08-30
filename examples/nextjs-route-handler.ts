/**
 * Next.js (App Router) Route Handler: app/api/search/route.ts
 *
 * Demonstrates semantic search with pgContext in Next.js Server Components
 * or API routes.
 */

import { NextResponse } from 'next/server';
import { Polygres, PolygresError } from 'polygres-sdk-ts';

// Singleton or per-request client
const client = new Polygres({
  apiKey: process.env.POLYGRES_API_KEY!,
  runtimeUrl: process.env.POLYGRES_RUNTIME_URL!,
  timeout: 15.0,
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { embedding, filter, limit = 10 } = body;

    if (!Array.isArray(embedding) || embedding.length === 0) {
      return NextResponse.json(
        { error: 'Invalid or missing embedding array' },
        { status: 400 }
      );
    }

    const context = client.project().context;

    // Search collection with metadata filtering
    const searchResponse = await context.search('documentation', embedding, {
      filter,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: searchResponse.results,
    });
  } catch (error) {
    if (error instanceof PolygresError) {
      return NextResponse.json(
        { error: error.message, code: error.code, requestId: error.requestId },
        { status: error.statusCode || 500 }
      );
    }
    return NextResponse.json(
      { error: 'An unexpected internal error occurred' },
      { status: 500 }
    );
  }
}
