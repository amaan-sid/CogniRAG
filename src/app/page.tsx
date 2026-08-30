'use client';
import React from 'react';
import AuthModal from '@/components/AuthModal';
import ChatInterface from '@/components/ChatInterface';
import { useAuth } from '@/components/AuthProvider';

export default function Home() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0b0f19] text-slate-100 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
        <p className="text-xs text-slate-400 font-mono animate-pulse">Connecting to CogniRAG Authentication Gateway...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <AuthModal />;
  }

  return (
    <main className="h-screen w-screen bg-[#0b0f19] text-slate-100 overflow-hidden flex flex-col">
      <ChatInterface />
    </main>
  );
}
