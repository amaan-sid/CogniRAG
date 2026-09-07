import { NextRequest, NextResponse } from 'next/server';
import { findUserByEmailOrUsername, verifyPassword } from '@/lib/auth/userModel';
import { signJwtToken, AUTH_COOKIE_NAME } from '@/lib/auth/jwt';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Please enter both your email or username and password.' },
        { status: 400 }
      );
    }

    const user = await findUserByEmailOrUsername(email);
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials. User not found.' },
        { status: 401 }
      );
    }

    const isMatch = await verifyPassword(password, user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'Invalid credentials. Password does not match.' },
        { status: 401 }
      );
    }

    const userId = user._id ? user._id.toString() : user.id || '';

    const token = signJwtToken({
      userId,
      name: user.name,
      email: user.email,
      username: user.username || user.email.split('@')[0],
      gender: user.gender,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Signed in successfully!',
      token,
      user: {
        userId,
        name: user.name,
        email: user.email,
        username: user.username || user.email.split('@')[0],
        gender: user.gender,
        profilePic: user.profilePic,
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
    console.error('Login API error:', error);
    return NextResponse.json(
      { error: error.message || 'Authentication failed' },
      { status: 500 }
    );
  }
}

