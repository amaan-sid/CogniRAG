import { getDb } from '@/lib/db/mongodb';
import bcrypt from 'bcryptjs';
import { MongoServerError, ObjectId } from 'mongodb';

export interface UserDocument {
  _id?: ObjectId;
  id?: string;
  name: string;
  username: string;
  email: string;
  passwordHash: string;
  gender?: string;
  profilePic?: string;
  createdAt: Date;
  updatedAt?: Date;
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
      !(error instanceof MongoServerError && error.codeName === 'IndexAlreadyExists')
    ) {
      console.warn('Could not create email index:', error);
    }
  }

  try {
    await collection.createIndex(
      { username: 1 },
      {
        unique: true,
        name: 'username_unique',
        sparse: true,
      }
    );
  } catch (error) {
    if (
      !(error instanceof MongoServerError && error.codeName === 'IndexAlreadyExists')
    ) {
      console.warn('Could not create username index:', error);
    }
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

export async function findUserByUsername(
  username: string
): Promise<UserDocument | null> {
  const collection = await getUsersCollection();

  return collection.findOne({
    username: username.toLowerCase().trim(),
  });
}

export async function findUserById(
  id: string
): Promise<UserDocument | null> {
  const collection = await getUsersCollection();

  if (!ObjectId.isValid(id)) {
    return null;
  }

  return collection.findOne({
    _id: new ObjectId(id),
  });
}

export async function findUserByEmailOrUsername(
  identifier: string
): Promise<UserDocument | null> {
  const collection = await getUsersCollection();
  const normalized = identifier.toLowerCase().trim();

  return collection.findOne({
    $or: [{ email: normalized }, { username: normalized }],
  });
}

export async function createUser(
  name: string,
  email: string,
  password: string,
  username: string,
  gender?: string,
  profilePic?: string
): Promise<UserDocument> {
  const collection = await getUsersCollection();

  const normalizedEmail = email.toLowerCase().trim();
  const normalizedUsername = username.toLowerCase().trim();

  // Validate username format
  if (!normalizedUsername || normalizedUsername.length < 3) {
    throw new Error('Username must be at least 3 characters long.');
  }
  if (!/^[a-zA-Z0-9_.-]+$/.test(normalizedUsername)) {
    throw new Error('Username can only contain letters, numbers, periods, underscores, and hyphens.');
  }

  const existingEmail = await collection.findOne({
    email: normalizedEmail,
  });

  if (existingEmail) {
    throw new Error(
      'An account with this email address already exists.'
    );
  }

  const existingUsername = await collection.findOne({
    username: normalizedUsername,
  });

  if (existingUsername) {
    throw new Error(
      'This username is already taken. Please choose another username.'
    );
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(password, salt);

  const newUser: UserDocument = {
    name: name.trim(),
    username: normalizedUsername,
    email: normalizedEmail,
    passwordHash,
    gender: gender?.trim() || 'male',
    profilePic: profilePic || '',
    createdAt: new Date(),
    updatedAt: new Date(),
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
      if (error.keyPattern?.username || error.message?.includes('username')) {
        throw new Error('This username is already taken.');
      }
      throw new Error(
        'An account with this email address already exists.'
      );
    }

    throw error;
  }
}

export async function updateUserProfile(
  userId: string,
  updates: {
    name?: string;
    username?: string;
    gender?: string;
    profilePic?: string;
  }
): Promise<UserDocument> {
  const collection = await getUsersCollection();

  if (!ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID.');
  }

  const objectId = new ObjectId(userId);
  const existingUser = await collection.findOne({ _id: objectId });

  if (!existingUser) {
    throw new Error('User not found.');
  }

  const updateFields: Partial<UserDocument> = {
    updatedAt: new Date(),
  };

  if (updates.name !== undefined) {
    const trimmedName = updates.name.trim();
    if (trimmedName.length < 2) {
      throw new Error('Display name must be at least 2 characters long.');
    }
    updateFields.name = trimmedName;
  }

  if (updates.username !== undefined) {
    const normalizedUsername = updates.username.toLowerCase().trim();
    if (normalizedUsername.length < 3) {
      throw new Error('Username must be at least 3 characters long.');
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(normalizedUsername)) {
      throw new Error('Username can only contain letters, numbers, periods, underscores, and hyphens.');
    }

    if (normalizedUsername !== existingUser.username) {
      const usernameTaken = await collection.findOne({
        username: normalizedUsername,
        _id: { $ne: objectId },
      });
      if (usernameTaken) {
        throw new Error('This username is already taken. Please choose another username.');
      }
      updateFields.username = normalizedUsername;
    }
  }

  if (updates.gender !== undefined) {
    // Only allow setting gender if not already selected/set
    if (!existingUser.gender || existingUser.gender.trim() === '') {
      updateFields.gender = updates.gender.trim() || 'male';
    }
  }

  if (updates.profilePic !== undefined) {
    updateFields.profilePic = updates.profilePic;
  }

  await collection.updateOne(
    { _id: objectId },
    { $set: updateFields }
  );

  const updatedUser = await collection.findOne({ _id: objectId });
  if (!updatedUser) {
    throw new Error('Failed to retrieve updated user profile.');
  }

  return {
    ...updatedUser,
    id: updatedUser._id.toString(),
  };
}

export async function updateUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const collection = await getUsersCollection();

  if (!ObjectId.isValid(userId)) {
    throw new Error('Invalid user ID.');
  }

  const objectId = new ObjectId(userId);
  const user = await collection.findOne({ _id: objectId });

  if (!user) {
    throw new Error('User not found.');
  }

  const isCurrentValid = await verifyPassword(currentPassword, user.passwordHash);
  if (!isCurrentValid) {
    throw new Error('Current password is incorrect.');
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error('New password must be at least 6 characters long.');
  }

  const salt = await bcrypt.genSalt(10);
  const newPasswordHash = await bcrypt.hash(newPassword, salt);

  await collection.updateOne(
    { _id: objectId },
    {
      $set: {
        passwordHash: newPasswordHash,
        updatedAt: new Date(),
      },
    }
  );
}

export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  return bcrypt.compare(password, passwordHash);
}