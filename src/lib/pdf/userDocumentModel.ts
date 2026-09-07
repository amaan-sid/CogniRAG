import { getDb } from '@/lib/db/mongodb';
import { ObjectId } from 'mongodb';

export interface UserDocumentRecord {
  _id?: ObjectId;
  id?: string;
  userId: string;
  filename: string;
  cloudinaryUrl?: string;
  cloudinaryPublicId?: string;
  extractionResult: any;
  chunkingResult: any;
  embeddingResult: any;
  updatedAt: Date;
}

export async function getUserDocumentsCollection() {
  const db = await getDb();
  return db.collection<UserDocumentRecord>('user_documents');
}

/**
 * Saves or updates the user's latest active document in MongoDB.
 */
export async function saveUserActiveDocument(
  userId: string,
  docData: {
    filename: string;
    cloudinaryUrl?: string;
    cloudinaryPublicId?: string;
    extractionResult: any;
    chunkingResult: any;
    embeddingResult: any;
  }
): Promise<UserDocumentRecord> {
  const collection = await getUserDocumentsCollection();
  const now = new Date();

  const query = { userId };
  const update = {
    $set: {
      userId,
      filename: docData.filename,
      cloudinaryUrl: docData.cloudinaryUrl,
      cloudinaryPublicId: docData.cloudinaryPublicId,
      extractionResult: docData.extractionResult,
      chunkingResult: docData.chunkingResult,
      embeddingResult: docData.embeddingResult,
      updatedAt: now,
    },
  };

  await collection.updateOne(query, update, { upsert: true });

  const saved = await collection.findOne({ userId });
  return {
    ...saved!,
    id: saved!._id?.toString(),
  };
}

/**
 * Retrieves the user's latest active document across logins.
 */
export async function getUserActiveDocument(
  userId: string
): Promise<UserDocumentRecord | null> {
  const collection = await getUserDocumentsCollection();
  const doc = await collection.findOne({ userId }, { sort: { updatedAt: -1 } });

  if (!doc) return null;
  return {
    ...doc,
    id: doc._id?.toString(),
  };
}
