'use client';
import React, { useState, useEffect } from 'react';
import {
  FileText,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  BookOpen,
  Sparkles,
  Search,
  Maximize2,
  Minimize2,
  Copy,
  Check
} from 'lucide-react';
import { PDFExtractionResult } from '@/lib/pdf/extractor';
import { ChunkingResult } from '@/lib/chunking/chunker';

export interface ActiveCitation {
  pageRange?: string;
  chunkIndex: number;
  snippet: string;
  similarityScore?: number;
}

interface PdfSideViewerProps {
  isOpen: boolean;
  onClose: () => void;
  activeCitation: ActiveCitation | null;
  extractionResult: PDFExtractionResult | null;
  chunkingResult: ChunkingResult | null;
  pdfFileUrl?: string | null;
}

export default function PdfSideViewer({
  isOpen,
  onClose,
  activeCitation,
  extractionResult,
  chunkingResult,
  pdfFileUrl,
}: PdfSideViewerProps) {
  const [activeTab, setActiveTab] = useState<'citation' | 'document' | 'raw_pdf'>('citation');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  // Sync current page when active citation changes
  useEffect(() => {
    if (activeCitation?.pageRange) {
      const match = activeCitation.pageRange.match(/\d+/);
      if (match) {
        setCurrentPage(parseInt(match[0], 10));
      }
      setActiveTab('citation');
    }
  }, [activeCitation]);

  if (!isOpen) return null;

  const totalPages = extractionResult?.numPages || extractionResult?.pages?.length || 1;
  const currentPageData = extractionResult?.pages?.find((p) => p.pageNumber === currentPage);

  // Find active chunk if available
  const activeChunk =
    activeCitation && chunkingResult?.chunks
      ? chunkingResult.chunks.find((c) => c.index === activeCitation.chunkIndex) ||
        chunkingResult.chunks[activeCitation.chunkIndex]
      : null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <aside
      className={`fixed inset-y-0 right-0 z-40 bg-[#121214] border-l border-[#26262a] shadow-2xl flex flex-col transition-all duration-300 ease-in-out ${
        isExpanded ? 'w-full md:w-[750px] lg:w-[850px]' : 'w-full sm:w-[420px] md:w-[480px] lg:w-[520px]'
      }`}
    >
      {/* Header */}
      <div className="p-3.5 sm:p-4 border-b border-[#26262a] flex items-center justify-between bg-[#18181b]/70 backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
            <BookOpen className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs sm:text-sm font-semibold text-slate-100 truncate">
              Document & Citation Inspector
            </h3>
            <p className="text-[10px] text-slate-400 truncate">
              {extractionResult?.info?.title || extractionResult?.filename || 'CogniRAG Grounded Source View'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            title={isExpanded ? 'Collapse width' : 'Expand width'}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors hidden sm:block"
          >
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Close inspector"
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-3.5 pt-2.5 pb-1 border-b border-[#26262a] flex items-center gap-2 text-xs font-medium bg-[#141416]">
        <button
          type="button"
          onClick={() => setActiveTab('citation')}
          className={`pb-2 px-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'citation'
              ? 'border-purple-500 text-purple-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Active Citation</span>
          {activeCitation && (
            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-purple-500/20 text-purple-300">
              #{activeCitation.chunkIndex}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('document')}
          className={`pb-2 px-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
            activeTab === 'document'
              ? 'border-purple-500 text-purple-300 font-semibold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Page Content</span>
          <span className="text-[9px] font-mono px-1.5 py-0.2 rounded-full bg-white/10 text-slate-300">
            p.{currentPage}/{totalPages}
          </span>
        </button>

        {pdfFileUrl && (
          <button
            type="button"
            onClick={() => setActiveTab('raw_pdf')}
            className={`pb-2 px-2.5 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'raw_pdf'
                ? 'border-purple-500 text-purple-300 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>PDF View</span>
          </button>
        )}
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === 'citation' && (
          <div className="space-y-4">
            {activeCitation ? (
              <>
                {/* Citation Metadata Card */}
                <div className="bg-[#18181c] border border-purple-500/30 rounded-2xl p-4 shadow-lg shadow-purple-500/5 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold tracking-wider uppercase text-purple-400 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Grounded Evidence Pass
                    </span>
                    <div className="flex items-center gap-2">
                      {activeCitation.similarityScore !== undefined && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                          {(activeCitation.similarityScore * 100).toFixed(1)}% Match
                        </span>
                      )}
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/25">
                        {activeCitation.pageRange || `Page ${currentPage}`}
                      </span>
                    </div>
                  </div>

                  {/* Cited Excerpt */}
                  <div className="p-3 bg-purple-950/20 border border-purple-500/20 rounded-xl">
                    <p className="text-xs text-purple-200 leading-relaxed font-serif italic">
                      "{activeCitation.snippet}"
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => handleCopy(activeCitation.snippet)}
                      className="inline-flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Copied Excerpt' : 'Copy Quote'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveTab('document')}
                      className="inline-flex items-center gap-1 text-[11px] text-purple-400 hover:text-purple-300 font-medium"
                    >
                      <span>View full page {currentPage}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Full Surrounding Chunk */}
                {activeChunk && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-slate-400" /> Full Chunk #{activeChunk.index} Context
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {activeChunk.charCount} chars
                      </span>
                    </div>

                    <div className="p-4 bg-[#18181c] border border-[#26262a] rounded-2xl text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap selection:bg-purple-600/30">
                      {activeChunk.text}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="p-8 text-center space-y-3 bg-[#18181c] border border-[#26262a] rounded-2xl">
                <BookOpen className="w-8 h-8 text-slate-500 mx-auto" />
                <h4 className="text-sm font-medium text-slate-300">No active citation selected</h4>
                <p className="text-xs text-slate-400 max-w-xs mx-auto">
                  Click on any citation chip like <span className="text-purple-400 font-mono">[Page 1, Chunk #0]</span> in the chat to highlight evidence here.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'document' && (
          <div className="space-y-4">
            {/* Page Navigator */}
            <div className="flex items-center justify-between p-2.5 bg-[#18181c] border border-[#26262a] rounded-xl text-xs">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="p-1.5 rounded-lg bg-[#212124] text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <span className="px-2 font-mono text-slate-200">
                  Page <span className="text-purple-400 font-bold">{currentPage}</span> of {totalPages}
                </span>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="p-1.5 rounded-lg bg-[#212124] text-slate-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none"
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              {currentPageData && (
                <span className="text-[10px] text-slate-500 font-mono">
                  {currentPageData.wordCount} words
                </span>
              )}
            </div>

            {/* Search within page */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Find in page text..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#18181c] border border-[#26262a] rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-purple-500/50"
              />
            </div>

            {/* Page text container */}
            <div className="p-4 bg-[#18181c] border border-[#26262a] rounded-2xl text-xs text-slate-300 leading-relaxed font-mono whitespace-pre-wrap max-h-[60vh] overflow-y-auto">
              {currentPageData ? (
                searchQuery ? (
                  highlightSearchQuery(currentPageData.text, searchQuery)
                ) : (
                  currentPageData.text
                )
              ) : (
                <span className="text-slate-500 italic">No text extracted for page {currentPage}.</span>
              )}
            </div>
          </div>
        )}

        {activeTab === 'raw_pdf' && pdfFileUrl && (
          <div className="h-[75vh] w-full rounded-2xl overflow-hidden border border-[#26262a] flex flex-col">
            <div className="px-3 py-2 bg-[#18181c] border-b border-[#26262a] flex items-center justify-between text-xs">
              <span className="text-[11px] text-slate-400 font-mono truncate max-w-[220px]">
                {pdfFileUrl.startsWith('http') ? '☁️ Cloudinary Stored PDF' : 'Local Document Preview'}
              </span>
              <a
                href={pdfFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300 flex items-center gap-1 font-medium text-[11px] hover:underline"
              >
                <span>Open in New Tab</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <iframe
              src={pdfFileUrl.startsWith('http') ? pdfFileUrl : `${pdfFileUrl}#page=${currentPage}`}
              title="PDF Viewer"
              className="w-full flex-1 bg-slate-900 border-0"
            />
          </div>
        )}
      </div>
    </aside>
  );
}

function highlightSearchQuery(text: string, query: string) {
  if (!query.trim()) return text;
  const parts = text.split(new RegExp(`(${escapeRegex(query)})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase() ? (
          <mark key={i} className="bg-purple-500/40 text-purple-100 rounded px-0.5">
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  );
}

function escapeRegex(string: string) {
  return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}
