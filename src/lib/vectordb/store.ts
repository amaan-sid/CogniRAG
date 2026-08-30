export interface VectorRecord {
  id: string;
  vector: number[];
  chunkIndex: number;
  text: string;
  pageRange?: string;
  estimatedTokens?: number;
  metadata?: Record<string, any>;
}

export interface VectorSearchResult {
  id: string;
  chunkIndex: number;
  text: string;
  pageRange?: string;
  vector: number[];
  similarityScore: number;
  estimatedTokens?: number;
  metadata?: Record<string, any>;
}

export interface VectorStoreStats {
  collectionName: string;
  indexType: string;
  totalVectors: number;
  dimensions: number;
  memorySizeBytes: number;
  indexStatus: 'ready' | 'empty' | 'indexing';
  lastIndexedAt?: string;
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

export class VectorStore {
  private collectionName: string;
  private indexType: string;
  private lastIndexedAt?: string;

  constructor(
    collectionName: string = process.env.MONGODB_VECTOR_COLLECTION || 'vectors',
    indexType: string = 'MongoDB Vector DB'
  ) {
    this.collectionName = collectionName;
    this.indexType = indexType;
  }

  private async getCollection() {
    if (typeof window !== 'undefined') {
      throw new Error('MongoDB operations can only be executed on the server side.');
    }
    const { getDb } = await import('@/lib/db/mongodb');
    const db = await getDb();
    return db.collection(this.collectionName);
  }

