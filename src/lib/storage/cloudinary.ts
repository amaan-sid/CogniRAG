import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';

// Configure Cloudinary from environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export interface CloudinaryUploadResult {
  secureUrl: string;
  publicId: string;
  format?: string;
  bytes?: number;
}

/**
 * Uploads a raw PDF buffer to Cloudinary and returns the permanent CDN secure URL.
 */
export async function uploadPdfToCloudinary(
  buffer: Buffer,
  filename: string
): Promise<CloudinaryUploadResult> {
  const cleanName = filename
    .replace(/\.[^/.]+$/, '') // Remove extension
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 50);

  const timestamp = Date.now();
  const publicId = `${cleanName}_${timestamp}`;

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        folder: 'cognirag_documents',
        public_id: publicId,
        format: 'pdf',
      },
      (error: any, result?: UploadApiResponse) => {
        if (error || !result) {
          console.error('Cloudinary PDF Upload Error:', error);
          reject(new Error(error?.message || 'Failed to upload PDF to Cloudinary.'));
        } else {
          resolve({
            secureUrl: result.secure_url,
            publicId: result.public_id,
            format: result.format,
            bytes: result.bytes,
          });
        }
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Extracts the Cloudinary publicId from a raw asset URL.
 */
export function extractPublicIdFromUrl(url: string): string | null {
  try {
    const match = url.match(/\/upload\/(?:v\d+\/)?(.+)$/);
    if (match && match[1]) {
      return decodeURIComponent(match[1]);
    }
  } catch (err) {
    console.warn('Could not extract publicId from URL:', url, err);
  }
  return null;
}

/**
 * Deletes a PDF file from Cloudinary given its publicId or URL.
 */
export async function deletePdfFromCloudinary(publicIdOrUrl?: string | null): Promise<boolean> {
  if (!publicIdOrUrl || typeof publicIdOrUrl !== 'string') return false;

  let publicId = publicIdOrUrl.trim();
  if (publicId.startsWith('http://') || publicId.startsWith('https://')) {
    const extracted = extractPublicIdFromUrl(publicId);
    if (extracted) publicId = extracted;
  }

  try {
    // 1. Try destroying with raw resource_type
    let result = await cloudinary.uploader.destroy(publicId, {
      resource_type: 'raw',
      invalidate: true,
    });

    // 2. If not found and doesn't end with .pdf, try with .pdf
    if (result?.result !== 'ok' && !publicId.endsWith('.pdf')) {
      const retryResult = await cloudinary.uploader.destroy(`${publicId}.pdf`, {
        resource_type: 'raw',
        invalidate: true,
      });
      if (retryResult?.result === 'ok') {
        result = retryResult;
      }
    }

    // 3. If not found and ends with .pdf, try without .pdf
    if (result?.result !== 'ok' && publicId.endsWith('.pdf')) {
      const stripped = publicId.replace(/\.pdf$/i, '');
      const retryResult = await cloudinary.uploader.destroy(stripped, {
        resource_type: 'raw',
        invalidate: true,
      });
      if (retryResult?.result === 'ok') {
        result = retryResult;
      }
    }

    console.log(`Cloudinary deletion for "${publicId}":`, result);
    return result?.result === 'ok' || result?.result === 'not found';
  } catch (error) {
    console.error(`Failed to delete PDF from Cloudinary for "${publicIdOrUrl}":`, error);
    return false;
  }
}

export default cloudinary;
