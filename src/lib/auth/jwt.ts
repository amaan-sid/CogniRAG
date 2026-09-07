import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.NEXTAUTH_SECRET || '';
export const AUTH_COOKIE_NAME = 'token';

export interface UserTokenPayload {
  userId: string;
  name: string;
  email: string;
  username: string;
  gender?: string;
}

export function signJwtToken(payload: UserTokenPayload): string {
  const tokenPayload: UserTokenPayload = {
    userId: payload.userId,
    name: payload.name,
    email: payload.email,
    username: payload.username,
    gender: payload.gender,
  };
  return jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyJwtToken(token: string): UserTokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as UserTokenPayload;
    return decoded;
  } catch (error) {
    return null;
  }
}

export function extractAuthToken(req: any): string | null {
  // 1. Try NextRequest cookies object ('token' or fallback 'rag_auth_token')
  const cookieVal = req.cookies?.get?.('token')?.value || req.cookies?.get?.('rag_auth_token')?.value;
  if (cookieVal) return cookieVal;

  // 2. Try raw Cookie header
  const cookieHeader = req.headers?.get?.('cookie');
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)(?:token|rag_auth_token)=([^;]*)/);
    if (match) return decodeURIComponent(match[1]);
  }

  // 3. Try Authorization: Bearer <token>
  const authHeader = req.headers?.get?.('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    return authHeader.substring(7).trim();
  }

  return null;
}
