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
  ChevronDown,
  Globe,
  ExternalLink,
  MessageSquare,
  Settings,
  Activity,
  ShieldCheck,
  Sliders,
  History,
  Info
} from 'lucide-react';
import EditProfileModal from '@/components/EditProfileModal';
import PdfSideViewer, { ActiveCitation } from '@/components/PdfSideViewer';
import RagObservabilityModal from '@/components/RagObservabilityModal';
import RagSettingsModal, { RagSettings } from '@/components/RagSettingsModal';
import { PDFExtractionResult } from '@/lib/pdf/extractor';
import { ChunkingResult, chunkText } from '@/lib/chunking/chunker';
import { EmbeddingResult } from '@/lib/embeddings/embedder';
import type { RagQueryResult } from '@/lib/rag/queryEngine';

export interface WebCitationItem {
  title: string;
  url: string;
  snippet?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  citations?: { pageRange?: string; chunkIndex: number; snippet: string }[];
  webCitations?: WebCitationItem[];
  toolsUsed?: string[];
  modelUsed?: string;
  generationTimeMs?: number;
  groundednessScore?: number;
  groundednessAssessment?: string;
  retrievedChunks?: any[];
  stats?: any;
  assembledPrompt?: any;
}

const SAMPLE_QUESTIONS = [
  { text: 'What is the main topic of the uploaded document?', type: 'doc' },
  { text: 'What are the latest NVIDIA GPU and AI announcements?', type: 'web' },
  { text: 'Compare the document conclusions with current industry benchmarks.', type: 'hybrid' },
  { text: 'Summarize key requirements, metrics, and dates.', type: 'doc' },
];

