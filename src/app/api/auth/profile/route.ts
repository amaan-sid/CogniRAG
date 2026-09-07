import { NextRequest, NextResponse } from 'next/server';
import { verifyJwtToken, signJwtToken, extractAuthToken, AUTH_COOKIE_NAME } from '@/lib/auth/jwt';
import { updateUserProfile, findUserById } from '@/lib/auth/userModel';

export async function PATCH(req: NextRequest) {
  try {
    const token = extractAuthToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized. Please sign in.' }, { status: 401 });
    }

    const payload = verifyJwtToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid or expired session.' }, { status: 401 });
    }

    const body = await req.json();
    const { name, username, gender, profilePic } = body;

    const updatedUser = await updateUserProfile(payload.userId, {
      name,
      username,
      gender,
      profilePic,
    });

    const userId = updatedUser._id ? updatedUser._id.toString() : payload.userId;

    const newToken = signJwtToken({
      userId,
      name: updatedUser.name,
      email: updatedUser.email,
      username: updatedUser.username,
      gender: updatedUser.gender,
    });

    const response = NextResponse.json({
      success: true,
      message: 'Profile updated successfully!',
      token: newToken,
      user: {
        userId,
        name: updatedUser.name,
        email: updatedUser.email,
        username: updatedUser.username,
        gender: updatedUser.gender,
        profilePic: updatedUser.profilePic,
      },
    });

    const isProd = process.env.NODE_ENV === 'production';

    response.cookies.set('token', newToken, {
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });

    return response;
  } catch (error: any) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update profile.' },
      { status: 400 }
    );
  }
}
