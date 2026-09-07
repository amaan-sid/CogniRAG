import { NextRequest, NextResponse } from 'next/server';
import { deletePdfFromCloudinary } from '@/lib/storage/cloudinary';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { publicId, url } = body;

    const target = publicId || url;
    if (!target) {
      return NextResponse.json(
        { success: false, error: 'publicId or url is required for deletion.' },
        { status: 400 }
      );
    }

    const success = await deletePdfFromCloudinary(target);
    return NextResponse.json({ success, target });
  } catch (error: any) {
    console.error('Error in /api/pdf/delete:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete PDF from Cloudinary.' },
      { status: 500 }
    );
  }
}
