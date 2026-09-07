import { getDb } from '@/lib/db/mongodb';
import { ObjectId } from 'mongodb';

export interface ChatSessionMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  citations?: { pageRange?: string; chunkIndex: number; snippet: string }[];
  webCitations?: { title: string; url: string; snippet?: string }[];
  toolsUsed?: string[];
  modelUsed?: string;
  generationTimeMs?: number;
  groundednessScore?: number;
  retrievedChunks?: any[];
  stats?: any;
  assembledPrompt?: any;
}

export interface ChatSessionDocument {
  _id?: ObjectId;
  id?: string;
  userId: string;
  title: string;
  messages: ChatSessionMessage[];
  document?: {
    filename: string;
    cloudinaryUrl?: string;
    cloudinaryPublicId?: string;
    extractionResult?: any;
    chunkingResult?: any;
    embeddingResult?: any;
  };
  pdfMetadata?: {
    filename?: string;
    pageCount?: number;
    chunkCount?: number;
    cloudinaryUrl?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

export async function getChatSessionsCollection() {
  const db = await getDb();
  return db.collection<ChatSessionDocument>('chat_sessions');
}

export async function createChatSession(
  userId: string,
  title: string = 'New Conversation',
  initialMessages: ChatSessionMessage[] = [],
  pdfMetadata?: ChatSessionDocument['pdfMetadata'],
  document?: ChatSessionDocument['document']
): Promise<ChatSessionDocument> {
  const collection = await getChatSessionsCollection();
  const now = new Date();

  const doc: ChatSessionDocument = {
    userId,
    title,
    messages: initialMessages,
    pdfMetadata,
    document,
    createdAt: now,
    updatedAt: now,
  };

  const result = await collection.insertOne(doc as any);
  return {
    ...doc,
    _id: result.insertedId,
    id: result.insertedId.toString(),
  };
}

export async function getUserChatSessions(userId: string): Promise<ChatSessionDocument[]> {
  const collection = await getChatSessionsCollection();
  const sessions = await collection
    .find({ userId })
    .project({
      'document.extractionResult': 0,
      'document.chunkingResult': 0,
      'document.embeddingResult': 0,
    })
    .sort({ updatedAt: -1 })
    .toArray();

  return sessions.map((s: any) => ({
    ...s,
    id: s._id?.toString(),
  })) as ChatSessionDocument[];
}

export async function getChatSessionById(
  sessionId: string,
  userId: string
): Promise<ChatSessionDocument | null> {
  if (!ObjectId.isValid(sessionId)) return null;

  const collection = await getChatSessionsCollection();
  const session = await collection.findOne({
    _id: new ObjectId(sessionId),
    userId,
  });

  if (!session) return null;
  return {
    ...session,
    id: session._id?.toString(),
  };
}

export async function updateChatSession(
  sessionId: string,
  userId: string,
  updates: {
    title?: string;
    messages?: ChatSessionMessage[];
    pdfMetadata?: ChatSessionDocument['pdfMetadata'];
    document?: ChatSessionDocument['document'] | null;
  }
): Promise<boolean> {
  if (!ObjectId.isValid(sessionId)) return false;

  const collection = await getChatSessionsCollection();

  // If document is being detached (set to null), remove it from Cloudinary
  if (updates.document === null) {
    try {
      const session = await collection.findOne({ _id: new ObjectId(sessionId), userId });
      const publicId =
        session?.document?.cloudinaryPublicId ||
        session?.document?.extractionResult?.cloudinaryPublicId;
      const url =
        session?.document?.cloudinaryUrl ||
        session?.pdfMetadata?.cloudinaryUrl;
      const target = publicId || url;

      if (target) {
        const { deletePdfFromCloudinary } = await import('@/lib/storage/cloudinary');
        await deletePdfFromCloudinary(target);
      }
    } catch (cloudErr) {
      console.warn('Failed to delete detached PDF from Cloudinary:', cloudErr);
    }
  }

  const updateFields: any = {
    updatedAt: new Date(),
  };

  if (updates.title !== undefined) updateFields.title = updates.title;
  if (updates.messages !== undefined) updateFields.messages = updates.messages;
  if (updates.pdfMetadata !== undefined) updateFields.pdfMetadata = updates.pdfMetadata;
  if (updates.document !== undefined) updateFields.document = updates.document;

  const result = await collection.updateOne(
    { _id: new ObjectId(sessionId), userId },
    { $set: updateFields }
  );

  return result.matchedCount > 0;
}

export async function deleteChatSession(sessionId: string, userId: string): Promise<boolean> {
  if (!ObjectId.isValid(sessionId)) return false;

  const collection = await getChatSessionsCollection();
  const session = await collection.findOne({
    _id: new ObjectId(sessionId),
    userId,
  });

  if (!session) return false;

  const result = await collection.deleteOne({
    _id: new ObjectId(sessionId),
    userId,
  });

  if (result.deletedCount > 0) {
    // 1. Clear session vectors in MongoDB
    try {
      const { VectorStore } = await import('@/lib/vectordb/store');
      const store = new VectorStore();
      await store.clear({ sessionId, userId });
    } catch (err) {
      console.warn('Failed to clear vectors for deleted session:', err);
    }

    // 2. Delete PDF from Cloudinary
    try {
      const publicId =
        session.document?.cloudinaryPublicId ||
        session.document?.extractionResult?.cloudinaryPublicId;
      const url =
        session.document?.cloudinaryUrl ||
        session.pdfMetadata?.cloudinaryUrl;
      const target = publicId || url;

      if (target) {
        const { deletePdfFromCloudinary } = await import('@/lib/storage/cloudinary');
        await deletePdfFromCloudinary(target);
      }
    } catch (cloudErr) {
      console.warn('Failed to delete PDF from Cloudinary on session deletion:', cloudErr);
    }

    return true;
  }

  return false;
}
