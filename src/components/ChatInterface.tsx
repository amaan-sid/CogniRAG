'use client';
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import {
  Send,
  Paperclip,
  FileText,
  Sparkles,
  Bot,
  User,
  Trash2,
  CheckCircle2,
  Copy,
  Check,
  LogOut,
  BookOpen,
  ArrowUpRight,
  AlertCircle,
  PanelLeft,
  PanelLeftClose,
  Plus,
  FileUp,
  ChevronDown
} from 'lucide-react';
import { PDFExtractionResult } from '@/lib/pdf/extractor';
import { ChunkingResult, chunkText } from '@/lib/chunking/chunker';
import { EmbeddingResult } from '@/lib/embeddings/embedder';
import type { RagQueryResult } from '@/lib/rag/queryEngine';

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  citations?: { pageRange?: string; chunkIndex: number; snippet: string }[];
  modelUsed?: string;
  generationTimeMs?: number;
}

const SAMPLE_QUESTIONS = [
  'What is the main topic of this document?',
  'Summarize key findings and takeaways.',
  'What are the core technical requirements?',
  'List any important dates, names, or metrics.',
];

export default function ChatInterface() {
  const { user, logout } = useAuth();

  // Layout State
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);

  // Document & Pipeline State
  const [extractionResult, setExtractionResult] = useState<PDFExtractionResult | null>(null);
  const [chunkingResult, setChunkingResult] = useState<ChunkingResult | null>(null);
  const [embeddingResult, setEmbeddingResult] = useState<EmbeddingResult | null>(null);

  // Upload & Indexing States
  const [isIndexing, setIsIndexing] = useState<boolean>(false);
  const [indexingStatus, setIndexingStatus] = useState<string>('');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isGenerating]);

  // Handle PDF Upload & Auto-Index
  const processPdfFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Please select a valid PDF file (.pdf).');
      return;
    }

    setUploadError(null);
    setIsIndexing(true);
    setIndexingStatus('Extracting text & metadata from PDF...');

    try {
      // 1. Extract PDF Text
      const formData = new FormData();
      formData.append('file', file);
      const parseRes = await fetch('/api/pdf/parse', {
        method: 'POST',
        body: formData,
      });
      const parseData: PDFExtractionResult = await parseRes.json();
      if (!parseRes.ok || !parseData.success) {
        throw new Error((parseData as any).error || 'Failed to extract text from PDF');
      }
      setExtractionResult(parseData);

      // 2. Chunk Text
      setIndexingStatus('Splitting document into recursive character chunks...');
      const chunkRes = chunkText({
        text: parseData.cleanedText,
        pages: parseData.pages,
      });
      setChunkingResult(chunkRes);

      // 3. Generate Vector Embeddings (1024d Nemotron)
      setIndexingStatus('Generating 1024d Nemotron vector embeddings...');
      const embedRes = await fetch('/api/pdf/embed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chunks: chunkRes.chunks }),
      });
      const embedData: EmbeddingResult = await embedRes.json();
      if (!embedRes.ok) {
        throw new Error((embedData as any).error || 'Embedding API call failed');
      }
      setEmbeddingResult(embedData);

      // 4. Store in Vector Database
      setIndexingStatus('Indexing vectors in MongoDB Vector DB...');
      await fetch('/api/pdf/vectordb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear' }),
      });
      await fetch('/api/pdf/vectordb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert',
          records: embedData.embeddings.map((e) => ({
            id: e.chunkId,
            chunkIndex: e.chunkIndex,
            text: e.text,
            pageRange: e.pageRange,
            vector: e.vector,
            estimatedTokens: e.estimatedTokens,
          })),
        }),
      });

      setIndexingStatus('Indexed & Ready!');
    } catch (err: any) {
      console.error('PDF indexing error:', err);
      setUploadError(err.message || 'Failed to process and index PDF file.');
    } finally {
      setIsIndexing(false);
    }
  };

  // Handle Query Submission
  const handleSendMessage = async (queryTextToSubmit?: string) => {
    const query = queryTextToSubmit || inputQuery;
    if (!query.trim() || isGenerating) return;

    if (!extractionResult) {
      setUploadError('Please upload a PDF document before asking a question.');
      return;
    }

    const userMsgId = `user_${Date.now()}`;
    const newUserMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: query.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newUserMsg]);
    if (!queryTextToSubmit) setInputQuery('');
    setIsGenerating(true);

    try {
      const response = await fetch('/api/pdf/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queryText: query.trim(),
          minScore: 0.0,
          chunks: chunkingResult?.chunks || [],
          embeddings: embeddingResult?.embeddings || [],
        }),
      });

      const ragRes: RagQueryResult = await response.json();
      if (!response.ok || !ragRes.success) {
        throw new Error((ragRes as any).error || 'Failed to generate RAG response from server');
      }

      const assistantMsg: ChatMessage = {
        id: `assistant_${Date.now()}`,
        sender: 'assistant',
        text: ragRes.synthesizedAnswer.answerText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations: ragRes.synthesizedAnswer.citations,
        modelUsed: ragRes.synthesizedAnswer.modelUsed,
        generationTimeMs: ragRes.stats.totalTimeMs,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      console.error('RAG query error:', err);
      const errorMsg: ChatMessage = {
        id: `error_${Date.now()}`,
        sender: 'assistant',
        text: `⚠️ Error generating answer: ${err.message || 'Failed to connect to LLM service.'}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="flex h-screen w-screen bg-[#0d0d0d] text-slate-100 overflow-hidden font-sans relative">
      
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) processPdfFile(file);
        }}
      />

      {/* Mobile Backdrop Overlay */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-30 md:hidden transition-opacity"
        />
      )}

      {/* LEFT SIDEBAR (Mobile Drawer + Desktop Panel) */}
      <aside
        className={`fixed md:relative inset-y-0 left-0 bg-[#171717] border-r border-[#262626] flex flex-col justify-between transition-all duration-300 ease-in-out shrink-0 z-40 md:z-20 h-full ${
          isSidebarOpen
            ? 'w-72 sm:w-80 p-3 opacity-100 translate-x-0'
            : '-translate-x-full md:translate-x-0 md:w-0 p-0 border-0 overflow-hidden opacity-0 pointer-events-none'
        }`}
      >
        <div className="space-y-4 flex-1 overflow-y-auto">
          
          {/* Sidebar Top Header */}
          <div className="flex items-center justify-between px-2 pt-1 pb-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold shadow-md">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="font-semibold text-sm text-slate-100 tracking-tight">CogniRAG</span>
            </div>

            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-[#212121] rounded-lg transition-colors"
              title="Close sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          {/* "+ New PDF Upload" ChatGPT Action Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={isIndexing}
            className="w-full py-2.5 px-3 bg-[#212121] hover:bg-[#2f2f2f] border border-[#2f2f2f] hover:border-slate-700 text-slate-200 rounded-xl text-xs font-semibold transition-all flex items-center gap-3 group shadow-sm"
          >
            <div className="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 flex items-center justify-center transition-colors">
              <Plus className="w-4 h-4" />
            </div>
            <span className="truncate">New PDF Document</span>
          </button>

          {/* Active Document Section */}
          <div className="space-y-2 pt-2">
            <div className="px-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              Document History
            </div>
            
            {extractionResult ? (
              <div className="bg-[#212121] border border-[#2f2f2f] rounded-xl p-3.5 space-y-3 shadow-inner">
                <div className="flex items-start gap-2.5">
                  <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20 shrink-0">
                    <FileText className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-semibold text-slate-100 truncate" title={extractionResult.filename}>
                      {extractionResult.filename}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {extractionResult.numPages} pages • {(extractionResult.stats.fileSizeBytes / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[10px] pt-2 border-t border-[#2f2f2f] font-mono text-slate-400">
                  <span>Vector Embeddings:</span>
                  <span className="text-emerald-400 font-semibold">{chunkingResult?.chunks.length || 0} chunks</span>
                </div>

                <div className="flex items-center gap-1.5 text-[10px] font-medium text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Ready for Q&A</span>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border border-dashed border-[#2f2f2f] hover:border-slate-600 bg-[#212121]/50 hover:bg-[#212121] rounded-xl p-4 text-center transition-all cursor-pointer group space-y-1.5"
              >
                <FileUp className="w-5 h-5 mx-auto text-slate-400 group-hover:text-emerald-400 transition-colors" />
                <div>
                  <p className="text-xs font-medium text-slate-300">Upload PDF</p>
                  <p className="text-[10px] text-slate-400">Click to index document</p>
                </div>
              </div>
            )}
          </div>

          {/* Indexing Progress Indicator */}
          {isIndexing && (
            <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-300">
                <span className="w-3 h-3 border-2 border-emerald-400/30 border-t-emerald-400 rounded-full animate-spin shrink-0" />
                <span>Processing Document</span>
              </div>
              <p className="text-[10px] text-slate-400 font-mono line-clamp-2">{indexingStatus}</p>
            </div>
          )}

          {/* Upload Error */}
          {uploadError && (
            <div className="p-3 bg-red-950/40 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span className="text-[11px] leading-tight">{uploadError}</span>
            </div>
          )}
        </div>

        {/* Sidebar Footer User Profile */}
        {user && (
          <div className="pt-3 border-t border-[#262626] flex items-center justify-between px-1">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-200 truncate">{user.name}</p>
                <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
              </div>
            </div>
            <button
              onClick={() => logout()}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-[#212121] rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </aside>

      {/* RIGHT CHATGPT MAIN WORKSPACE */}
      <main className="flex-1 flex flex-col h-full bg-[#0d0d0d] relative overflow-hidden">
        
        {/* Top Header Bar */}
        <header className="h-14 px-3 sm:px-4 border-b border-[#212121] flex items-center justify-between bg-[#0d0d0d]/90 backdrop-blur-md shrink-0 z-10">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-1.5 text-slate-400 hover:text-white hover:bg-[#212121] rounded-lg transition-colors shrink-0"
                title="Open sidebar"
              >
                <PanelLeft className="w-4 h-4" />
              </button>
            )}

            {/* Model Selector Dropdown */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-[#171717] hover:bg-[#212121] border border-[#262626] rounded-xl cursor-pointer text-xs font-medium transition-colors shrink-0 max-w-[190px] sm:max-w-none">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-slate-200 font-semibold truncate text-[11px] sm:text-xs">Nemotron-3 Super 120B</span>
              <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">NVIDIA NIM • Vector Engine</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-500 ml-0.5 shrink-0" />
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {extractionResult && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-[#171717] border border-[#262626] rounded-lg text-slate-300 text-xs truncate max-w-xs">
                <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="truncate">{extractionResult.filename}</span>
              </div>
            )}

            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-[#171717] hover:bg-[#212121] border border-[#262626] rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}
          </div>
        </header>

        {/* Chat Feed (Centered ChatGPT Width) */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="max-w-3xl lg:max-w-4xl mx-auto w-full space-y-5 sm:space-y-6">
            
            {messages.length === 0 ? (
              <div className="min-h-[55vh] sm:min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6 sm:space-y-8 py-6 sm:py-10">
                
                {/* Center Icon */}
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#171717] border border-[#262626] flex items-center justify-center shadow-2xl text-emerald-400">
                  <Sparkles className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>

                <div className="space-y-2 max-w-md px-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
                    What can I help with today?
                  </h1>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Upload a PDF document to index text into vector embeddings, then ask questions with AI source citations!
                  </p>
                </div>

                {/* Sample Prompt Cards */}
                <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-left">
                  {SAMPLE_QUESTIONS.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(q)}
                      className="p-3.5 sm:p-4 bg-[#171717] hover:bg-[#212121] border border-[#262626] hover:border-slate-600 rounded-2xl text-xs text-slate-300 hover:text-white transition-all flex items-center justify-between group shadow-sm"
                    >
                      <span className="line-clamp-2 leading-relaxed">{q}</span>
                      <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 shrink-0 ml-3 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2.5 sm:gap-4 ${
                    msg.sender === 'user' ? 'justify-end' : 'justify-start'
                  }`}
                >
                  {/* Assistant Avatar */}
                  {msg.sender === 'assistant' && (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#171717] border border-[#262626] flex items-center justify-center shrink-0 text-emerald-400 text-xs shadow-md mt-1">
                      <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  )}

                  {/* Message Bubble & Content Wrapper */}
                  <div
                    className={`space-y-2.5 max-w-[90%] sm:max-w-[85%] ${
                      msg.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`p-3 sm:p-4 text-xs sm:text-sm leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-[#212121] text-slate-100 rounded-2xl sm:rounded-3xl rounded-tr-sm border border-[#2f2f2f] shadow-md'
                          : 'bg-transparent text-slate-100 rounded-2xl'
                      }`}
                    >
                      <p className="whitespace-pre-wrap">{msg.text}</p>
                    </div>

                    {/* Assistant Citations */}
                    {msg.sender === 'assistant' && msg.citations && msg.citations.length > 0 && (
                      <div className="bg-[#171717] border border-[#262626] rounded-2xl p-3 sm:p-3.5 space-y-2 text-xs">
                        <div className="flex items-center justify-between text-slate-400 border-b border-[#262626] pb-2">
                          <span className="font-semibold text-emerald-400 flex items-center gap-1.5 text-[11px] sm:text-xs">
                            <BookOpen className="w-3.5 h-3.5" /> Source Citations
                          </span>
                          {msg.generationTimeMs && (
                            <span className="font-mono text-[10px] text-slate-400">{msg.generationTimeMs}ms</span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 gap-2 pt-1">
                          {msg.citations.map((c, idx) => (
                            <div
                              key={idx}
                              className="bg-[#212121] border border-[#2f2f2f] p-2.5 rounded-xl text-slate-300 text-xs space-y-1"
                            >
                              <div className="font-semibold text-emerald-400 flex items-center gap-2 font-mono text-[10px] sm:text-[11px]">
                                <span>{c.pageRange || 'Page 1'}</span>
                                <span>•</span>
                                <span>Chunk #{c.chunkIndex}</span>
                              </div>
                              <p className="text-slate-400 italic leading-snug line-clamp-2 text-[11px] sm:text-xs">"{c.snippet}"</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Message Actions */}
                    <div className="flex items-center gap-3 px-1 text-[10px] sm:text-[11px] text-slate-500">
                      <span>{msg.timestamp}</span>
                      {msg.sender === 'assistant' && (
                        <button
                          onClick={() => copyToClipboard(msg.text, msg.id)}
                          className="hover:text-slate-300 flex items-center gap-1 transition-colors"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400 font-medium">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* User Avatar */}
                  {msg.sender === 'user' && (
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-blue-600 flex items-center justify-center shrink-0 text-white text-xs font-bold shadow-md mt-1">
                      <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    </div>
                  )}
                </div>
              ))
            )}

            {/* Live Generator Loader */}
            {isGenerating && (
              <div className="flex gap-2.5 sm:gap-4 items-start">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-[#171717] border border-[#262626] flex items-center justify-center shrink-0 text-emerald-400">
                  <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
                <div className="bg-[#171717] border border-[#262626] p-3 sm:p-4 rounded-2xl text-xs text-slate-300 flex items-center gap-3 shadow-md max-w-[90%] sm:max-w-none">
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-2 h-2 bg-teal-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" />
                  </div>
                  <span className="font-mono text-[11px] sm:text-xs text-slate-400 truncate">
                    Searching document vectors & synthesizing response...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* BOTTOM STICKY INPUT BAR */}
        <div className="p-2.5 sm:p-4 bg-[#0d0d0d] shrink-0 border-t border-[#1a1a1a]">
          <div className="max-w-3xl lg:max-w-4xl mx-auto w-full space-y-2">
            
            {/* Active Attachment Chip */}
            {extractionResult && (
              <div className="flex items-center gap-2 px-3 py-1 bg-[#171717] border border-[#262626] rounded-lg w-fit text-xs text-slate-300 max-w-full">
                <FileText className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                <span className="font-medium truncate max-w-[180px] sm:max-w-xs">{extractionResult.filename}</span>
                <span className="text-[10px] text-slate-500 font-mono shrink-0">({extractionResult.numPages} p)</span>
              </div>
            )}

            {/* Input Bar Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="relative flex items-center bg-[#171717] border border-[#262626] focus-within:border-slate-500 rounded-2xl sm:rounded-3xl p-1.5 sm:p-2 transition-all shadow-2xl"
            >
              {/* Paperclip Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Upload PDF document"
                className="p-2 sm:p-2.5 text-slate-400 hover:text-white hover:bg-[#212121] rounded-full transition-colors shrink-0"
              >
                <Paperclip className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
              </button>

              {/* Text Input */}
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder={
                  extractionResult
                    ? `Message CogniRAG about ${extractionResult.filename}...`
                    : 'Upload a PDF or ask a question...'
                }
                className="w-full bg-transparent border-0 focus:outline-none text-xs sm:text-sm text-slate-100 placeholder-slate-500 px-2 sm:px-3 py-1 min-w-0"
              />

              {/* Send Button */}
              <button
                type="submit"
                disabled={!inputQuery.trim() || isGenerating}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-white hover:bg-slate-200 text-black flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed shrink-0 shadow-md"
              >
                <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              </button>
            </form>

            {/* Footer Disclaimer */}
            <p className="text-[10px] sm:text-[11px] text-slate-500 text-center font-normal">
              CogniRAG can make mistakes. Verify important info against source PDF citations.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
