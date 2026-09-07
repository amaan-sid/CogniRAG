import { generateEmbeddings } from '@/lib/embeddings/embedder';
import { VectorStore, VectorSearchResult, VectorRecord } from '@/lib/vectordb/store';

export interface InternalSearchChunkResult {
  rank: number;
  chunkId: string;
  chunkIndex: number;
  text: string;
  pageRange?: string;
  similarityScore: number;
  isTopMatch: boolean;
  snippet: string;
}

export interface InternalSearchOutput {
  success: boolean;
  query: string;
  results: InternalSearchChunkResult[];
  message?: string;
  error?: string;
}

export interface InternalSearchOptions {
  topK?: number;
  minScore?: number;
  chunks?: any[];
  embeddings?: any[];
  apiKey?: string;
  embeddingModel?: string;
  sessionId?: string;
}

function dotProduct(a: number[], b: number[]): number {
  let sum = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

function magnitude(vec: number[]): number {
  let sum = 0;
  for (let i = 0; i < vec.length; i++) {
    sum += vec[i] * vec[i];
  }
  return Math.sqrt(sum);
}

function cosineSimilarity(a: number[], b: number[]): number {
  const magA = magnitude(a);
  const magB = magnitude(b);
  if (magA === 0 || magB === 0) return 0;
  return dotProduct(a, b) / (magA * magB);
}

/**
 * Searches the application's internal documents and knowledge base (MongoDB Vector Store)
 * using 1024d Nemotron vector embeddings, strictly isolated by chat session.
 */
export async function internalSearch(
  query: string,
  options: InternalSearchOptions = {}
): Promise<InternalSearchOutput> {
  const {
    topK = 5,
    minScore = 0.0,
    chunks = [],
    embeddings = [],
    apiKey,
    embeddingModel,
    sessionId,
  } = options;

  const nvidiaApiKey = process.env.NVIDIA_API_KEY || apiKey || '';
  const rawEmbeddingModel = process.env.EMBEDDING_MODEL || embeddingModel || 'nvidia/nemotron-3-embed-1b';
  const envEmbeddingModel = rawEmbeddingModel.includes('/') ? rawEmbeddingModel : `nvidia/${rawEmbeddingModel}`;

  try {
    const store = new VectorStore();

    // If neither embeddings nor chunks were passed, and no sessionId provided, warn that no document is attached
    if ((!embeddings || embeddings.length === 0) && (!chunks || chunks.length === 0) && !sessionId) {
      return {
        success: true,
        query,
        results: [],
        message: 'No document is attached to this chat session. Please upload a PDF or switch to a session with an attached document.',
      };
    }

    // Upsert any in-flight document embeddings or chunks if provided, tagged with sessionId
    if (embeddings && embeddings.length > 0) {
      const records: VectorRecord[] = embeddings.map((e) => ({
        id: `${sessionId ? sessionId + '_' : ''}${e.chunkId || `chunk_${e.chunkIndex}`}`,
        chunkIndex: e.chunkIndex,
        text: e.text,
        pageRange: e.pageRange,
        vector: e.vector,
        estimatedTokens: e.estimatedTokens,
        sessionId,
      }));
      await store.upsert(records);
    } else if (chunks && chunks.length > 0) {
      const embedRes = await generateEmbeddings({
        chunks,
        apiKey: nvidiaApiKey,
        model: envEmbeddingModel as any,
      });
      const records: VectorRecord[] = embedRes.embeddings.map((e) => ({
        id: `${sessionId ? sessionId + '_' : ''}${e.chunkId || `chunk_${e.chunkIndex}`}`,
        chunkIndex: e.chunkIndex,
        text: e.text,
        pageRange: e.pageRange,
        vector: e.vector,
        estimatedTokens: e.estimatedTokens,
        sessionId,
      }));
      await store.upsert(records);
    }

    // Step 1: Generate embedding for search query
    const queryEmbedResult = await generateEmbeddings({
      chunks: [{ id: 'search_query', index: 0, text: query }],
      apiKey: nvidiaApiKey,
      model: envEmbeddingModel as any,
    });

    const queryVector = queryEmbedResult.embeddings[0]?.vector || [];
    if (!queryVector || queryVector.length === 0) {
      return {
        success: false,
        query,
        results: [],
        error: 'Failed to generate vector embedding for the internal search query.',
      };
    }

    // Step 2: Search with strict session isolation
    let searchResults: VectorSearchResult[] = [];

    if (embeddings && embeddings.length > 0) {
      // Direct in-memory cosine ranking over this session's own document embeddings
      searchResults = embeddings
        .filter((e) => Array.isArray(e.vector) && e.vector.length > 0)
        .map((e) => {
          const sim = cosineSimilarity(queryVector, e.vector);
          return {
            id: String(e.chunkId || `chunk_${e.chunkIndex}`),
            chunkIndex: Number(e.chunkIndex ?? 0),
            text: String(e.text ?? ''),
            pageRange: e.pageRange ? String(e.pageRange) : undefined,
            vector: e.vector,
            similarityScore: Math.round(sim * 10000) / 10000,
            estimatedTokens: e.estimatedTokens ? Number(e.estimatedTokens) : undefined,
          };
        })
        .filter((r) => r.similarityScore >= minScore)
        .sort((a, b) => b.similarityScore - a.similarityScore)
        .slice(0, topK);
    } else {
      // Fallback to MongoDB Vector Store with sessionId filter
      searchResults = await store.search(
        queryVector,
        topK,
        minScore,
        sessionId ? { sessionId } : undefined
      );
    }

    if (!searchResults || searchResults.length === 0) {
      return {
        success: true,
        query,
        results: [],
        message: 'No matching document chunks found for this query in the current document.',
      };
    }

    const formattedResults: InternalSearchChunkResult[] = searchResults.map((res, idx) => ({
      rank: idx + 1,
      chunkId: res.id,
      chunkIndex: res.chunkIndex,
      text: res.text,
      pageRange: res.pageRange,
      similarityScore: res.similarityScore,
      isTopMatch: idx === 0,
      snippet: res.text.length > 200 ? res.text.substring(0, 200).trim() + '...' : res.text,
    }));

    return {
      success: true,
      query,
      results: formattedResults,
    };
  } catch (error: any) {
    console.error('internalSearch error:', error);
    return {
      success: false,
      query,
      results: [],
      error: error.message || 'Internal document search failed.',
    };
  }
}
