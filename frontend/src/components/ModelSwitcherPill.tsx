import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Zap, Brain, Globe, ChevronDown, Check, Key } from 'lucide-react';
import { ModelProvider } from '../types';
import { useAuth } from '../context/AuthContext';

interface ModelOption {
  id: ModelProvider;
  name: string;
  model: string;
  tag: string;
  keyName: string;
}

const MODEL_OPTIONS: ModelOption[] = [
  { id: 'gemini', name: 'Google Gemini Flash', model: 'gemini-3.8-flash', tag: 'Fast & Free', keyName: 'gemini' },
  { id: 'groq', name: 'Groq Cloud Llama 3.3', model: 'llama-3.3-70b-versatile', tag: 'High Speed', keyName: 'groq' },
  { id: 'claude', name: 'Claude 3.7 Sonnet', model: 'claude-3-7-sonnet-20250219', tag: 'Hybrid Reasoning', keyName: 'claude' },
  { id: 'claude', name: 'Claude 3.5 Sonnet', model: 'claude-3-5-sonnet-20241022', tag: 'High Precision', keyName: 'claude' },
  { id: 'claude', name: 'Claude 3.5 Haiku', model: 'claude-3-5-haiku-20241022', tag: 'High Speed', keyName: 'claude' },
  { id: 'openai', name: 'OpenAI GPT-4o', model: 'gpt-4o', tag: 'Omni Flagship', keyName: 'openai' },
  { id: 'openai', name: 'OpenAI GPT-4o Mini', model: 'gpt-4o-mini', tag: 'Fast & Cheap', keyName: 'openai' },
  { id: 'openai', name: 'OpenAI o3-mini', model: 'o3-mini', tag: 'Deep Reasoning', keyName: 'openai' },
  { id: 'openrouter', name: 'OpenRouter Free', model: 'meta-llama/llama-3.3-70b-instruct:free', tag: ':free models', keyName: 'openrouter' },
  { id: 'deepseek', name: 'DeepSeek Chat', model: 'deepseek-chat', tag: 'V3 Deep', keyName: 'deepseek' },
  { id: 'nvidia', name: 'NVIDIA NIM', model: 'meta/llama-3.1-8b-instruct', tag: 'Cloud NIM', keyName: 'nvidia' },
];

export const ModelSwitcherPill: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { activeProvider, setActiveProvider, activeModel, setActiveModel, runtimeKeys, openKeyModal } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const getProviderIcon = (provider: ModelProvider) => {
    switch (provider) {
      case 'gemini':
        return <Sparkles className="w-3.5 h-3.5 text-sky-400" />;
      case 'groq':
        return <Zap className="w-3.5 h-3.5 text-amber-400" />;
      case 'claude':
        return <Brain className="w-3.5 h-3.5 text-orange-400" />;
      case 'openai':
        return <Sparkles className="w-3.5 h-3.5 text-emerald-400" />;
      case 'deepseek':
        return <Brain className="w-3.5 h-3.5 text-purple-400" />;
      default:
        return <Globe className="w-3.5 h-3.5 text-emerald-400" />;
    }
  };

  const getShortModelLabel = (model: string, provider: ModelProvider) => {
    if (!model || model === provider) {
      if (provider === 'gemini') return '3.8-flash';
      if (provider === 'groq') return 'llama-3.3';
      if (provider === 'claude') return 'claude-3.5';
      if (provider === 'openai') return 'gpt-4o';
      return provider;
    }
    if (model.includes('claude-3-7')) return 'claude-3.7';
    if (model.includes('claude-3-5-sonnet')) return 'sonnet-3.5';
    if (model.includes('claude-3-5-haiku')) return 'haiku-3.5';
    if (model === 'gpt-4o') return 'gpt-4o';
    if (model === 'gpt-4o-mini') return '4o-mini';
    if (model === 'o3-mini') return 'o3-mini';
    if (model.startsWith('gemini-')) return model.replace('gemini-', '');
    if (model.includes('llama-3.3')) return 'llama-3.3';
    if (model.includes('llama-3.1')) return 'llama-3.1';
    return model.split('/')[1] || model.split('-')[0] || model;
  };

  const currentOption = MODEL_OPTIONS.find((m) => m.id === activeProvider) || MODEL_OPTIONS[0];

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800/80 text-xs font-medium text-zinc-200 transition-all shadow-xs cursor-pointer"
        title="Switch active LLM model & provider"
      >
        {getProviderIcon(activeProvider)}
        <span className="capitalize">{activeProvider}</span>
        <span className="text-[10px] text-zinc-500 font-mono hidden md:inline">
          ({getShortModelLabel(activeModel, activeProvider)})
        </span>
        {/* Visual green indicator if current provider has a key configured */}
        <span
          className={`w-1.5 h-1.5 rounded-full ${
            runtimeKeys[activeProvider] ? 'bg-emerald-400 shadow-xs shadow-emerald-400/50' : 'bg-zinc-600'
          }`}
          title={runtimeKeys[activeProvider] ? 'API key active' : 'No custom key configured (using fallback)'}
        />
        <ChevronDown className="w-3 h-3 text-zinc-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 max-h-96 overflow-y-auto p-2 rounded-2xl bg-[#181a1f] shadow-2xl border border-zinc-800 z-50 animate-fadeIn text-xs scrollbar-thin">
          <div className="px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-zinc-500 border-b border-zinc-800/80 mb-1 flex items-center justify-between">
            <span>Active Model &amp; Provider</span>
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                openKeyModal();
              }}
              className="text-sky-400 hover:text-sky-300 inline-flex items-center gap-1 cursor-pointer"
              title="Add or update API keys"
            >
              <Key className="w-2.5 h-2.5" />
              <span>Keys</span>
            </button>
          </div>

          {MODEL_OPTIONS.map((item, idx) => {
            const isSelected = activeProvider === item.id && activeModel === item.model;
            const hasKey = !!runtimeKeys[item.keyName];

            return (
              <button
                key={`${item.id}-${item.model}-${idx}`}
                type="button"
                onClick={() => {
                  setActiveProvider(item.id);
                  setActiveModel(item.model);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-left transition-colors cursor-pointer mb-0.5 ${
                  isSelected
                    ? 'bg-sky-500/15 text-sky-300 font-semibold border border-sky-500/30'
                    : 'text-zinc-300 hover:bg-zinc-800/60'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {getProviderIcon(item.id)}
                  <div className="truncate">
                    <div className="truncate font-medium">{item.name}</div>
                    <div className="text-[10px] text-zinc-500 font-mono truncate">{item.model} • {item.tag}</div>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {hasKey ? (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-emerald-400"
                      title="Key configured"
                    />
                  ) : (
                    <span
                      className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-800 text-zinc-500"
                      title="No API key"
                    >
                      no key
                    </span>
                  )}
                  {isSelected && <Check className="w-3.5 h-3.5 text-sky-400 shrink-0 ml-1" />}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
