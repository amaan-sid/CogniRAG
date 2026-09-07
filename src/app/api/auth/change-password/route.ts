import { NextRequest, NextResponse } from 'next/server';
import { verifyJwtToken, extractAuthToken } from '@/lib/auth/jwt';
import { updateUserPassword } from '@/lib/auth/userModel';

export async function POST(req: NextRequest) {
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
    const { currentPassword, newPassword } = body;

    if (!currentPassword) {
      return NextResponse.json(
        { error: 'Please enter your current password.' },
        { status: 400 }
      );
    }

    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json(
        { error: 'New password must be at least 6 characters long.' },
        { status: 400 }
      );
    }

    await updateUserPassword(payload.userId, currentPassword, newPassword);

    return NextResponse.json({
      success: true,
      message: 'Password has been changed successfully!',
    });
  } catch (error: any) {
    console.error('Password change error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to change password.' },
      { status: 400 }
    );
  }
}
