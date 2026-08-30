import { NextRequest, NextResponse } from 'next/server';
import { generateEmbeddings, EmbeddingModel, ChunkInput } from '@/lib/embeddings/embedder';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { chunks, model } = body;

    if (!chunks || !Array.isArray(chunks) || chunks.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Valid array of "chunks" is required for embedding generation.' },
        { status: 400 }
      );
    }

    const selectedModel = (model as EmbeddingModel) || 'nemotron-3-embed-1b';
    const apiKey = process.env.NVIDIA_API_KEY || '';

    const result = await generateEmbeddings({
      chunks: chunks as ChunkInput[],
      apiKey,
      model: selectedModel,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('API /api/pdf/embed Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to generate embeddings.' },
      { status: 500 }
    );
  }
}
