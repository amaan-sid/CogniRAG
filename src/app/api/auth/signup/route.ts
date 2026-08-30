import { NextRequest, NextResponse } from 'next/server';
import { createUser } from '@/lib/auth/userModel';
import { signJwtToken, AUTH_COOKIE_NAME } from '@/lib/auth/jwt';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password } = body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Please provide a valid name (minimum 2 characters).' },
        { status: 400 }
      );
    }

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Please provide a valid email address.' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    const newUser = await createUser(name, email, password);
    const userId = newUser._id ? newUser._id.toString() : newUser.id || '';

    const token = signJwtToken({
      userId,
      name: newUser.name,
      email: newUser.email,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Account created successfully!',
      user: {
        userId,
        name: newUser.name,
        email: newUser.email,
      },
    });

    response.cookies.set({
      name: AUTH_COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error: any) {
    console.error('Signup API error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to register account' },
      { status: 400 }
    );
  }
}
