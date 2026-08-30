import { NextRequest, NextResponse } from 'next/server';
import { chunkText, ChunkingStrategy, PageInfo } from '@/lib/chunking/chunker';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, strategy, chunkSize, chunkOverlap, pages } = body;

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Valid "text" string is required for chunking.' },
        { status: 400 }
      );
    }

    const defaultChunkSize = process.env.CHUNK_SIZE ? Number(process.env.CHUNK_SIZE) : 800;
    const defaultChunkOverlap = process.env.CHUNK_OVERLAP ? Number(process.env.CHUNK_OVERLAP) : 100;

    const result = chunkText({
      text,
      strategy: strategy as ChunkingStrategy,
      chunkSize: chunkSize ? Number(chunkSize) : defaultChunkSize,
      chunkOverlap: chunkOverlap ? Number(chunkOverlap) : defaultChunkOverlap,
      pages: pages as PageInfo[],
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('API /api/pdf/chunk Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process text chunking.' },
      { status: 500 }
    );
  }
}
