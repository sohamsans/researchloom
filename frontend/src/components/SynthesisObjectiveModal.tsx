import React, { useState, useMemo } from 'react';
import { Target, Sparkles, ArrowRight, X, ShieldAlert } from 'lucide-react';

interface SynthesisObjectiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: (researchGoal?: string) => void;
  pooledQueries: string[];
  candidateCount: number;
  currentTopic: string;
}

export const SynthesisObjectiveModal: React.FC<SynthesisObjectiveModalProps> = ({
  isOpen,
  onClose,
  onProceed,
  pooledQueries,
  candidateCount,
  currentTopic,
}) => {
  const [goal, setGoal] = useState('');

  // Generate 2-3 dynamic 1-click objective suggestions based on topic and pooled queries
  const suggestions = useMemo(() => {
    const list: string[] = [];
    const base = currentTopic.trim() || 'this research domain';

    if (pooledQueries.length > 1) {
      const q1 = pooledQueries[0];
      const q2 = pooledQueries[1];
      list.push(`Investigate the relationship and intersection between ${q1} and ${q2}.`);
    }

    list.push(`Synthesize state-of-the-art methodology, technical bottlenecks, and trade-offs in ${base}.`);
    list.push(`Identify unresolved limitations, empirical research gaps, and benchmark evaluations in ${base}.`);

    return list.slice(0, 3);
  }, [currentTopic, pooledQueries]);

  if (!isOpen) return null;

  const handleApplySuggestion = (s: string) => {
    setGoal(s);
  };

  const handleProceedWithGoal = () => {
    onProceed(goal.trim() ? goal.trim() : undefined);
  };

  const handleBypass = () => {
    onProceed(undefined);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-xl bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="objective-modal-title"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-950/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700/80 flex items-center justify-center text-zinc-100">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h2 id="objective-modal-title" className="text-sm font-semibold text-zinc-100 tracking-tight">
                Align Research Objective
              </h2>
              <p className="text-xs text-zinc-400">
                Filter and evaluate {candidateCount} candidate papers against your core goal
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-300 p-1 rounded-md transition cursor-pointer"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Pooled Search Context Tag Strip */}
          {pooledQueries.length > 0 && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Active Candidate Pool Sources ({pooledQueries.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {pooledQueries.map((q, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center px-2 py-0.5 rounded-md bg-zinc-950 border border-zinc-800 text-zinc-300 text-xs font-mono"
                  >
                    "{q}"
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Goal Input Area */}
          <div className="space-y-2">
            <label htmlFor="research-goal-input" className="block text-xs font-medium text-zinc-200">
              What specific question or objective should guide this synthesis?
            </label>
            <textarea
              id="research-goal-input"
              rows={3}
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. Focus specifically on water intake diffusion dynamics and combustion efficiency in water-reactive ramjet engines, penalizing generic rocket or marine hydrofoil papers."
              className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-zinc-600 focus:ring-1 focus:ring-zinc-600 transition resize-none leading-relaxed"
            />
            <p className="text-[11px] text-zinc-500 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
              <span>
                Papers that do not directly advance this objective will receive lower scores during triage.
              </span>
            </p>
          </div>

          {/* Quick Suggestions */}
          <div className="space-y-1.5 pt-1">
            <span className="text-[11px] font-medium text-zinc-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-zinc-400" />
              <span>Suggested Anchors (click to apply):</span>
            </span>
            <div className="space-y-1">
              {suggestions.map((s, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleApplySuggestion(s)}
                  className="w-full text-left px-2.5 py-1.5 rounded-md bg-zinc-950/60 hover:bg-zinc-800/80 border border-zinc-800/60 text-xs text-zinc-300 transition cursor-pointer leading-snug truncate"
                  title={s}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-zinc-800/80 bg-zinc-950/40 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleBypass}
            className="text-xs text-zinc-400 hover:text-zinc-200 transition font-medium cursor-pointer"
          >
            Standard Synthesis (No Objective)
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-xs font-medium text-zinc-300 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleProceedWithGoal}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <span>{goal.trim() ? 'Synthesize with Objective' : 'Proceed to Synthesis'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
