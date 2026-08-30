export type ChunkingStrategy = 'recursive';

export interface PageInfo {
  pageNumber: number;
  text: string;
  charCount: number;
  wordCount: number;
}

export interface ChunkingOptions {
  text: string;
  strategy?: ChunkingStrategy;
  chunkSize?: number;
  chunkOverlap?: number;
  pages?: PageInfo[];
}  

export interface ChunkItem {
  id: string;
  index: number;
  text: string;
  charCount: number;
  wordCount: number;
  estimatedTokens: number;
  startCharIndex: number;
  endCharIndex: number;
  pageNumber?: number;
  pageRange?: string;
  overlapPrev: number;
  overlapNext: number;
  overlapPrevText: string;
  overlapNextText: string;
}

export interface ChunkingStats {
  totalChunks: number;
  totalChars: number;
  totalWords: number;
  totalEstimatedTokens: number;
  avgChunkSize: number;
  minChunkSize: number;
  maxChunkSize: number;
  avgTokensPerChunk: number;
  strategyUsed: ChunkingStrategy;
  chunkSizeConfig: number;
  chunkOverlapConfig: number;
}

export interface ChunkingResult {
  success: boolean;
  chunks: ChunkItem[];
  stats: ChunkingStats;
  processedAt: string;
}

/**
 * Maps a character range [start, end] to corresponding page numbers from PDF page info.
 */
function resolvePageRange(
  startCharIndex: number,
  endCharIndex: number,
  pages?: PageInfo[]
): { pageNumber: number; pageRange: string } {
  if (!pages || pages.length === 0) {
    return { pageNumber: 1, pageRange: 'Page 1' };
  }

  let cumulativeOffset = 0;
  const matchedPages: number[] = [];

  for (const page of pages) {
    const pageStart = cumulativeOffset;
    const pageEnd = cumulativeOffset + page.text.length + 1; // +1 for newline between pages

    if (startCharIndex < pageEnd && endCharIndex >= pageStart) {
      matchedPages.push(page.pageNumber);
    }
    cumulativeOffset = pageEnd;
  }

  if (matchedPages.length === 0) {
    return { pageNumber: 1, pageRange: 'Page 1' };
  }

  if (matchedPages.length === 1) {
    return { pageNumber: matchedPages[0], pageRange: `Page ${matchedPages[0]}` };
  }

  const first = matchedPages[0];
  const last = matchedPages[matchedPages.length - 1];
  return { pageNumber: first, pageRange: `Pages ${first}-${last}` };
}

/**
 * Main chunking engine function that parses text using recursive character chunking.
 */
