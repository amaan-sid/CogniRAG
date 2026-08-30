import { generateEmbeddings, EmbeddingModel } from '@/lib/embeddings/embedder';
import { VectorStore, VectorSearchResult, VectorRecord } from '@/lib/vectordb/store';

export type LlmModel = string;

export interface RagQueryOptions {
  queryText: string;
  topK?: number;
  minScore?: number;
  apiKey?: string;
  llmModel?: string;
  embeddingModel?: string;
  chunks?: any[];
  embeddings?: any[];
}

export interface RetrievedChunkResult {
  rank: number;
  chunkId: string;
  chunkIndex: number;
  text: string;
  pageRange?: string;
  similarityScore: number;
  isTopMatch: boolean;
}

export interface AssembledPrompt {
  systemPrompt: string;
  userPrompt: string;
  fullPromptText: string;
  estimatedTokens: number;
}

export interface CitationItem {
  pageRange?: string;
  chunkIndex: number;
  snippet: string;
}

export interface SynthesizedAnswer {
  answerText: string;
  citations: CitationItem[];
  modelUsed: string;
  isMock: boolean;
  generationTimeMs: number;
}

export interface RagQueryResult {
  success: boolean;
  queryText: string;
  queryVector: number[];
  queryDimensions: number;
  retrievedChunks: RetrievedChunkResult[];
  assembledPrompt: AssembledPrompt;
  synthesizedAnswer: SynthesizedAnswer;
  stats: {
    step5TimeMs: number;
    step6TimeMs: number;
    step7TimeMs: number;
    totalTimeMs: number;
    topKConfig: number;
    minScoreConfig: number;
  };
  processedAt: string;
}

/**
 * Main End-to-End RAG Query Engine (Steps 5, 6, 7).
 * Strictly searches MongoDB vector DB and responds ONLY using the NVIDIA LLM model configured in environment (.env).
 */
