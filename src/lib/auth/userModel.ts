import { getDb } from '@/lib/db/mongodb';
import bcrypt from 'bcryptjs';
import { MongoServerError, ObjectId } from 'mongodb';

export interface UserDocument {
  _id?: ObjectId;
  id?: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

let indexesInitialized: Promise<void> | undefined;

async function initializeUserIndexes() {
  const db = await getDb();
  const collection = db.collection<UserDocument>('users');

  try {
    await collection.createIndex(
      { email: 1 },
      {
        unique: true,
        name: 'email_unique',
      }
    );
  } catch (error) {
    if (
      error instanceof MongoServerError &&
      error.codeName === 'IndexAlreadyExists'
    ) {
      return;
    }

    throw error;
  }
}

export async function getUsersCollection() {
  const db = await getDb();

  if (!indexesInitialized) {
    indexesInitialized = initializeUserIndexes();
  }

  await indexesInitialized;

  return db.collection<UserDocument>('users');
}

export async function findUserByEmail(
  email: string
): Promise<UserDocument | null> {
  const collection = await getUsersCollection();

  return collection.findOne({
    email: email.toLowerCase().trim(),
  });
}

export async function createUser(
  name: string,
  email: string,
  password: string
): Promise<UserDocument> {
  const collection = await getUsersCollection();

  const normalizedEmail = email.toLowerCase().trim();

  const existing = await collection.findOne({
    email: normalizedEmail,
  });

  if (existing) {
    throw new Error(
      'An account with this email address already exists.'
    );
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const newUser: UserDocument = {
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    createdAt: new Date(),
  };

  try {
    const result = await collection.insertOne(newUser);

    return {
      ...newUser,
      _id: result.insertedId,
      id: result.insertedId.toString(),
    };
  } catch (error) {
    if (
      error instanceof MongoServerError &&
      error.code === 11000
    ) {
      throw new Error(
        'An account with this email address already exists.'
      );
    }

    throw error;
  }
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}