export function chunkText(options: ChunkingOptions): ChunkingResult {
  const defaultChunkSize = process.env.CHUNK_SIZE ? Number(process.env.CHUNK_SIZE) : 800;
  const defaultChunkOverlap = process.env.CHUNK_OVERLAP ? Number(process.env.CHUNK_OVERLAP) : 100;

  const {
    text = '',
    chunkSize = defaultChunkSize,
    chunkOverlap = defaultChunkOverlap,
    pages = [],
  } = options;

  const validChunkSize = Math.max(50, chunkSize);
  const validChunkOverlap = Math.min(Math.max(0, chunkOverlap), Math.floor(validChunkSize / 2));

  let rawChunks = recursiveCharacterChunking(text, validChunkSize, validChunkOverlap);

  // Filter out empty chunks
  rawChunks = rawChunks.filter((c) => c.text.trim().length > 0);

  // Build final ChunkItem instances with metadata
  const chunks: ChunkItem[] = rawChunks.map((c, index) => {
    const prevChunk = index > 0 ? rawChunks[index - 1] : null;
    const nextChunk = index < rawChunks.length - 1 ? rawChunks[index + 1] : null;

    // Calculate overlap with previous chunk
    let overlapPrev = 0;
    let overlapPrevText = '';
    if (prevChunk) {
      const overlapStart = Math.max(c.startCharIndex, prevChunk.startCharIndex);
      const overlapEnd = Math.min(c.endCharIndex, prevChunk.endCharIndex);
      if (overlapEnd > overlapStart) {
        overlapPrev = overlapEnd - overlapStart;
        overlapPrevText = text.substring(overlapStart, overlapEnd);
      }
    }

    // Calculate overlap with next chunk
    let overlapNext = 0;
    let overlapNextText = '';
    if (nextChunk) {
      const overlapStart = Math.max(c.startCharIndex, nextChunk.startCharIndex);
      const overlapEnd = Math.min(c.endCharIndex, nextChunk.endCharIndex);
      if (overlapEnd > overlapStart) {
        overlapNext = overlapEnd - overlapStart;
        overlapNextText = text.substring(overlapStart, overlapEnd);
      }
    }

    const { pageNumber, pageRange } = resolvePageRange(c.startCharIndex, c.endCharIndex, pages);
    const words = c.text.split(/\s+/).filter(Boolean).length;
    const estimatedTokens = Math.ceil(c.text.length / 4);

    return {
      id: `chunk_${index + 1}`,
      index: index + 1,
      text: c.text,
      charCount: c.text.length,
      wordCount: words,
      estimatedTokens,
      startCharIndex: c.startCharIndex,
      endCharIndex: c.endCharIndex,
      pageNumber,
      pageRange,
      overlapPrev,
      overlapNext,
      overlapPrevText,
      overlapNextText,
    };
  });

  // Calculate statistics
  const totalChunks = chunks.length;
  const totalChars = chunks.reduce((acc, curr) => acc + curr.charCount, 0);
  const totalWords = chunks.reduce((acc, curr) => acc + curr.wordCount, 0);
  const totalEstimatedTokens = chunks.reduce((acc, curr) => acc + curr.estimatedTokens, 0);

  const chunkSizes = chunks.map((c) => c.charCount);
  const avgChunkSize = totalChunks > 0 ? Math.round(totalChars / totalChunks) : 0;
  const minChunkSize = chunkSizes.length > 0 ? Math.min(...chunkSizes) : 0;
  const maxChunkSize = chunkSizes.length > 0 ? Math.max(...chunkSizes) : 0;
  const avgTokensPerChunk = totalChunks > 0 ? Math.round(totalEstimatedTokens / totalChunks) : 0;

  return {
    success: true,
    chunks,
    stats: {
      totalChunks,
      totalChars,
      totalWords,
      totalEstimatedTokens,
      avgChunkSize,
      minChunkSize,
      maxChunkSize,
      avgTokensPerChunk,
      strategyUsed: 'recursive',
      chunkSizeConfig: validChunkSize,
      chunkOverlapConfig: validChunkOverlap,
    },
    processedAt: new Date().toISOString(),
  };
}

/**
 * Recursive Character Chunking Strategy
 */
function recursiveCharacterChunking(
  text: string,
  chunkSize: number,
  chunkOverlap: number
): { text: string; startCharIndex: number; endCharIndex: number }[] {
  const separators = ['\n\n', '\n', '. ', '! ', '? ', '; ', ' ', ''];

  function splitText(
    txt: string,
    seps: string[],
    startOffset: number
  ): { text: string; startCharIndex: number; endCharIndex: number }[] {
    if (txt.length <= chunkSize || seps.length === 0) {
      return [{ text: txt, startCharIndex: startOffset, endCharIndex: startOffset + txt.length }];
    }

    const sep = seps[0];
    const nextSeps = seps.slice(1);
    const splits = txt.split(sep);

    const result: { text: string; startCharIndex: number; endCharIndex: number }[] = [];
    let currentChunk = '';
    let currentStart = startOffset;
    let localOffset = 0;

    for (let i = 0; i < splits.length; i++) {
      const piece = splits[i];
      const pieceWithSep = piece + (i < splits.length - 1 ? sep : '');

      if (currentChunk.length + pieceWithSep.length > chunkSize && currentChunk.length > 0) {
        if (currentChunk.length > chunkSize && nextSeps.length > 0) {
          // If a accumulated single piece is too large, recurse deeper
          result.push(...splitText(currentChunk, nextSeps, currentStart));
        } else {
          result.push({
            text: currentChunk,
            startCharIndex: currentStart,
            endCharIndex: currentStart + currentChunk.length,
          });
        }

        // Apply overlap from end of current chunk
        const overlapLen = Math.min(chunkOverlap, currentChunk.length);
        const overlapText = currentChunk.substring(currentChunk.length - overlapLen);
        currentChunk = overlapText + pieceWithSep;
        currentStart = startOffset + localOffset - overlapLen;
      } else {
        if (currentChunk.length === 0) {
          currentStart = startOffset + localOffset;
        }
        currentChunk += pieceWithSep;
      }

      localOffset += pieceWithSep.length;
    }

    if (currentChunk.trim().length > 0) {
      if (currentChunk.length > chunkSize && nextSeps.length > 0) {
        result.push(...splitText(currentChunk, nextSeps, currentStart));
      } else {
        result.push({
          text: currentChunk,
          startCharIndex: currentStart,
          endCharIndex: currentStart + currentChunk.length,
        });
      }
    }

    return result;
  }

  return splitText(text, separators, 0);
}