export async function executeRagQuery(options: RagQueryOptions): Promise<RagQueryResult> {
  const overallStartTime = Date.now();
  const defaultTopK = process.env.TOP_K ? Number(process.env.TOP_K) : 5;
  const {
    queryText,
    topK = defaultTopK,
    minScore = 0.0,
    apiKey,
    llmModel,
    embeddingModel,
    chunks = [],
    embeddings = [],
  } = options;

  const nvidiaApiKey = process.env.NVIDIA_API_KEY || apiKey || '';
  const envLlmModel = process.env.LLM_MODEL || llmModel || 'nemotron-3-super-120b-a12b';
  const envEmbeddingModel = process.env.EMBEDDING_MODEL || embeddingModel || 'nemotron-3-embed-1b';

  const llmModelForApi = envLlmModel;

  // Initialize Vector Store (MongoDB)
  const store = new VectorStore();

  // Populate store with provided embeddings or chunks if available
  if (embeddings && embeddings.length > 0) {
    const records: VectorRecord[] = embeddings.map((e) => ({
      id: e.chunkId || `chunk_${e.chunkIndex}`,
      chunkIndex: e.chunkIndex,
      text: e.text,
      pageRange: e.pageRange,
      vector: e.vector,
      estimatedTokens: e.estimatedTokens,
    }));
    await store.upsert(records);
  } else if (chunks && chunks.length > 0) {
    // Generate embeddings on the fly for provided chunks
    const embedRes = await generateEmbeddings({
      chunks,
      apiKey: nvidiaApiKey,
      model: envEmbeddingModel as any,
    });
    const records: VectorRecord[] = embedRes.embeddings.map((e) => ({
      id: e.chunkId,
      chunkIndex: e.chunkIndex,
      text: e.text,
      pageRange: e.pageRange,
      vector: e.vector,
      estimatedTokens: e.estimatedTokens,
    }));
    await store.upsert(records);
  }

  // --- STEP 5: Question -> Query Embedding ---
  const step5Start = Date.now();
  const queryEmbedResult = await generateEmbeddings({
    chunks: [{ id: 'query_1', index: 0, text: queryText }],
    apiKey: nvidiaApiKey,
    model: envEmbeddingModel as any,
  });
  const queryVector = queryEmbedResult.embeddings[0]?.vector || [];
  if (!queryVector || queryVector.length === 0) {
    throw new Error('Failed to generate query embedding using NVIDIA embedding API.');
  }
  const queryDimensions = queryVector.length;
  const step5TimeMs = Date.now() - step5Start;

  // --- STEP 6: Vector Search & Top-K Retrieval from MongoDB ---
  const step6Start = Date.now();
  const searchResults: VectorSearchResult[] = await store.search(queryVector, topK, minScore);

  const retrievedChunks: RetrievedChunkResult[] = searchResults.map((res, idx) => ({
    rank: idx + 1,
    chunkId: res.id,
    chunkIndex: res.chunkIndex,
    text: res.text,
    pageRange: res.pageRange,
    similarityScore: res.similarityScore,
    isTopMatch: idx === 0,
  }));
  const step6TimeMs = Date.now() - step6Start;

  // --- STEP 7: Context + Question -> NVIDIA LLM Synthesis ---
  const step7Start = Date.now();

  // Assemble Context Block
  const contextBlock = retrievedChunks
    .map((c) => `[Document Chunk #${c.chunkIndex} | ${c.pageRange || 'Page 1'}]\n${c.text}`)
    .join('\n\n---\n\n');

  const systemPrompt = `You are a helpful, precise RAG AI assistant. Answer the user's question using ONLY the provided document context below. If the context does not contain the answer, state clearly that the document does not mention it. Always include exact source page and chunk citations (e.g. [Page 1, Chunk #2]) when referencing facts.`;

  const userPrompt = `DOCUMENT CONTEXT:\n${contextBlock || 'No relevant context found.'}\n\nUSER QUESTION:\n${queryText}`;

  const fullPromptText = `${systemPrompt}\n\n${userPrompt}`;
  const contextTokens = Math.ceil(fullPromptText.length / 4);

  const assembledPrompt: AssembledPrompt = {
    systemPrompt,
    userPrompt,
    fullPromptText,
    estimatedTokens: contextTokens,
  };

  if (!nvidiaApiKey) {
    throw new Error('NVIDIA_API_KEY is missing in environment variables (.env).');
  }

  const temperature = process.env.LLM_TEMPERATURE !== undefined ? Number(process.env.LLM_TEMPERATURE) : 1;
  const top_p = process.env.LLM_TOP_P !== undefined ? Number(process.env.LLM_TOP_P) : 0.95;

  const url = 'https://integrate.api.nvidia.com/v1/chat/completions';
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${nvidiaApiKey}`,
    },
    body: JSON.stringify({
      model: llmModelForApi,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      top_p,
      max_tokens: 8192,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    throw new Error(`NVIDIA API call failed with status ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const answerText = data.choices?.[0]?.message?.content;

  if (!answerText) {
    throw new Error('NVIDIA LLM API returned empty response content.');
  }

  const citations: CitationItem[] = retrievedChunks.map((c) => ({
    pageRange: c.pageRange,
    chunkIndex: c.chunkIndex,
    snippet: c.text.substring(0, 100) + '...',
  }));

  const synthesizedAnswer: SynthesizedAnswer = {
    answerText,
    citations,
    modelUsed: `${llmModelForApi} (NVIDIA NIM Live)`,
    isMock: false,
    generationTimeMs: Date.now() - step7Start,
  };

  const step7TimeMs = Date.now() - step7Start;
  const totalTimeMs = Date.now() - overallStartTime;

  return {
    success: true,
    queryText,
    queryVector,
    queryDimensions,
    retrievedChunks,
    assembledPrompt,
    synthesizedAnswer,
    stats: {
      step5TimeMs,
      step6TimeMs,
      step7TimeMs,
      totalTimeMs,
      topKConfig: topK,
      minScoreConfig: minScore,
    },
    processedAt: new Date().toISOString(),
  };
}

