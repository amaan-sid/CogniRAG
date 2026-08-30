import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || '';
export const AUTH_COOKIE_NAME = 'rag_auth_token';

export interface UserTokenPayload {
  userId: string;
  name: string;
  email: string;
}

export function signJwtToken(payload: UserTokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyJwtToken(token: string): UserTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserTokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}
