import React, { useState, useRef, useEffect } from 'react';
import {
  Search,
  Sparkles,
  Layers,
  Calendar,
  Filter,
  ArrowRight,
  Bot,
  Zap,
  Globe,
  Brain,
  Sliders,
  Check
} from 'lucide-react';
import { ModelProvider } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme, THEME_CONFIGS } from '../context/ThemeContext';

interface UnifiedSearchBarProps {
  onSearch: (params: {
    topic: string;
    maxResults: number;
    yearMin?: number;
    yearMax?: number;
    noYearConstraint: boolean;
    relevanceThreshold: number;
    mode: 'discover' | 'autonomous';
  }) => void;
  isLoading: boolean;
  onOpenAssistant: () => void;
  initialTopic?: string;
}

export const UnifiedSearchBar: React.FC<UnifiedSearchBarProps> = ({
  onSearch,
  isLoading,
  onOpenAssistant,
  initialTopic = ''
}) => {
  const [topic, setTopic] = useState(initialTopic);
  const [mode, setMode] = useState<'discover' | 'autonomous'>('discover');
  const [maxResults, setMaxResults] = useState<number>(50);
  const [yearMin, setYearMin] = useState<number>(2020);
  const [yearMax, setYearMax] = useState<number>(new Date().getFullYear());
  const [noYearConstraint, setNoYearConstraint] = useState<boolean>(false);
  const [relevanceThreshold, setRelevanceThreshold] = useState<number>(4);

  // Popover toggle states
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [showPoolMenu, setShowPoolMenu] = useState(false);
  const [showYearMenu, setShowYearMenu] = useState(false);
  const [showThresholdMenu, setShowThresholdMenu] = useState(false);

  const { activeProvider, setActiveProvider, activeModel, setActiveModel, openKeyModal, user } = useAuth();
  const { accent } = useTheme();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (initialTopic) {
      setTopic(initialTopic);
    }
  }, [initialTopic]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
    }
  }, [topic]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || isLoading) return;

    onSearch({
      topic: topic.trim(),
      maxResults,
      yearMin: noYearConstraint ? undefined : yearMin,
      yearMax: noYearConstraint ? undefined : yearMax,
      noYearConstraint,
      relevanceThreshold,
      mode
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const getProviderBadge = (provider: ModelProvider) => {
    switch (provider) {
      case 'groq':
        return { label: 'Groq Cloud', icon: Zap, tier: 'Free (14.4k/d)' };
      case 'gemini':
        return { label: 'Gemini Flash', icon: Sparkles, tier: 'Free (1.5k/d)' };
      case 'openrouter':
        return { label: 'OpenRouter', icon: Globe, tier: 'Free / Universal' };
      case 'deepseek':
        return { label: 'DeepSeek', icon: Brain, tier: 'Ultra-Low Cost' };
      case 'nvidia':
        return { label: 'NVIDIA NIM', icon: Sliders, tier: 'Free Credits' };
      case 'claude':
        return { label: 'Claude', icon: Brain, tier: 'Anthropic BYOK' };
      case 'openai':
        return { label: 'OpenAI', icon: Sparkles, tier: 'GPT-4o BYOK' };
      case 'custom':
        return { label: 'Custom API', icon: Sliders, tier: 'Custom Proxy' };
      default:
        return { label: 'AI Engine', icon: Sparkles, tier: 'Cloud' };
    }
  };

  const currentBadge = getProviderBadge(activeProvider);
  const CurrentIcon = currentBadge.icon;

  return (
    <div className="w-full max-w-4xl mx-auto relative z-20">
      <form
        onSubmit={handleSubmit}
        className="glass-panel dark:bg-[#0c121e]/90 bg-white/95 rounded-2xl p-4 transition-all duration-300 shadow-2xl relative border dark:border-white/10 border-slate-200/80 focus-within:ring-2 focus-within:ring-emerald-500/30"
      >
        {/* Main Textarea Input */}
        <div className="flex items-start gap-3">
          <div className="pt-2 text-slate-400">
            <Search className="w-5 h-5 text-slate-400 dark:text-slate-500" />
          </div>
          <textarea
            ref={textareaRef}
            rows={2}
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Explore literature, e.g.: 'Zero-shot reasoning benchmarks in medical visual question answering' or 'Transformer KV cache optimization'..."
            className="w-full bg-transparent border-none outline-none resize-none text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-base leading-relaxed"
            disabled={isLoading}
          />
        </div>

        {/* Bottom Micro-Pills Dock (Gemini Style) */}
        <div className="mt-3 pt-3 border-t dark:border-white/10 border-slate-100 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* 1. Model / Provider Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowModelMenu(!showModelMenu);
                  setShowPoolMenu(false);
                  setShowYearMenu(false);
                  setShowThresholdMenu(false);
                }}
                className="glass-pill px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-medium hover:text-slate-900 dark:hover:text-white"
              >
                <CurrentIcon className="w-3.5 h-3.5 text-emerald-400" />
                <span>{currentBadge.label}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-slate-400">
                  {currentBadge.tier}
                </span>
              </button>

              {showModelMenu && (
                <div className="absolute left-0 bottom-full mb-2 w-64 glass-panel dark:bg-[#111827] bg-white rounded-xl shadow-xl p-2 z-50 border dark:border-white/10 border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">
                    Select AI Engine
                  </div>
                  <div className="space-y-1 mt-1">
                    {[
                      { id: 'groq' as ModelProvider, label: 'Groq Cloud (Fastest)', tier: '100% Free' },
                      { id: 'gemini' as ModelProvider, label: 'Google Gemini Flash', tier: '100% Free' },
                      { id: 'openrouter' as ModelProvider, label: 'OpenRouter (:free models)', tier: 'Free / Paid' },
                      { id: 'deepseek' as ModelProvider, label: 'DeepSeek V3 / R1', tier: '$0.14/1M' },
                      { id: 'nvidia' as ModelProvider, label: 'NVIDIA NIM (Llama 3.1)', tier: '1,000 Credits' },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setActiveProvider(p.id);
                          setShowModelMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                          activeProvider === p.id
                            ? 'bg-emerald-500/10 text-emerald-400 font-semibold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <span>{p.label}</span>
                        <span className="text-[10px] text-slate-400">{p.tier}</span>
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 pt-2 border-t dark:border-white/10 border-slate-200 flex justify-between items-center px-1">
                    <button
                      type="button"
                      onClick={() => {
                        setShowModelMenu(false);
                        openKeyModal();
                      }}
                      className="text-xs text-emerald-400 hover:underline flex items-center gap-1"
                    >
                      <Sliders className="w-3 h-3" />
                      Configure API Keys
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Candidate Pool Size Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowPoolMenu(!showPoolMenu);
                  setShowModelMenu(false);
                  setShowYearMenu(false);
                  setShowThresholdMenu(false);
                }}
                className="glass-pill px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                <Layers className="w-3.5 h-3.5 text-sky-400" />
                <span>{maxResults} Papers Pool</span>
              </button>

              {showPoolMenu && (
                <div className="absolute left-0 bottom-full mb-2 w-44 glass-panel dark:bg-[#111827] bg-white rounded-xl shadow-xl p-2 z-50 border dark:border-white/10 border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">
                    Candidate Pool
                  </div>
                  <div className="space-y-1 mt-1">
                    {[20, 50, 100, 200].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => {
                          setMaxResults(num);
                          setShowPoolMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left ${
                          maxResults === num
                            ? 'bg-sky-500/10 text-sky-400 font-semibold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <span>{num} Candidates</span>
                        {num >= 100 && <span className="text-[10px] text-amber-400">Deep</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 3. Year Window Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowYearMenu(!showYearMenu);
                  setShowModelMenu(false);
                  setShowPoolMenu(false);
                  setShowThresholdMenu(false);
                }}
                className="glass-pill px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                <Calendar className="w-3.5 h-3.5 text-violet-400" />
                <span>{noYearConstraint ? 'All Years' : `${yearMin} - ${yearMax}`}</span>
              </button>

              {showYearMenu && (
                <div className="absolute left-0 bottom-full mb-2 w-64 glass-panel dark:bg-[#111827] bg-white rounded-xl shadow-xl p-3 z-50 border dark:border-white/10 border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-400 mb-2 uppercase tracking-wider">
                    Publication Window
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer text-slate-300 text-xs">
                      <input
                        type="checkbox"
                        checked={noYearConstraint}
                        onChange={(e) => setNoYearConstraint(e.target.checked)}
                        className="rounded accent-emerald-500"
                      />
                      <span>No Year Constraints (All Time)</span>
                    </label>

                    {!noYearConstraint && (
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-1">From Year</span>
                          <input
                            type="number"
                            value={yearMin}
                            onChange={(e) => setYearMin(parseInt(e.target.value) || 2018)}
                            className="w-full px-2 py-1 rounded bg-black/20 border dark:border-white/10 text-center text-xs"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block mb-1">To Year</span>
                          <input
                            type="number"
                            value={yearMax}
                            onChange={(e) => setYearMax(parseInt(e.target.value) || 2026)}
                            className="w-full px-2 py-1 rounded bg-black/20 border dark:border-white/10 text-center text-xs"
                          />
                        </div>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowYearMenu(false)}
                      className="w-full mt-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-center text-xs font-medium hover:bg-emerald-500/30"
                    >
                      Done
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 4. Relevance Filter Pill */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowThresholdMenu(!showThresholdMenu);
                  setShowModelMenu(false);
                  setShowPoolMenu(false);
                  setShowYearMenu(false);
                }}
                className="glass-pill px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
              >
                <Filter className="w-3.5 h-3.5 text-amber-400" />
                <span>Score ≥ {relevanceThreshold} / 5</span>
              </button>

              {showThresholdMenu && (
                <div className="absolute left-0 bottom-full mb-2 w-48 glass-panel dark:bg-[#111827] bg-white rounded-xl shadow-xl p-2 z-50 border dark:border-white/10 border-slate-200">
                  <div className="text-[11px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">
                    Relevance Cutoff
                  </div>
                  <div className="space-y-1 mt-1">
                    {[
                      { score: 3, label: 'Score ≥ 3 (Broad)' },
                      { score: 4, label: 'Score ≥ 4 (Standard)' },
                      { score: 5, label: 'Score 5 Only (Strict)' }
                    ].map((item) => (
                      <button
                        key={item.score}
                        type="button"
                        onClick={() => {
                          setRelevanceThreshold(item.score);
                          setShowThresholdMenu(false);
                        }}
                        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left ${
                          relevanceThreshold === item.score
                            ? 'bg-amber-500/10 text-amber-400 font-semibold'
                            : 'text-slate-700 dark:text-slate-300 hover:bg-white/5'
                        }`}
                      >
                        <span>{item.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 5. Execution Mode Toggle Pill */}
            <div className="flex items-center rounded-lg bg-black/10 dark:bg-white/5 p-0.5 border dark:border-white/10">
              <button
                type="button"
                onClick={() => setMode('discover')}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                  mode === 'discover'
                    ? 'bg-emerald-500 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Preview candidate list before running deep extraction"
              >
                Preview First
              </button>
              <button
                type="button"
                onClick={() => setMode('autonomous')}
                className={`px-2 py-1 rounded text-[11px] font-medium transition-all ${
                  mode === 'autonomous'
                    ? 'bg-emerald-500 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Autonomous 2-stage review directly"
              >
                Auto-Review
              </button>
            </div>
          </div>

          {/* Right Action Controls: AI Copilot & Submit */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenAssistant}
              className="glass-pill px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-violet-300 hover:text-violet-100 hover:bg-violet-500/20"
              title="Open Layman Research Copilot"
            >
              <Bot className="w-3.5 h-3.5 text-violet-400" />
              <span className="hidden sm:inline">AI Copilot</span>
            </button>

            <button
              type="submit"
              disabled={isLoading || !topic.trim()}
              className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all active:scale-95"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>{mode === 'discover' ? 'Discover' : 'Synthesize'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
