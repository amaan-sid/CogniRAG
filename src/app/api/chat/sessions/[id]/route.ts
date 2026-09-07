import { NextRequest, NextResponse } from 'next/server';
import { verifyJwtToken, extractAuthToken } from '@/lib/auth/jwt';
import {
  getChatSessionById,
  updateChatSession,
  deleteChatSession,
} from '@/lib/chat/chatSessionModel';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = extractAuthToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyJwtToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const session = await getChatSessionById(params.id, payload.userId);
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, session });
  } catch (error: any) {
    console.error(`GET /api/chat/sessions/${params.id} error:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch session' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = extractAuthToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyJwtToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const body = await req.json();
    const { title, messages, pdfMetadata, document } = body;

    const updated = await updateChatSession(params.id, payload.userId, {
      title,
      messages,
      pdfMetadata,
      document,
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Session not found or not modified' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: 'Session updated' });
  } catch (error: any) {
    console.error(`PATCH /api/chat/sessions/${params.id} error:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to update session' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const token = extractAuthToken(req);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyJwtToken(token);
    if (!payload?.userId) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const deleted = await deleteChatSession(params.id, payload.userId);
    if (!deleted) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Session deleted' });
  } catch (error: any) {
    console.error(`DELETE /api/chat/sessions/${params.id} error:`, error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete session' },
      { status: 500 }
    );
  }
}