  /**
   * Insert or update vector records in MongoDB Vector DB.
   */
  public async upsert(records: VectorRecord[]): Promise<number> {
    if (!records || records.length === 0) return 0;

    // Client-side delegation to server API route
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/pdf/vectordb', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'upsert', records }),
        });
        const data = await res.json();
        return data.upsertedCount || records.length;
      } catch (err) {
        console.error('Client vector DB upsert error:', err);
        return 0;
      }
    }

    const collection = await this.getCollection();
    this.lastIndexedAt = new Date().toISOString();

    const operations: any[] = records.map((record) => ({
      updateOne: {
        filter: { _id: record.id },
        update: {
          $set: {
            _id: record.id,
            vector: record.vector,
            chunkIndex: record.chunkIndex,
            text: record.text,
            pageRange: record.pageRange || 'Page 1',
            estimatedTokens: record.estimatedTokens || 0,
            metadata: record.metadata || {},
            updatedAt: new Date(),
          },
        },
        upsert: true,
      },
    }));

    await collection.bulkWrite(operations);
    console.log(`Successfully upserted ${records.length} records to MongoDB collection "${this.collectionName}".`);
    return records.length;
  }

  /**
   * Execute Top-K Cosine Similarity Search on MongoDB Vector DB.
   * Tries MongoDB Atlas $vectorSearch first, falling back to exact vector cosine ranking.
   */
  public async search(
    queryVector: number[],
    topK: number = 5,
    minScoreThreshold: number = 0.0
  ): Promise<VectorSearchResult[]> {
    if (!queryVector || queryVector.length === 0) {
      return [];
    }

    // Client-side delegation to server API route
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/pdf/vectordb', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'search', queryVector, topK, minScore: minScoreThreshold }),
        });
        const data = await res.json();
        return data.results || [];
      } catch (err) {
        console.error('Client vector DB search error:', err);
        return [];
      }
    }

    const collection = await this.getCollection();
    const indexName = process.env.MONGODB_VECTOR_INDEX || 'vector_index';

    // 1. Try native MongoDB Atlas $vectorSearch aggregation pipeline
    try {
      const pipeline = [
        {
          $vectorSearch: {
            index: indexName,
            path: 'vector',
            queryVector: queryVector,
            numCandidates: Math.max(topK * 10, 50),
            limit: topK,
          },
        },
        {
          $project: {
            _id: 1,
            chunkIndex: 1,
            text: 1,
            pageRange: 1,
            vector: 1,
            estimatedTokens: 1,
            metadata: 1,
            similarityScore: { $meta: 'vectorSearchScore' },
          },
        },
      ];

      const docs = await collection.aggregate(pipeline).toArray();

      if (docs && docs.length > 0) {
        return docs
          .filter((d: any) => (d.similarityScore ?? 0) >= minScoreThreshold)
          .map((d: any) => ({
            id: String(d._id),
            chunkIndex: Number(d.chunkIndex ?? 0),
            text: String(d.text ?? ''),
            pageRange: d.pageRange ? String(d.pageRange) : undefined,
            vector: d.vector || [],
            similarityScore: Math.round((d.similarityScore ?? 0) * 10000) / 10000,
            estimatedTokens: d.estimatedTokens ? Number(d.estimatedTokens) : undefined,
            metadata: d.metadata || {},
          }));
      }
    } catch (atlasErr) {
      console.warn(
        `Atlas $vectorSearch failed or index "${indexName}" not configured. Falling back to exact vector cosine similarity calculation on MongoDB.`
      );
    }

    // 2. Fallback: Exact Cosine Similarity ranking over MongoDB documents
    const docs = await collection.find({}).toArray();
    if (!docs || docs.length === 0) {
      return [];
    }

    const scoredResults: VectorSearchResult[] = [];

    for (const doc of docs) {
      const docVector: number[] = doc.vector || [];
      if (docVector.length === 0) continue;

      const sim = cosineSimilarity(queryVector, docVector);
      if (sim >= minScoreThreshold) {
        scoredResults.push({
          id: String(doc._id),
          chunkIndex: Number(doc.chunkIndex ?? 0),
          text: String(doc.text ?? ''),
          pageRange: doc.pageRange ? String(doc.pageRange) : undefined,
          vector: docVector,
          similarityScore: Math.round(sim * 10000) / 10000,
          estimatedTokens: doc.estimatedTokens ? Number(doc.estimatedTokens) : undefined,
          metadata: doc.metadata || {},
        });
      }
    }

    scoredResults.sort((a, b) => b.similarityScore - a.similarityScore);
    return scoredResults.slice(0, topK);
  }

  /**
   * Retrieve MongoDB collection statistics and vector count.
   */
  public async getStats(): Promise<VectorStoreStats> {
    if (typeof window !== 'undefined') {
      try {
        const res = await fetch('/api/pdf/vectordb', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'stats' }),
        });
        const data = await res.json();
        if (data.success && data.stats) {
          return data.stats;
        }
      } catch (err) {
        console.error('Client vector DB getStats error:', err);
      }
      return {
        collectionName: this.collectionName,
        indexType: `MongoDB Vector DB (${this.collectionName})`,
        totalVectors: 0,
        dimensions: 1024,
        memorySizeBytes: 0,
        indexStatus: 'empty',
      };
    }

    let totalVectors = 0;
    let dimensions = 1024;
    try {
      const collection = await this.getCollection();
      totalVectors = await collection.countDocuments();
      const sampleDoc = await collection.findOne({}, { projection: { vector: 1 } });
      if (sampleDoc && Array.isArray(sampleDoc.vector) && sampleDoc.vector.length > 0) {
        dimensions = sampleDoc.vector.length;
      }
    } catch (err) {
      console.warn('MongoDB getStats count failed:', err);
    }

    const memorySizeBytes = totalVectors * dimensions * 8;

    return {
      collectionName: this.collectionName,
      indexType: `MongoDB Vector DB (${this.collectionName})`,
      totalVectors,
      dimensions,
      memorySizeBytes,
      indexStatus: totalVectors > 0 ? 'ready' : 'empty',
      lastIndexedAt: this.lastIndexedAt,
    };
  }

  /**
   * Return empty array as records are stored remotely in MongoDB Vector DB.
   */
  public getAllRecords(): VectorRecord[] {
    return [];
  }

  /**
   * Clear collection records directly in MongoDB index.
   */
  public async clear(): Promise<void> {
    if (typeof window !== 'undefined') {
      try {
        await fetch('/api/pdf/vectordb', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clear' }),
        });
      } catch (err) {
        console.error('Client vector DB clear error:', err);
      }
      return;
    }

    try {
      const collection = await this.getCollection();
      await collection.deleteMany({});
      console.log(`Cleared all records from MongoDB collection "${this.collectionName}".`);
    } catch (err) {
      console.warn('MongoDB deleteMany failed:', err);
    }
  }
}

// Global Singleton Instance for Vector Store interaction
export const globalVectorStore = new VectorStore();

