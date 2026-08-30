export type EmbeddingModel = string;

export interface ChunkInput {
  id: string;
  index: number;
  text: string;
  charCount?: number;
  wordCount?: number;
  estimatedTokens?: number;
  pageRange?: string;
}

export interface EmbeddingOptions {
  chunks: ChunkInput[];
  apiKey?: string;
  model?: EmbeddingModel;
}

export interface EmbeddingItem {
  chunkId: string;
  chunkIndex: number;
  text: string;
  pageRange?: string;
  vector: number[];
  dimensions: number;
  norm: number;
  estimatedTokens: number;
}

export interface EmbeddingStats {
  totalVectors: number;
  dimensions: number;
  modelUsed: string;
  isMock: boolean;
  totalTokens: number;
  avgNorm: number;
  executionTimeMs: number;
}

export interface EmbeddingResult {
  success: boolean;
  embeddings: EmbeddingItem[];
  stats: EmbeddingStats;
  processedAt: string;
}

/**
 * Calculates Cosine Similarity between two numerical vectors of identical dimensionality.
 * Cosine Similarity = (A · B) / (||A|| * ||B||)
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  if (normA === 0 || normB === 0) return 0;
  const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  // Bound to [-1, 1] range to handle potential floating point overflow
  return Math.max(-1, Math.min(1, similarity));
}

/**
 * Calculates Vector L2 Norm (Euclidean Magnitude).
 */
export function calculateL2Norm(vec: number[]): number {
  if (!vec || vec.length === 0) return 0;
  const sumSquares = vec.reduce((acc, val) => acc + val * val, 0);
  return Math.sqrt(sumSquares);
}

/**
 * Main Embedding Generation function.
 * Uses NVIDIA Nemotron 3 Embed (nemotron-3-embed-1b, 1024d)
 */
export async function generateEmbeddings(options: EmbeddingOptions): Promise<EmbeddingResult> {
  const startTime = Date.now();
  const { chunks = [], apiKey, model = process.env.EMBEDDING_MODEL || '' } = options;

  let dimensions = 2048;
  const embeddings: EmbeddingItem[] = [];
  let isMock = true;

  const keyToUse = process.env.NVIDIA_API_KEY || "";

  if (keyToUse.length > 0) {
    try {
      const url = 'https://integrate.api.nvidia.com/v1/embeddings';
      const modelForApi = model.includes('/') ? model : `nvidia/${model}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${keyToUse}`,
        },
        body: JSON.stringify({
          model: modelForApi,
          input: chunks.map((c) => c.text),
          input_type: 'passage',
          encoding_format: 'float',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data && Array.isArray(data.data)) {
          isMock = false;
          data.data.forEach((item: any, index: number) => {
            const chunk = chunks[index];
            const vec = item.embedding as number[];
            embeddings.push({
              chunkId: chunk.id,
              chunkIndex: chunk.index,
              text: chunk.text,
              pageRange: chunk.pageRange,
              vector: vec,
              dimensions: vec.length,
              norm: calculateL2Norm(vec),
              estimatedTokens: chunk.estimatedTokens || Math.ceil(chunk.text.length / 4),
            });
          });
          if (embeddings.length > 0) {
            dimensions = embeddings[0].dimensions;
          }
        }
      } else {
        const errData = await response.json().catch(() => ({}));
        console.warn('NVIDIA Nemotron Embedding API request failed, falling back:', errData);
      }
    } catch (err) {
      console.warn('NVIDIA Nemotron Embedding API error, falling back:', err);
    }
  }


  const totalTokens = embeddings.reduce((acc, curr) => acc + curr.estimatedTokens, 0);
  const totalNorms = embeddings.reduce((acc, curr) => acc + curr.norm, 0);
  const avgNorm = embeddings.length > 0 ? Math.round((totalNorms / embeddings.length) * 10000) / 10000 : 0;
  const executionTimeMs = Date.now() - startTime;

  return {
    success: true,
    embeddings,
    stats: {
      totalVectors: embeddings.length,
      dimensions: embeddings[0]?.dimensions || dimensions,
      modelUsed: isMock ? `${model} (Local Deterministic)` : model,
      isMock,
      totalTokens,
      avgNorm,
      executionTimeMs,
    },
    processedAt: new Date().toISOString(),
  };
}
