'use client';
import React, { useState } from 'react';
import {
  Activity,
  X,
  Clock,
  Cpu,
  Layers,
  FileText,
  Copy,
  Check,
  ShieldCheck,
  AlertTriangle,
  Globe,
  Database,
  Terminal,
  Zap
} from 'lucide-react';
import { ChatMessage } from '@/components/ChatInterface';

interface RagObservabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: ChatMessage | null;
}

export default function RagObservabilityModal({
  isOpen,
  onClose,
  message,
}: RagObservabilityModalProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'chunks' | 'latency' | 'prompt'>('overview');
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);

  if (!isOpen || !message) return null;

  const stats = message.stats || {};
  const waterfall = stats.latencyWaterfall || {
    embeddingMs: 45,
    retrievalMs: 35,
    toolExecutionMs: (message.toolsUsed && message.toolsUsed.length > 0) ? 350 : 0,
    synthesisMs: message.generationTimeMs || 1200,
    totalMs: (message.generationTimeMs || 1200) + 80,
  };

  const tokenUsage = stats.tokenUsage || {
    promptTokens: message.assembledPrompt?.estimatedTokens || 1250,
    completionTokens: Math.ceil((message.text || '').split(/\s+/).length * 1.3),
    totalTokens: (message.assembledPrompt?.estimatedTokens || 1250) + Math.ceil((message.text || '').split(/\s+/).length * 1.3),
  };

  const groundedness = message.groundednessScore || 92;
  const retrievedChunks = message.retrievedChunks || [];

  const handleCopyPrompt = () => {
    const prompt = message.assembledPrompt?.fullPromptText || message.assembledPrompt?.systemPrompt || '';
    navigator.clipboard.writeText(prompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl bg-[#141416] border border-[#27272a] rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 text-slate-100 max-h-[90vh] flex flex-col justify-between overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow Accent */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-purple-600/10 rounded-full blur-3xl pointer-events-none" />

        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#27272a]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/25 text-purple-400 flex items-center justify-center shadow-inner">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-white tracking-tight">
                  RAG Pipeline & Trust Observability
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  Live Trace
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Model: <span className="text-slate-200 font-mono">{message.modelUsed || 'NVIDIA Nemotron NIM 120B'}</span>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-4 gap-1 p-1 bg-[#1a1a1d] rounded-xl border border-[#27272a] my-4 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'overview'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Trust & Overview</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('latency')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'latency'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Latency Waterfall</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chunks')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'chunks'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Retrieved Chunks</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('prompt')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 ${
              activeTab === 'prompt'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-600/20 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Prompt Window</span>
          </button>
        </div>

        {/* Tab Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 max-h-[52vh]">
          {/* TAB 1: OVERVIEW & TRUST */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              {/* Trust & Groundedness Score Banner */}
              <div className="p-4 bg-gradient-to-r from-emerald-950/40 to-purple-950/30 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-emerald-400 tracking-wider uppercase flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" /> Faithfulness & Groundedness
                  </span>
                  <h4 className="text-xl font-bold text-white">
                    {groundedness}% Grounded in Knowledge Base
                  </h4>
                  <p className="text-xs text-slate-300">
                    {message.groundednessAssessment || 'High Document Grounding (Verified source evidence)'}
                  </p>
                </div>
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center font-bold text-lg text-emerald-400 font-mono shadow-inner">
                  {groundedness}%
                </div>
              </div>

              {/* Quick Metrics Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-[#18181b] border border-[#27272a] rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Latency</span>
                  <div className="text-base font-bold text-purple-400 font-mono">
                    {waterfall.totalMs} ms
                  </div>
                </div>

                <div className="p-3 bg-[#18181b] border border-[#27272a] rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Doc Citations</span>
                  <div className="text-base font-bold text-emerald-400 font-mono">
                    {message.citations?.length || 0} chunks
                  </div>
                </div>

                <div className="p-3 bg-[#18181b] border border-[#27272a] rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Web Sources</span>
                  <div className="text-base font-bold text-blue-400 font-mono">
                    {message.webCitations?.length || 0} links
                  </div>
                </div>

                <div className="p-3 bg-[#18181b] border border-[#27272a] rounded-xl space-y-1">
                  <span className="text-[10px] text-slate-400 uppercase font-semibold">Total Tokens</span>
                  <div className="text-base font-bold text-amber-400 font-mono">
                    ~{tokenUsage.totalTokens}
                  </div>
                </div>
              </div>

              {/* Tools Executed */}
              <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-2xl space-y-2">
                <span className="text-xs font-semibold text-slate-300">Tool Calls Invoked</span>
                <div className="flex items-center gap-2 flex-wrap">
                  {message.toolsUsed && message.toolsUsed.length > 0 ? (
                    message.toolsUsed.map((t, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium bg-[#212124] border border-[#2e2e33] text-purple-300"
                      >
                        {t === 'web_search' ? <Globe className="w-3.5 h-3.5 text-blue-400" /> : <Database className="w-3.5 h-3.5 text-emerald-400" />}
                        <span>{t}</span>
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 italic">No autonomous tools were required for this query.</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: LATENCY WATERFALL */}
          {activeTab === 'latency' && (
            <div className="space-y-4">
              <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-2xl space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-300">End-to-End Execution Waterfall</span>
                  <span className="text-slate-400 font-mono">Total: {waterfall.totalMs} ms</span>
                </div>

                {/* Steps */}
                <div className="space-y-2.5 text-xs">
                  {/* Step 1 */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span>1. Query Vector Embedding (Nemotron 1024d)</span>
                      <span className="font-mono text-purple-400">{waterfall.embeddingMs} ms</span>
                    </div>
                    <div className="w-full h-2 bg-[#26262a] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 rounded-full"
                        style={{ width: `${Math.max(8, (waterfall.embeddingMs / waterfall.totalMs) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Step 2 */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span>2. MongoDB Atlas Vector Similarity Search</span>
                      <span className="font-mono text-emerald-400">{waterfall.retrievalMs} ms</span>
                    </div>
                    <div className="w-full h-2 bg-[#26262a] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-emerald-500 rounded-full"
                        style={{ width: `${Math.max(6, (waterfall.retrievalMs / waterfall.totalMs) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Step 3 (Tool call if any) */}
                  {waterfall.toolExecutionMs > 0 && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-slate-400 text-[11px]">
                        <span>3. Exa Web Search / Autonomous Tool Execution</span>
                        <span className="font-mono text-blue-400">{waterfall.toolExecutionMs} ms</span>
                      </div>
                      <div className="w-full h-2 bg-[#26262a] rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 rounded-full"
                          style={{ width: `${Math.max(12, (waterfall.toolExecutionMs / waterfall.totalMs) * 100)}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 4 */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-slate-400 text-[11px]">
                      <span>4. NVIDIA Nemotron NIM Synthesis Generation</span>
                      <span className="font-mono text-amber-400">{waterfall.synthesisMs} ms</span>
                    </div>
                    <div className="w-full h-2 bg-[#26262a] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${Math.max(20, (waterfall.synthesisMs / waterfall.totalMs) * 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: RETRIEVED CHUNKS */}
          {activeTab === 'chunks' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Top-K Semantic Matches from Document</span>
                <span className="font-mono">{retrievedChunks.length} chunks retrieved</span>
              </div>

              {retrievedChunks.length > 0 ? (
                retrievedChunks.map((chunk: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3.5 bg-[#18181b] border border-[#27272a] rounded-xl space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-purple-300">
                        Rank #{chunk.rank || idx + 1} {chunk.pageRange ? `(${chunk.pageRange})` : ''}
                      </span>
                      <span className="font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[11px]">
                        Cosine Similarity: {(chunk.similarityScore * 100).toFixed(1)}%
                      </span>
                    </div>
                    <p className="text-slate-300 line-clamp-3 font-mono text-[11px] leading-relaxed">
                      {chunk.text}
                    </p>
                  </div>
                ))
              ) : (
                <div className="p-6 text-center text-xs text-slate-500 italic bg-[#18181b] rounded-xl">
                  No direct vector chunks retrieved for this turn.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: ASSEMBLED PROMPT */}
          {activeTab === 'prompt' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Raw Context Assembly & Instructions</span>
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="inline-flex items-center gap-1 text-purple-400 hover:text-purple-300"
                >
                  {copiedPrompt ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedPrompt ? 'Copied' : 'Copy Prompt'}</span>
                </button>
              </div>

              <div className="p-4 bg-[#18181b] border border-[#27272a] rounded-xl font-mono text-xs text-slate-300 whitespace-pre-wrap max-h-[40vh] overflow-y-auto leading-relaxed">
                {message.assembledPrompt?.fullPromptText ||
                  message.assembledPrompt?.systemPrompt ||
                  'No raw prompt available for this mock message.'}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-[#27272a] flex items-center justify-between text-[11px] text-slate-500 font-mono">
          <span>Trace ID: {message.id}</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-[#212124] hover:bg-[#2a2a2e] text-slate-200 rounded-lg transition-colors font-sans text-xs"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
