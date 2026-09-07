import { NextRequest, NextResponse } from 'next/server';
import { createUser } from '@/lib/auth/userModel';
import { signJwtToken, AUTH_COOKIE_NAME } from '@/lib/auth/jwt';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, username, gender, profilePic } = body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Please provide a valid name (minimum 2 characters).' },
        { status: 400 }
      );
    }

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return NextResponse.json(
        { error: 'Please provide a valid username (minimum 3 characters).' },
        { status: 400 }
      );
    }

    if (!/^[a-zA-Z0-9_.-]+$/.test(username.trim())) {
      return NextResponse.json(
        { error: 'Username can only contain letters, numbers, periods, underscores, and hyphens.' },
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

    const newUser = await createUser(
      name,
      email,
      password,
      username,
      gender,
      profilePic
    );
    const userId = newUser._id ? newUser._id.toString() : newUser.id || '';

    const token = signJwtToken({
      userId,
      name: newUser.name,
      email: newUser.email,
      username: newUser.username,
      gender: newUser.gender,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Account created successfully!',
      token,
      user: {
        userId,
        name: newUser.name,
        email: newUser.email,
        username: newUser.username,
        gender: newUser.gender,
        profilePic: newUser.profilePic,
      },
    });

    const isProd = process.env.NODE_ENV === 'production';

    response.cookies.set('token', token, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
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
