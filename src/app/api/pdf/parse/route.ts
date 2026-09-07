import { NextRequest, NextResponse } from 'next/server';
import { extractTextFromPDF } from '@/lib/pdf/extractor';
import { uploadPdfToCloudinary } from '@/lib/storage/cloudinary';

export const runtime = 'nodejs'; // Ensure Node.js runtime for pdf-parse

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No PDF file provided in request.' },
        { status: 400 }
      );
    }

    if (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf') {
      return NextResponse.json(
        { success: false, error: 'Uploaded file must be a PDF document.' },
        { status: 400 }
      );
    }

    // Convert Web File stream to Node Buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    if (buffer.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Uploaded PDF file is empty.' },
        { status: 400 }
      );
    }

    // Concurrently extract text from PDF and upload to Cloudinary
    const [extractionResult, uploadResult] = await Promise.all([
      extractTextFromPDF(buffer, file.name),
      uploadPdfToCloudinary(buffer, file.name).catch((err) => {
        console.warn('Cloudinary upload warning (non-fatal):', err.message);
        return null;
      }),
    ]);

    return NextResponse.json(
      {
        ...extractionResult,
        cloudinaryUrl: uploadResult?.secureUrl,
        cloudinaryPublicId: uploadResult?.publicId,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error('API Error in /api/pdf/parse:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'An error occurred while parsing the PDF document.',
      },
      { status: 500 }
    );
  }
}
