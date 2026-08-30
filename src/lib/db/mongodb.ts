import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGODB_URI;

interface GlobalMongo {
  _mongoClientPromise?: Promise<MongoClient>;
}

declare const globalThis: GlobalMongo;

let clientPromise: Promise<MongoClient>;

if (!uri) {
  console.warn('MONGODB_URI is not set in environment variables.');
  clientPromise = Promise.reject(new Error('MONGODB_URI environment variable is missing'));
} else {
  if (process.env.NODE_ENV === 'development') {
    if (!globalThis._mongoClientPromise) {
      const client = new MongoClient(uri);
      globalThis._mongoClientPromise = client.connect();
    }
    clientPromise = globalThis._mongoClientPromise;
  } else {
    const client = new MongoClient(uri);
    clientPromise = client.connect();
  }
}

export async function getDb(): Promise<Db> {
  if (!uri) {
    throw new Error('MongoDB connection failed: MONGODB_URI is missing');
  }
  const mongoClient = await clientPromise;
  return mongoClient.db();
}

export default clientPromise;
