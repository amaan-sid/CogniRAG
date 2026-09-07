import { NextRequest, NextResponse } from 'next/server';
import { executeRagQuery, RagQueryOptions } from '@/lib/rag/queryEngine';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      queryText,
      chatMode,
      topK,
      minScore,
      apiKey,
      llmModel,
      embeddingModel,
      chunks,
      embeddings,
      webSearchEnabled = true,
      sessionId,
    } = body;

    if (!queryText || typeof queryText !== 'string' || !queryText.trim()) {
      return NextResponse.json(
        { success: false, error: 'Valid "queryText" string is required for query.' },
        { status: 400 }
      );
    }

    const selEmbeddingModel = embeddingModel || process.env.EMBEDDING_MODEL;
    const selLlmModel = llmModel || process.env.LLM_MODEL;
    const envApiKey = process.env.NVIDIA_API_KEY || '';

    const defaultTopK = process.env.TOP_K ? Number(process.env.TOP_K) : 5;
    const result = await executeRagQuery({
      queryText: queryText.trim(),
      chatMode: chatMode === 'general' ? 'general' : 'rag',
      topK: topK !== undefined ? Number(topK) : defaultTopK,
      minScore: minScore !== undefined ? Number(minScore) : 0.0,
      apiKey: apiKey || envApiKey,
      llmModel: selLlmModel,
      embeddingModel: selEmbeddingModel,
      chunks,
      embeddings,
      webSearchEnabled: Boolean(webSearchEnabled),
      sessionId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('API /api/pdf/query Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to execute RAG query.' },
      { status: 500 }
    );
  }
}
