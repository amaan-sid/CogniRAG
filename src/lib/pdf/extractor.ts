import pdfParse from 'pdf-parse';

export interface PDFExtractionResult {
  success: boolean;
  filename?: string;
  cloudinaryUrl?: string;
  cloudinaryPublicId?: string;
  numPages: number;
  info: {
    title?: string;
    author?: string;
    subject?: string;
    keywords?: string;
    creator?: string;
    producer?: string;
    creationDate?: string;
  };
  rawText: string;
  cleanedText: string;
  stats: {
    charCount: number;
    wordCount: number;
    estimatedTokens: number;
    fileSizeBytes: number;
  };
  pages: {
    pageNumber: number;
    text: string;
    charCount: number;
    wordCount: number;
  }[];
  extractedAt: string;
}

/**
 * Normalizes and cleans raw text extracted from a PDF.
 * Removes excess whitespace, null bytes, and fixes line-wrapped sentences.
 */
export function cleanExtractedText(text: string): string {
  if (!text) return '';

  return text
    // Replace null bytes and non-printable control characters
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize Windows/Mac line endings to standard Unix newline
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    // Remove multiple consecutive blank lines (more than 2)
    .replace(/\n{3,}/g, '\n\n')
    // Replace multiple spaces/tabs with single space
    .replace(/[ \t]+/g, ' ')
    // Trim surrounding whitespace
    .trim();
}

/**
 * Extracts raw text, metadata, stats, and per-page content from a PDF Buffer using pdf-parse.
 */
export async function extractTextFromPDF(
  pdfBuffer: Buffer,
  filename: string = 'document.pdf'
): Promise<PDFExtractionResult> {
  try {
    const pageTexts: { pageNumber: number; text: string; charCount: number; wordCount: number }[] = [];
    let currentPage = 1;

    // Custom pagerender to capture per-page text breakdown
    const renderPage = (pageData: any) => {
      return pageData.getTextContent().then((textContent: any) => {
        let lastY = null;
        let text = '';
        for (const item of textContent.items) {
          if (lastY === item.transform[5] || lastY === null) {
            text += item.str;
          } else {
            text += '\n' + item.str;
          }
          lastY = item.transform[5];
        }
        
        const cleanedPageText = cleanExtractedText(text);
        const words = cleanedPageText.split(/\s+/).filter(Boolean).length;
        
        pageTexts.push({
          pageNumber: currentPage,
          text: cleanedPageText,
          charCount: cleanedPageText.length,
          wordCount: words,
        });

        currentPage++;
        return text;
      });
    };

    const data = await pdfParse(pdfBuffer, {
      pagerender: renderPage,
    });

    const cleanedText = cleanExtractedText(data.text);
    const words = cleanedText.split(/\s+/).filter(Boolean).length;
    
    // Rough estimate for tokens: ~4 characters per token
    const estimatedTokens = Math.ceil(cleanedText.length / 4);

    return {
      success: true,
      filename,
      numPages: data.numpages || 1,
      info: {
        title: data.info?.Title || filename,
        author: data.info?.Author || 'Unknown',
        subject: data.info?.Subject || undefined,
        keywords: data.info?.Keywords || undefined,
        creator: data.info?.Creator || undefined,
        producer: data.info?.Producer || undefined,
        creationDate: data.info?.CreationDate || undefined,
      },
      rawText: data.text,
      cleanedText,
      stats: {
        charCount: cleanedText.length,
        wordCount: words,
        estimatedTokens,
        fileSizeBytes: pdfBuffer.length,
      },
      pages: pageTexts.length > 0 ? pageTexts : [
        {
          pageNumber: 1,
          text: cleanedText,
          charCount: cleanedText.length,
          wordCount: words,
        }
      ],
      extractedAt: new Date().toISOString(),
    };
  } catch (error: any) {
    console.error('PDF extraction failed:', error);
    throw new Error(`Failed to extract text from PDF: ${error.message || error}`);
  }
}
