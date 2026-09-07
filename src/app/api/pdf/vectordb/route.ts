import { NextRequest, NextResponse } from 'next/server';
import { globalVectorStore, VectorRecord } from '@/lib/vectordb/store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action = 'upsert', records } = body;

    if (action === 'clear') {
      const { sessionId, userId, filter } = body;
      const targetFilter = filter || (sessionId || userId ? { sessionId, userId } : undefined);
      await globalVectorStore.clear(targetFilter);
      return NextResponse.json({
        success: true,
        message: targetFilter?.sessionId
          ? `Vector database cleared for session ${targetFilter.sessionId}.`
          : 'Vector database collection cleared.',
      });
    }

    if (action === 'stats') {
      const stats = await globalVectorStore.getStats();
      return NextResponse.json({ success: true, stats });
    }

    if (action === 'search') {
      const { queryVector, topK = process.env.TOP_K || 5, minScore = 0.0, filter, sessionId, userId } = body;
      const searchFilter = filter || (sessionId || userId ? { sessionId, userId } : undefined);
      const results = await globalVectorStore.search(queryVector, topK, minScore, searchFilter);
      return NextResponse.json({ success: true, results });
    }

    if (!records || !Array.isArray(records)) {
      return NextResponse.json(
        { success: false, error: 'Array of "records" is required for upsert.' },
        { status: 400 }
      );
    }

    const count = await globalVectorStore.upsert(records as VectorRecord[]);
    const stats = await globalVectorStore.getStats();

    return NextResponse.json({
      success: true,
      upsertedCount: count,
      stats,
    });
  } catch (error: any) {
    console.error('API /api/pdf/vectordb Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process vector database operation.' },
      { status: 500 }
    );
  }
}
