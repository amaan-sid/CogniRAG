import { NextRequest, NextResponse } from 'next/server';
import { verifyJwtToken, extractAuthToken } from '@/lib/auth/jwt';
import {
  getUserChatSessions,
  createChatSession,
} from '@/lib/chat/chatSessionModel';

export async function GET(req: NextRequest) {
  try {
    const token = extractAuthToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyJwtToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const sessions = await getUserChatSessions(payload.userId);
    return NextResponse.json({ success: true, sessions });
  } catch (error: any) {
    console.error('GET /api/chat/sessions error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch sessions' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = extractAuthToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyJwtToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { title, messages = [], pdfMetadata, document } = body;

    const newSession = await createChatSession(
      payload.userId,
      title || 'New Conversation',
      messages,
      pdfMetadata,
      document
    );

    return NextResponse.json({ success: true, session: newSession });
  } catch (error: any) {
    console.error('POST /api/chat/sessions error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create session' },
      { status: 500 }
    );
  }
}
