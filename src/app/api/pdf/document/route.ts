import { NextRequest, NextResponse } from 'next/server';
import { verifyJwtToken, extractAuthToken } from '@/lib/auth/jwt';
import {
  getUserActiveDocument,
  saveUserActiveDocument,
} from '@/lib/pdf/userDocumentModel';

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

    const doc = await getUserActiveDocument(payload.userId);
    return NextResponse.json({ success: true, document: doc });
  } catch (error: any) {
    console.error('GET /api/pdf/document error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch active document' },
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

    const body = await req.json();
    const {
      filename,
      cloudinaryUrl,
      cloudinaryPublicId,
      extractionResult,
      chunkingResult,
      embeddingResult,
    } = body;

    if (!filename || !extractionResult) {
      return NextResponse.json(
        { error: 'Missing required document fields' },
        { status: 400 }
      );
    }

    const savedDoc = await saveUserActiveDocument(payload.userId, {
      filename,
      cloudinaryUrl,
      cloudinaryPublicId,
      extractionResult,
      chunkingResult,
      embeddingResult,
    });

    return NextResponse.json({ success: true, document: savedDoc });
  } catch (error: any) {
    console.error('POST /api/pdf/document error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save active document' },
      { status: 500 }
    );
  }
}