export default function ChatInterface() {
  const { user, logout } = useAuth();

  // Layout State
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(true);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState<boolean>(false);

  // Document & Pipeline State
  const [extractionResult, setExtractionResult] = useState<PDFExtractionResult | null>(null);
  const [chunkingResult, setChunkingResult] = useState<ChunkingResult | null>(null);
  const [embeddingResult, setEmbeddingResult] = useState<EmbeddingResult | null>(null);
  const [pdfFileUrl, setPdfFileUrl] = useState<string | null>(null);

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

  // Sessions State
  const [sessions, setSessions] = useState<any[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Observability & Settings State
  const [selectedObservabilityMsg, setSelectedObservabilityMsg] = useState<ChatMessage | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [ragSettings, setRagSettings] = useState<RagSettings>({
    topK: 5,
    minScore: 0.0,
    temperature: 0.7,
    webSearchEnabled: true,
  });

  // NotebookLM Side-by-Side PDF & Citation Viewer State
  const [isPdfViewerOpen, setIsPdfViewerOpen] = useState<boolean>(false);
  const [activeCitation, setActiveCitation] = useState<ActiveCitation | null>(null);

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

  // Rehydrate MongoDB Vector DB when restoring a session's document
  const rehydrateVectorDb = async (embeddings: any[], sessionId?: string | null) => {
    if (!embeddings || embeddings.length === 0) return;
    try {
      await fetch('/api/pdf/vectordb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert',
          records: embeddings.map((e: any) => ({
            id: `${sessionId ? sessionId + '_' : ''}${e.chunkId || `chunk_${e.chunkIndex}`}`,
            chunkIndex: e.chunkIndex,
            text: e.text,
            pageRange: e.pageRange || 'Page 1',
            vector: e.vector,
            estimatedTokens: e.estimatedTokens || 0,
            sessionId: sessionId || undefined,
            metadata: {
              chunkId: e.chunkId,
              text: e.text,
              pageRange: e.pageRange || 'Page 1',
              charLength: e.text?.length,
              tokenCount: e.estimatedTokens,
              sessionId: sessionId || undefined,
            },
          })),
        }),
      });
    } catch (err) {
      console.warn('Vector rehydration error:', err);
    }
  };

  // Load chat sessions on mount & auto-select the latest session if available
  useEffect(() => {
    loadSessions(true);
  }, [user]);

  const loadSessions = async (autoSelectFirst = false) => {
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('token') || localStorage.getItem('rag_auth_token')
          : null;
      const res = await fetch('/api/chat/sessions', {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.sessions) {
          setSessions(data.sessions);
          if (autoSelectFirst && data.sessions.length > 0) {
            const firstId = data.sessions[0].id || data.sessions[0]._id;
            selectSession(firstId);
          }
        }
      }
    } catch (err) {
      console.warn('Could not load chat sessions:', err);
    }
  };

  const selectSession = async (sessionId: string) => {
    setActiveSessionId(sessionId);
    setActiveCitation(null);
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('token') || localStorage.getItem('rag_auth_token')
          : null;
      const res = await fetch(`/api/chat/sessions/${sessionId}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.session) {
          setMessages(data.session.messages || []);
          // Restore the specific document attached to this chat session
          if (
            data.session.document &&
            (data.session.document.extractionResult || data.session.document.cloudinaryUrl)
          ) {
            const doc = data.session.document;
            setExtractionResult(doc.extractionResult || null);
            setChunkingResult(doc.chunkingResult || null);
            setEmbeddingResult(doc.embeddingResult || null);
            setPdfFileUrl(doc.cloudinaryUrl || null);
            if (doc.embeddingResult?.embeddings) {
              rehydrateVectorDb(doc.embeddingResult.embeddings, sessionId);
            }
          } else {
            // Explicitly clear document state if this session has no attached PDF
            setExtractionResult(null);
            setChunkingResult(null);
            setEmbeddingResult(null);
            setPdfFileUrl(null);
          }
        }
      }
    } catch (err) {
      console.error('Error switching session:', err);
    }
  };

  const startNewChat = (clearDocument = true) => {
    setActiveSessionId(null);
    setMessages([]);
    setActiveCitation(null);
    if (clearDocument) {
      setExtractionResult(null);
      setChunkingResult(null);
      setEmbeddingResult(null);
      setPdfFileUrl(null);
    }
  };

  const deleteSession = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    try {
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('token') || localStorage.getItem('rag_auth_token')
          : null;
      await fetch(`/api/chat/sessions/${sessionId}`, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
      });
      setSessions((prev) => prev.filter((s) => s.id !== sessionId && s._id !== sessionId));
      if (activeSessionId === sessionId) {
        startNewChat();
      }
    } catch (err) {
      console.error('Failed to delete session:', err);
    }
  };

  // Handle PDF Upload & Auto-Index with Cloudinary & MongoDB Persistence
  const processPdfFile = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      setUploadError('Please select a valid PDF file (.pdf).');
      return;
    }

    setUploadError(null);
    setIsIndexing(true);
    setIndexingStatus('Extracting text & uploading to Cloudinary storage...');

    try {
      // Store local object URL for instant preview
      const objectUrl = URL.createObjectURL(file);
      setPdfFileUrl(objectUrl);

      // 1. Extract PDF Text & upload to Cloudinary concurrently
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
      if (parseData.cloudinaryUrl) {
        setPdfFileUrl(parseData.cloudinaryUrl);
      }

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

      // 4. Determine or create the session for this PDF
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('token') || localStorage.getItem('rag_auth_token')
          : null;

      const docPayload = {
        filename: file.name,
        cloudinaryUrl: parseData.cloudinaryUrl || null,
        cloudinaryPublicId: parseData.cloudinaryPublicId || null,
        pageCount: parseData.numPages,
        chunkCount: chunkRes.chunks.length,
        extractionResult: parseData,
        chunkingResult: chunkRes,
        embeddingResult: embedData,
      };

      const metaPayload = {
        filename: file.name,
        pageCount: parseData.numPages,
        chunkCount: chunkRes.chunks.length,
        cloudinaryUrl: parseData.cloudinaryUrl || null,
      };

      let currentSessionId = activeSessionId;

      if (!currentSessionId) {
        // Automatically create a new session dedicated to this document!
        try {
          const createRes = await fetch('/api/chat/sessions', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            credentials: 'include',
            body: JSON.stringify({
              title: file.name.replace(/\.pdf$/i, ''),
              messages: [],
              pdfMetadata: metaPayload,
              document: docPayload,
            }),
          });
          if (createRes.ok) {
            const createData = await createRes.json();
            const newId = createData.session?.id || createData.session?._id;
            if (newId) {
              currentSessionId = newId;
              setActiveSessionId(newId);
              loadSessions(false);
            }
          }
        } catch (createErr) {
          console.warn('Failed to auto-create session for uploaded PDF:', createErr);
        }
      } else {
        // Attach to the active session
        try {
          await fetch(`/api/chat/sessions/${currentSessionId}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            credentials: 'include',
            body: JSON.stringify({
              document: docPayload,
              pdfMetadata: metaPayload,
            }),
          });
          loadSessions(false);
        } catch (patchErr) {
          console.warn('Failed to update active session with document:', patchErr);
        }
      }

      // 5. Store vectors in MongoDB Vector DB scoped to this session
      setIndexingStatus('Indexing vectors in MongoDB Vector DB...');
      if (currentSessionId) {
        await fetch('/api/pdf/vectordb', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clear', sessionId: currentSessionId }),
        });
      }

      await fetch('/api/pdf/vectordb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upsert',
          records: embedData.embeddings.map((e) => ({
            id: `${currentSessionId ? currentSessionId + '_' : ''}${e.chunkId || `chunk_${e.chunkIndex}`}`,
            vector: e.vector,
            chunkIndex: e.chunkIndex,
            text: e.text,
            pageRange: e.pageRange || 'Page 1',
            estimatedTokens: e.estimatedTokens || 0,
            sessionId: currentSessionId || undefined,
            metadata: {
              chunkId: e.chunkId,
              text: e.text,
              pageRange: e.pageRange || 'Page 1',
              charLength: e.text.length,
              tokenCount: e.estimatedTokens,
              sessionId: currentSessionId || undefined,
            },
          })),
        }),
      });

      // Automatically open the side viewer to inspect the uploaded document!
      setIsPdfViewerOpen(true);
    } catch (err: any) {
      console.error('PDF Processing error:', err);
      setUploadError(err.message || 'Failed to process document');
    } finally {
      setIsIndexing(false);
      setIndexingStatus('');
    }
  };

  // Interactive Citation Click Handler
  const handleCitationClick = (citation: {
    pageRange?: string;
    chunkIndex: number;
    snippet: string;
    similarityScore?: number;
  }) => {
    setActiveCitation(citation);
    setIsPdfViewerOpen(true);
  };

  // Send Message with Progressive Streaming Animation
  const handleSendMessage = async (queryTextToSubmit?: string) => {
    const query = queryTextToSubmit || inputQuery;
    if (!query.trim() || isGenerating) return;

    setUploadError(null);

    const userMsgId = `user_${Date.now()}`;
    const newUserMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text: query.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const updatedMessages = [...messages, newUserMsg];
    setMessages(updatedMessages);
    if (!queryTextToSubmit) setInputQuery('');
    setIsGenerating(true);

    try {
      const response = await fetch('/api/pdf/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queryText: query.trim(),
          webSearchEnabled: ragSettings.webSearchEnabled,
          topK: ragSettings.topK,
          minScore: ragSettings.minScore,
          apiKey: ragSettings.apiKey,
          temperature: ragSettings.temperature,
          chunks: chunkingResult?.chunks || [],
          embeddings: embeddingResult?.embeddings || [],
          sessionId: activeSessionId || undefined,
        }),
      });

      const ragRes: RagQueryResult = await response.json();
      if (!response.ok || !ragRes.success) {
        throw new Error((ragRes as any).error || 'Failed to generate response from server');
      }

      const fullAnswerText = ragRes.synthesizedAnswer.answerText;
      const assistantMsgId = `assistant_${Date.now()}`;

      // Progressive Typewriter Streaming Animation for instant responsive feel
      const initialAssistantMsg: ChatMessage = {
        id: assistantMsgId,
        sender: 'assistant',
        text: '',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        citations: ragRes.synthesizedAnswer.citations,
        webCitations: ragRes.synthesizedAnswer.webCitations,
        toolsUsed: ragRes.synthesizedAnswer.toolsUsed,
        modelUsed: ragRes.synthesizedAnswer.modelUsed,
        generationTimeMs: ragRes.stats.totalTimeMs,
        groundednessScore: ragRes.groundednessScore,
        groundednessAssessment: ragRes.groundednessAssessment,
        retrievedChunks: ragRes.retrievedChunks,
        stats: ragRes.stats,
        assembledPrompt: ragRes.assembledPrompt,
      };

      setMessages([...updatedMessages, initialAssistantMsg]);

      // Stream text in fast realistic chunks
      const words = fullAnswerText.split(' ');
      let currentWordIndex = 0;
      const CHUNK_SIZE = 3;

      await new Promise<void>((resolve) => {
        const interval = setInterval(() => {
          currentWordIndex += CHUNK_SIZE;
          const currentSlice = words.slice(0, currentWordIndex).join(' ');

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsgId ? { ...m, text: currentSlice } : m
            )
          );

          if (currentWordIndex >= words.length) {
            clearInterval(interval);
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsgId ? { ...m, text: fullAnswerText } : m
              )
            );
            resolve();
          }
        }, 30);
      });

      const finalAssistantMsg: ChatMessage = {
        ...initialAssistantMsg,
        text: fullAnswerText,
      };

      const finalMessageList = [...updatedMessages, finalAssistantMsg];

      // Persist to MongoDB Chat Sessions
      const token =
        typeof window !== 'undefined'
          ? localStorage.getItem('token') || localStorage.getItem('rag_auth_token')
          : null;

      if (!activeSessionId) {
        // Create new session with title auto-derived from first question
        const autoTitle = query.length > 35 ? `${query.slice(0, 35)}...` : query;
        const createRes = await fetch('/api/chat/sessions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({
            title: autoTitle,
            messages: finalMessageList,
            pdfMetadata: extractionResult
              ? {
                  filename: extractionResult.filename,
                  pageCount: extractionResult.numPages,
                  chunkCount: chunkingResult?.chunks.length,
                }
              : undefined,
            document: extractionResult
              ? {
                  filename: extractionResult.filename,
                  cloudinaryUrl: extractionResult.cloudinaryUrl || (pdfFileUrl?.startsWith('http') ? pdfFileUrl : null),
                  cloudinaryPublicId: extractionResult.cloudinaryPublicId || null,
                  pageCount: extractionResult.numPages,
                  chunkCount: chunkingResult?.chunks.length,
                  extractionResult,
                  chunkingResult,
                  embeddingResult,
                }
              : undefined,
          }),
        });

        if (createRes.ok) {
          const createData = await createRes.json();
          if (createData.session?.id || createData.session?._id) {
            setActiveSessionId(createData.session.id || createData.session._id);
            loadSessions();
          }
        }
      } else {
        // Update existing session
        await fetch(`/api/chat/sessions/${activeSessionId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({
            messages: finalMessageList,
          }),
        });
      }
    } catch (err: any) {
      console.error('Query error:', err);
      const errorMsg: ChatMessage = {
        id: `error_${Date.now()}`,
        sender: 'assistant',
        text: `⚠️ **Error:** ${err.message || 'An error occurred while synthesizing your answer.'}`,
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

      {/* LEFT SIDEBAR (History & Sessions) */}
      <aside
        className={`fixed md:relative inset-y-0 left-0 bg-[#171717] border-r border-[#262626] flex flex-col justify-between transition-all duration-300 ease-in-out shrink-0 z-40 md:z-20 h-full ${
          isSidebarOpen
            ? 'w-72 sm:w-80 p-3 opacity-100 translate-x-0'
            : '-translate-x-full md:translate-x-0 md:w-0 p-0 border-0 overflow-hidden opacity-0 pointer-events-none'
        }`}
      >
        <div className="space-y-3.5 flex-1 overflow-y-auto pr-0.5">
          {/* Sidebar Top Header */}
          <div className="flex items-center justify-between px-2 pt-1 pb-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-emerald-600 flex items-center justify-center text-white font-bold shadow-md">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <span className="font-semibold text-sm text-slate-100 tracking-tight block leading-tight">CogniRAG</span>
                <span className="text-[10px] text-purple-400 font-mono">Document Intelligence</span>
              </div>
            </div>

            <button
              onClick={() => setIsSidebarOpen(false)}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-[#212121] rounded-lg transition-colors"
              title="Close sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </div>

          {/* "+ New Chat" Action Buttons */}
          <div className="space-y-1.5">
            <button
              onClick={() => startNewChat(false)}
              className="w-full py-2 px-3 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20"
            >
              <Plus className="w-4 h-4" />
              <span>New Chat Session</span>
            </button>

            <button
              onClick={() => {
                startNewChat(true);
                fileInputRef.current?.click();
              }}
              disabled={isIndexing}
              className="w-full py-2 px-3 bg-[#212121] hover:bg-[#282828] border border-[#2f2f2f] hover:border-slate-600 text-slate-200 rounded-xl text-xs font-medium transition-all flex items-center gap-2.5 group"
              title="Start a new chat with a fresh PDF document"
            >
              <div className="w-5 h-5 rounded-md bg-emerald-500/10 text-emerald-400 group-hover:bg-emerald-500/20 flex items-center justify-center transition-colors">
                <FileUp className="w-3.5 h-3.5" />
              </div>
              <span className="truncate">New Chat with New PDF</span>
            </button>
          </div>

          {/* Active Document Section */}
          <div className="space-y-1.5 pt-1">
            <div className="px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Active Document</span>
              {extractionResult && (
                <button
                  type="button"
                  onClick={() => setIsPdfViewerOpen(!isPdfViewerOpen)}
                  className="text-purple-400 hover:text-purple-300 normal-case flex items-center gap-1"
                >
                  <BookOpen className="w-3 h-3" />
                  <span>Inspect</span>
                </button>
              )}
            </div>

            {extractionResult ? (
              <div
                className="bg-[#212121] hover:bg-[#252528] border border-[#2f2f2f] hover:border-purple-500/30 rounded-xl p-3 space-y-2.5 transition-all shadow-sm group"
              >
                <div
                  onClick={() => setIsPdfViewerOpen(true)}
                  className="flex items-start gap-2.5 cursor-pointer"
                >
                  <div className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg border border-blue-500/20 shrink-0">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-semibold text-slate-100 truncate group-hover:text-purple-300 transition-colors" title={extractionResult.filename}>
                      {extractionResult.filename}
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                      {extractionResult.numPages} pages • {(extractionResult.stats.fileSizeBytes / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>

                {/* Cloudinary & Vector Index Status */}
                <div className="flex items-center justify-between pt-1 border-t border-[#2f2f2f] text-[10px]">
                  <span className="text-slate-400 font-mono">{chunkingResult?.chunks.length || 0} vectors</span>
                  <div className="flex items-center gap-1.5">
                    {(extractionResult.cloudinaryUrl || pdfFileUrl?.startsWith('http')) && (
                      <span className="text-cyan-400 font-medium text-[9px] bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/20" title="PDF backed up on Cloudinary">
                        ☁️ Cloudinary
                      </span>
                    )}
                    <span className="text-emerald-400 font-medium flex items-center gap-0.5">
                      <CheckCircle2 className="w-3 h-3" /> Indexed
                    </span>
                  </div>
                </div>

                {/* Change or Upload New Action */}
                <div className="flex items-center justify-between pt-1 text-[10px] text-slate-400 border-t border-[#262626]">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="text-slate-400 hover:text-purple-300 transition-colors flex items-center gap-1"
                  >
                    <FileUp className="w-2.5 h-2.5" />
                    <span>Change PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const prevSessionId = activeSessionId;
                      const targetCloudinaryPublicId = extractionResult?.cloudinaryPublicId;
                      const targetCloudinaryUrl = pdfFileUrl;

                      setExtractionResult(null);
                      setChunkingResult(null);
                      setEmbeddingResult(null);
                      setPdfFileUrl(null);
                      setActiveCitation(null);

                      // 1. Delete PDF from Cloudinary
                      if (targetCloudinaryPublicId || targetCloudinaryUrl) {
                        try {
                          await fetch('/api/pdf/delete', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              publicId: targetCloudinaryPublicId,
                              url: targetCloudinaryUrl,
                            }),
                          });
                        } catch (cloudErr) {
                          console.warn('Failed to delete file from Cloudinary on detach:', cloudErr);
                        }
                      }

                      // 2. If session active, clear document and session vectors
                      if (prevSessionId) {
                        const token =
                          typeof window !== 'undefined'
                            ? localStorage.getItem('token') || localStorage.getItem('rag_auth_token')
                            : null;
                        try {
                          await fetch(`/api/chat/sessions/${prevSessionId}`, {
                            method: 'PATCH',
                            headers: {
                              'Content-Type': 'application/json',
                              ...(token ? { Authorization: `Bearer ${token}` } : {}),
                            },
                            credentials: 'include',
                            body: JSON.stringify({ document: null, pdfMetadata: null }),
                          });
                          await fetch('/api/pdf/vectordb', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: 'clear', sessionId: prevSessionId }),
                          });
                          loadSessions(false);
                        } catch (detachErr) {
                          console.warn('Failed to detach document from session:', detachErr);
                        }
                      }
                    }}
                    className="text-slate-500 hover:text-red-400 transition-colors"
                  >
                    Detach
                  </button>
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border border-dashed border-[#2f2f2f] hover:border-slate-600 bg-[#212121]/40 hover:bg-[#212121] rounded-xl p-3 text-center transition-all cursor-pointer group space-y-1"
              >
                <FileUp className="w-4 h-4 mx-auto text-slate-400 group-hover:text-purple-400 transition-colors" />
                <p className="text-xs font-medium text-slate-300">No active document</p>
                <p className="text-[10px] text-slate-500">Upload PDF (saved to Cloudinary)</p>
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
            <div className="p-2.5 bg-red-950/40 border border-red-500/30 rounded-xl text-red-300 text-xs flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 min-w-0">
                <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-tight">{uploadError}</span>
              </div>
              <button
                onClick={() => setUploadError(null)}
                className="text-red-400 hover:text-red-200 text-xs font-bold shrink-0 ml-1"
              >
                ×
              </button>
            </div>
          )}

          {/* Persistent Sessions History */}
          <div className="space-y-1 pt-2">
            <div className="px-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <History className="w-3 h-3" /> Previous Chats
              </span>
              <span className="text-[10px] font-mono text-slate-500">{sessions.length}</span>
            </div>

            <div className="space-y-1 max-h-[35vh] overflow-y-auto pr-0.5">
              {sessions.length > 0 ? (
                sessions.map((s) => {
                  const sId = s.id || s._id;
                  const isActive = activeSessionId === sId;
                  return (
                    <div
                      key={sId}
                      onClick={() => selectSession(sId)}
                      className={`p-2 rounded-xl text-xs transition-all flex items-center justify-between group cursor-pointer ${
                        isActive
                          ? 'bg-purple-600/15 border border-purple-500/30 text-purple-200 font-medium'
                          : 'text-slate-300 hover:text-white hover:bg-[#212121] border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
                        <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-purple-400' : 'text-slate-500'}`} />
                        <span className="truncate">{s.title || 'Conversation'}</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => deleteSession(e, sId)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-red-400 transition-opacity rounded"
                        title="Delete chat"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })
              ) : (
                <p className="text-[11px] text-slate-500 px-2 italic py-1">No past sessions saved yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Footer User Profile */}
        {user && (
          <div className="pt-3 border-t border-[#262626] flex items-center justify-between px-1">
            <div
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-2.5 min-w-0 flex-1 p-1 -ml-1 rounded-lg hover:bg-[#212121] cursor-pointer transition-colors group"
              title="Edit profile"
            >
              {user.profilePic ? (
                <img
                  src={user.profilePic}
                  alt={user.name}
                  className="w-7 h-7 rounded-full object-cover shrink-0 ring-1 ring-white/10"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#9353d3] flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-200 truncate group-hover:text-white transition-colors">{user.name}</p>
                <p className="text-[10px] text-slate-400 truncate">@{user.username || user.email.split('@')[0]}</p>
              </div>
            </div>
            <button
              onClick={() => logout()}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-[#212121] rounded-lg transition-colors ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </aside>

      {/* RIGHT MAIN WORKSPACE */}
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

            {/* Model Badge */}
            <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 bg-[#171717] border border-[#262626] rounded-xl text-xs font-medium shrink-0">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
              <span className="text-slate-200 font-semibold truncate text-[11px] sm:text-xs">Nemotron-3 Super 120B</span>
              <span className="text-[10px] text-purple-400 font-mono hidden sm:inline">NIM</span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {/* Split Screen PDF Viewer Toggle */}
            <button
              type="button"
              onClick={() => setIsPdfViewerOpen(!isPdfViewerOpen)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 ${
                isPdfViewerOpen
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20'
                  : 'bg-[#171717] hover:bg-[#212121] border border-[#262626] text-slate-300'
              }`}
              title="Toggle side-by-side document citation viewer"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Citation Inspector</span>
            </button>

            {/* RAG Settings / BYOK Button */}
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="p-2 bg-[#171717] hover:bg-[#212121] border border-[#262626] text-slate-300 hover:text-white rounded-xl text-xs transition-colors"
              title="Configure RAG Hyperparameters (Top-K, threshold, temperature, BYOK)"
            >
              <Sliders className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Chat Feed */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6">
          <div className="max-w-3xl lg:max-w-4xl mx-auto w-full space-y-5 sm:space-y-6">
            {messages.length === 0 ? (
              <div className="min-h-[55vh] sm:min-h-[60vh] flex flex-col items-center justify-center text-center space-y-6 sm:space-y-8 py-6 sm:py-10">
                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#171717] border border-[#262626] flex items-center justify-center shadow-2xl text-purple-400">
                  <Sparkles className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>

                <div className="space-y-2 max-w-md px-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
                    Document Intelligence & RAG Workbench
                  </h1>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Powered by NVIDIA Nemotron 3 Super 120B NIM with live Exa Web Search and interactive citation exploration.
                  </p>
                </div>

                {/* Active Document Status or Upload Prompt */}
                {extractionResult ? (
                  <div className="w-full max-w-2xl bg-[#171717] border border-[#262626] rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-left shadow-lg">
                    <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-slate-100 truncate max-w-[200px] sm:max-w-xs">{extractionResult.filename}</span>
                          {(extractionResult.cloudinaryUrl || pdfFileUrl?.startsWith('http')) && (
                            <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/40 px-1.5 py-0.5 rounded border border-cyan-500/20 shrink-0">
                              ☁️ Cloudinary Saved
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                          {extractionResult.numPages} pages • {chunkingResult?.chunks.length || 0} indexed vectors
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                      <button
                        type="button"
                        onClick={() => setIsPdfViewerOpen(true)}
                        className="px-3 py-1.5 bg-[#212121] hover:bg-[#282828] border border-[#2f2f2f] text-slate-300 hover:text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-purple-400" />
                        <span>Inspect</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-medium transition-colors flex items-center gap-1.5 shadow-md shadow-purple-600/20"
                      >
                        <FileUp className="w-3.5 h-3.5" />
                        <span>Upload New PDF</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full max-w-2xl bg-gradient-to-r from-purple-900/20 via-[#171717] to-emerald-900/20 border border-purple-500/30 hover:border-purple-500/50 rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer transition-all group shadow-lg"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-300 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                        <FileUp className="w-5 h-5" />
                      </div>
                      <div className="text-left">
                        <h4 className="text-xs sm:text-sm font-semibold text-slate-100 group-hover:text-purple-300 transition-colors">
                          Upload a PDF for this chat
                        </h4>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Files are automatically stored in Cloudinary and restored across sessions & logins.
                        </p>
                      </div>
                    </div>
                    <div className="px-3 py-1.5 bg-purple-600 group-hover:bg-purple-500 text-white rounded-xl text-xs font-medium transition-colors shrink-0 flex items-center gap-1">
                      <span>Upload</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                )}

                {/* Sample Prompt Cards */}
                <div className="w-full max-w-2xl grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3 text-left">
                  {SAMPLE_QUESTIONS.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(q.text)}
                      className="p-3.5 sm:p-4 bg-[#171717] hover:bg-[#212121] border border-[#262626] hover:border-slate-600 rounded-2xl text-xs text-slate-300 hover:text-white transition-all flex items-center justify-between group shadow-sm"
                    >
                      <div className="space-y-1 pr-2">
                        <span className="line-clamp-2 leading-relaxed">{q.text}</span>
                        <span className="inline-block text-[9px] font-mono px-1.5 py-0.5 rounded bg-white/5 text-slate-400">
                          {q.type === 'web' ? '🌐 Web' : q.type === 'doc' ? '📄 Doc' : '⚡ Hybrid'}
                        </span>
                      </div>
                      <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 shrink-0 ml-1 transition-colors" />
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

                  {/* Message Bubble */}
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

                    {/* Groundedness & Observability Badges */}
                    {msg.sender === 'assistant' && msg.groundednessScore !== undefined && (
                      <div className="flex items-center gap-2 flex-wrap px-1 pt-0.5">
                        {/* Groundedness Badge */}
                        <div
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                            msg.groundednessScore >= 85
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/25'
                              : msg.groundednessScore >= 70
                              ? 'bg-purple-500/10 text-purple-300 border-purple-500/25'
                              : 'bg-amber-500/10 text-amber-300 border-amber-500/25'
                          }`}
                        >
                          <ShieldCheck className="w-3 h-3" />
                          <span>{msg.groundednessScore}% Grounded</span>
                        </div>

                        {/* Inspect RAG Button */}
                        <button
                          type="button"
                          onClick={() => setSelectedObservabilityMsg(msg)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium bg-[#1c1c1f] hover:bg-[#252528] text-slate-300 hover:text-white border border-[#2e2e33] transition-colors"
                        >
                          <Activity className="w-3 h-3 text-purple-400" />
                          <span>Inspect RAG Pipeline</span>
                        </button>
                      </div>
                    )}

                    {/* Exa Web Citations */}
                    {msg.sender === 'assistant' && msg.webCitations && msg.webCitations.length > 0 && (
                      <div className="bg-[#171717] border border-[#262626] rounded-2xl p-3 sm:p-3.5 space-y-2 text-xs">
                        <div className="flex items-center justify-between text-slate-400 border-b border-[#262626] pb-2">
                          <span className="font-semibold text-purple-400 flex items-center gap-1.5 text-[11px] sm:text-xs">
                            <Globe className="w-3.5 h-3.5" /> Web Sources (Exa)
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">{msg.webCitations.length} sources</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {msg.webCitations.map((web, idx) => (
                            <a
                              key={idx}
                              href={web.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-[#212121] hover:bg-[#282828] border border-[#2f2f2f] hover:border-purple-500/40 p-2.5 rounded-xl text-slate-300 text-xs space-y-1 transition-all group block"
                            >
                              <div className="flex items-center justify-between text-purple-300 font-medium text-[11px]">
                                <span className="truncate max-w-[200px]">{web.title || web.url}</span>
                                <ExternalLink className="w-3 h-3 text-slate-500 group-hover:text-purple-400 shrink-0 ml-1 transition-colors" />
                              </div>
                              {web.snippet && (
                                <p className="text-slate-400 text-[10px] line-clamp-2 leading-relaxed">
                                  {web.snippet}
                                </p>
                              )}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Assistant Citations (Interactive NotebookLM Click to Inspect) */}
                    {msg.sender === 'assistant' && msg.citations && msg.citations.length > 0 && (
                      <div className="bg-[#171717] border border-[#262626] rounded-2xl p-3 sm:p-3.5 space-y-2 text-xs">
                        <div className="flex items-center justify-between text-slate-400 border-b border-[#262626] pb-2">
                          <span className="font-semibold text-emerald-400 flex items-center gap-1.5 text-[11px] sm:text-xs">
                            <BookOpen className="w-3.5 h-3.5" /> Document Evidence (Click to inspect)
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">{msg.citations.length} cited chunks</span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          {msg.citations.map((c, idx) => (
                            <div
                              key={idx}
                              onClick={() => handleCitationClick(c)}
                              className="bg-[#212121] hover:bg-[#28282b] border border-[#2f2f2f] hover:border-purple-500/40 p-2.5 rounded-xl text-slate-300 text-xs space-y-1 cursor-pointer transition-all group shadow-sm"
                            >
                              <div className="font-semibold text-emerald-400 flex items-center justify-between font-mono text-[10px] sm:text-[11px]">
                                <span>{c.pageRange || 'Page 1'} • Chunk #{c.chunkIndex}</span>
                                <ArrowUpRight className="w-3 h-3 text-slate-500 group-hover:text-purple-400 transition-colors" />
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
                    <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" />
                  </div>
                  <span className="font-mono text-[11px] sm:text-xs text-slate-400 truncate">
                    Synthesizing response & verifying source groundedness...
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

              {/* Web Search Toggle Pill */}
              <button
                type="button"
                onClick={() =>
                  setRagSettings((prev) => ({ ...prev, webSearchEnabled: !prev.webSearchEnabled }))
                }
                title={ragSettings.webSearchEnabled ? 'Live Web Search: ON' : 'Live Web Search: OFF'}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all shrink-0 ml-1 ${
                  ragSettings.webSearchEnabled
                    ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                    : 'bg-neutral-800/80 text-neutral-400 border border-neutral-700 hover:text-neutral-200'
                }`}
              >
                <Globe className="w-3 h-3" />
                <span className="hidden sm:inline">Web Search</span>
              </button>

              {/* Text Input */}
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder={
                  extractionResult
                    ? `Ask about ${extractionResult.filename} or search the web...`
                    : 'Ask anything or search the web with Exa...'
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
              CogniRAG powered by NVIDIA Nemotron-3 Super 120B NIM with Groundedness Verification.
            </p>
          </div>
        </div>
      </main>

      {/* NotebookLM-style Interactive PDF & Citation Side Inspector */}
      <PdfSideViewer
        isOpen={isPdfViewerOpen}
        onClose={() => setIsPdfViewerOpen(false)}
        activeCitation={activeCitation}
        extractionResult={extractionResult}
        chunkingResult={chunkingResult}
        pdfFileUrl={pdfFileUrl}
      />

      {/* RAG Pipeline Observability Modal */}
      <RagObservabilityModal
        isOpen={!!selectedObservabilityMsg}
        onClose={() => setSelectedObservabilityMsg(null)}
        message={selectedObservabilityMsg}
      />

      {/* RAG Hyperparameters & BYOK Settings Modal */}
      <RagSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={ragSettings}
        onSaveSettings={(newSettings) => setRagSettings(newSettings)}
      />

      {/* Edit Profile Modal */}
      <EditProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
      />
    </div>
  );
}
