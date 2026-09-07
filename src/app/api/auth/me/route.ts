import { NextRequest, NextResponse } from 'next/server';
import { verifyJwtToken, extractAuthToken } from '@/lib/auth/jwt';
import { findUserById } from '@/lib/auth/userModel';

export async function GET(req: NextRequest) {
  try {
    const token = extractAuthToken(req);

    if (!token) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    const payload = verifyJwtToken(token);

    if (!payload) {
      return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
    }

    const userDoc = await findUserById(payload.userId);

    const user = {
      userId: payload.userId,
      name: userDoc?.name || payload.name,
      email: userDoc?.email || payload.email,
      username: userDoc?.username || payload.username || (payload.email ? payload.email.split('@')[0] : 'user'),
      gender: userDoc?.gender ?? payload.gender ?? '',
      profilePic: userDoc?.profilePic || '',
    };

    return NextResponse.json({
      authenticated: true,
      user,
    });
  } catch (error) {
    return NextResponse.json({ authenticated: false, user: null }, { status: 401 });
  }
}
