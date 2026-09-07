'use client';
import React, { useState } from 'react';
import {
  Settings,
  X,
  Sliders,
  Sparkles,
  Key,
  Globe,
  Database,
  Check,
  RotateCcw
} from 'lucide-react';

export interface RagSettings {
  topK: number;
  minScore: number;
  temperature: number;
  webSearchEnabled: boolean;
  apiKey?: string;
}

interface RagSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: RagSettings;
  onSaveSettings: (newSettings: RagSettings) => void;
}

export default function RagSettingsModal({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}: RagSettingsModalProps) {
  const [topK, setTopK] = useState<number>(settings.topK);
  const [minScore, setMinScore] = useState<number>(settings.minScore);
  const [temperature, setTemperature] = useState<number>(settings.temperature);
  const [webSearchEnabled, setWebSearchEnabled] = useState<boolean>(settings.webSearchEnabled);
  const [apiKey, setApiKey] = useState<string>(settings.apiKey || '');
  const [isSaved, setIsSaved] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings({
      topK,
      minScore,
      temperature,
      webSearchEnabled,
      apiKey: apiKey.trim() || undefined,
    });
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 600);
  };

  const handleReset = () => {
    setTopK(5);
    setMinScore(0.0);
    setTemperature(0.7);
    setWebSearchEnabled(true);
    setApiKey('');
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md bg-[#141416] border border-[#27272a] rounded-2xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 text-slate-100 max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between pb-4 border-b border-[#27272a]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/25 text-purple-400 flex items-center justify-center">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">RAG Hyperparameters & BYOK</h3>
              <p className="text-xs text-slate-400">Configure retrieval bounds and models</p>
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

        <form onSubmit={handleSave} className="py-4 space-y-5">
          {/* Top-K Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Top-K Retrieval Count</span>
              <span className="font-mono text-purple-400 font-bold px-2 py-0.5 rounded bg-purple-500/10 border border-purple-500/20">
                {topK} chunks
              </span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              step={1}
              value={topK}
              onChange={(e) => setTopK(Number(e.target.value))}
              className="w-full accent-purple-500 cursor-pointer"
            />
            <p className="text-[10px] text-slate-500">
              Controls how many candidate document chunks are retrieved from the vector index per turn.
            </p>
          </div>

          {/* Min Score Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Min Similarity Threshold</span>
              <span className="font-mono text-emerald-400 font-bold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                {(minScore * 100).toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min={0.0}
              max={0.9}
              step={0.05}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
            />
            <p className="text-[10px] text-slate-500">
              Chunks below this cosine similarity threshold will be filtered out to eliminate noise.
            </p>
          </div>

          {/* Temperature Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-200">Model Temperature</span>
              <span className="font-mono text-amber-400 font-bold px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                {temperature.toFixed(2)}
              </span>
            </div>
            <input
              type="range"
              min={0.0}
              max={1.0}
              step={0.05}
              value={temperature}
              onChange={(e) => setTemperature(Number(e.target.value))}
              className="w-full accent-amber-500 cursor-pointer"
            />
            <p className="text-[10px] text-slate-500">
              0.0 = Precise & factual, 1.0 = Creative and exploratory.
            </p>
          </div>

          {/* Web Search Toggle */}
          <div className="p-3 bg-[#18181b] border border-[#27272a] rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Globe className="w-4 h-4 text-purple-400" />
              <div>
                <span className="text-xs font-semibold text-slate-200 block">Exa Web Search Fallback</span>
                <span className="text-[10px] text-slate-500">Allows agent to search real-time web sources</span>
              </div>
            </div>
            <input
              type="checkbox"
              checked={webSearchEnabled}
              onChange={(e) => setWebSearchEnabled(e.target.checked)}
              className="w-4 h-4 accent-purple-600 rounded cursor-pointer"
            />
          </div>

          {/* Custom BYOK API Key */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
              <Key className="w-3.5 h-3.5 text-slate-400" />
              <span>Custom NVIDIA NIM API Key (BYOK)</span>
            </div>
            <input
              type="password"
              placeholder="nvapi-... (leave empty for default)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full bg-[#18181b] border border-[#27272a] rounded-xl px-3 py-2 text-xs text-slate-200 font-mono focus:outline-none focus:border-purple-500/50"
            />
            <p className="text-[10px] text-slate-500">
              Your key stays strictly within your active session and is never stored permanently.
            </p>
          </div>

          {/* Actions */}
          <div className="pt-3 border-t border-[#27272a] flex items-center justify-between">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Defaults</span>
            </button>

            <button
              type="submit"
              className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-purple-600/20 transition-all flex items-center gap-1.5"
            >
              {isSaved ? <Check className="w-4 h-4" /> : null}
              <span>{isSaved ? 'Saved!' : 'Apply Settings'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
