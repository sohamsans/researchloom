import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Filter,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Download,
  FileText,
  Clock,
  Layers,
  Sparkles,
  ChevronRight,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { RawPaperMetadata, ReviewPaper, PRISMAStatsResponse, ScreeningAuditItem } from '../../types';
import { logScreeningDecision, fetchPRISMAFlowStats } from '../../services/api';

interface PRISMAFlowDiagramProps {
  papers: RawPaperMetadata[];
  onOpenPdf?: (paperId: string, title: string) => void;
}

export const PRISMAFlowDiagram: React.FC<PRISMAFlowDiagramProps> = ({
  papers = [],
  onOpenPdf
}) => {
  const [stats, setStats] = useState<PRISMAStatsResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isExclusionModalOpen, setIsExclusionModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>('Wrong Population');
  const [activeTab, setActiveTab] = useState<'screening' | 'flowchart' | 'audit'>('screening');

  const EXCLUSION_REASONS = [
    'Wrong Population',
    'Non-English',
    'No Empirical Data',
    'Preprint Only',
    'Methodology Flaw',
    'Duplicate'
  ];

  const loadStats = useCallback(async () => {
    try {
      const data = await fetchPRISMAFlowStats('default_workspace');
      setStats(data);
    } catch (e) {
      console.warn('Failed to load PRISMA stats:', e);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const currentPaper = papers[currentIndex] || null;

  // Handle Keystrokes J (Include), K (Exclude), L (Maybe)
  const handleDecision = async (action: 'included' | 'excluded' | 'maybe', reason?: string) => {
    if (!currentPaper) return;

    try {
      await logScreeningDecision({
        paper_id: currentPaper.id,
        paper_title: currentPaper.title,
        paper_doi: currentPaper.doi,
        action,
        exclusion_reason: action === 'excluded' ? (reason || selectedReason) : undefined,
        stage: 'screening',
        reviewer_id: 'primary_researcher'
      });

      // Move to next paper
      if (currentIndex < papers.length - 1) {
        setCurrentIndex((i) => i + 1);
      }
      setIsExclusionModalOpen(false);
      loadStats();
    } catch (err: any) {
      alert(`Screening decision failed: ${err.message}`);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isExclusionModalOpen) return;
      // Hotkeys J/K/L
      if (e.key === 'j' || e.key === 'J') {
        handleDecision('included');
      } else if (e.key === 'k' || e.key === 'K') {
        setIsExclusionModalOpen(true);
      } else if (e.key === 'l' || e.key === 'L') {
        handleDecision('maybe');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPaper, currentIndex, isExclusionModalOpen]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#07080a] text-zinc-200 overflow-hidden">
      {/* Top Header & Tab Controls */}
      <div className="px-6 py-3.5 bg-zinc-950/80 border-b border-zinc-800/80 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700/80 flex items-center justify-center text-zinc-100">
            <Filter className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
              <span>PRISMA 2020 Systematic Review Workflow</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
                Paper {papers.length > 0 ? currentIndex + 1 : 0} of {papers.length}
              </span>
            </h1>
            <p className="text-[11px] text-zinc-400">
              Keyboard hotkey screening (J = Include, K = Exclude, L = Maybe) with dynamic flowchart generation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex bg-zinc-900 p-1 rounded-lg border border-zinc-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('screening')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                activeTab === 'screening' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Rapid Triage (J/K/L)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('flowchart')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                activeTab === 'flowchart' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              PRISMA 2020 Flowchart
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1 rounded-md font-medium transition ${
                activeTab === 'audit' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Audit Provenance
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'screening' && (
          <div className="max-w-4xl mx-auto space-y-6">
            {currentPaper ? (
              <div className="bg-zinc-950/80 border border-zinc-800 rounded-xl p-6 shadow-2xl space-y-6">
                {/* Paper Title & Authors */}
                <div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono mb-1.5">
                    <span>Year: {currentPaper.year || 'N/A'}</span>
                    {currentPaper.venue && <span>• {currentPaper.venue}</span>}
                    {currentPaper.doi && <span>• DOI: {currentPaper.doi}</span>}
                  </div>
                  <h2 className="text-lg font-semibold text-zinc-100 leading-snug">
                    {currentPaper.title}
                  </h2>
                  <p className="text-xs text-zinc-400 mt-1">
                    {currentPaper.authors?.join(', ') || 'Authors not specified'}
                  </p>
                </div>

                {/* Abstract Text */}
                <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-lg p-4">
                  <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
                    Abstract Context
                  </h3>
                  <p className="text-xs text-zinc-300 leading-relaxed max-h-72 overflow-y-auto select-text font-sans">
                    {currentPaper.abstract || 'No abstract text available for this paper.'}
                  </p>
                </div>

                {/* Hotkey Decision Bar */}
                <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                  <span className="text-xs text-zinc-500 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Press keyboard shortcut or click button below</span>
                  </span>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleDecision('maybe')}
                      className="px-4 py-2 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-amber-300 flex items-center gap-2 transition"
                    >
                      <HelpCircle className="w-4 h-4 text-amber-400" />
                      <span>[L] Maybe</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsExclusionModalOpen(true)}
                      className="px-4 py-2 rounded-lg bg-red-950/30 hover:bg-red-950/60 border border-red-500/30 text-xs font-medium text-red-300 flex items-center gap-2 transition"
                    >
                      <XCircle className="w-4 h-4 text-red-400" />
                      <span>[K] Exclude</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDecision('included')}
                      className="px-5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white shadow-xs flex items-center gap-2 transition"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>[J] Include</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-64 border border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center text-center p-6 bg-zinc-950/40">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2" />
                <h3 className="text-sm font-semibold text-zinc-200">Screening Queue Complete</h3>
                <p className="text-xs text-zinc-500 max-w-sm mt-1">
                  All discovered candidate papers in the active pool have been evaluated. Check the PRISMA 2020 Flowchart tab to review diagram metrics.
                </p>
              </div>
            )}
          </div>
        )}

        {/* PRISMA 2020 Flowchart Tab */}
        {activeTab === 'flowchart' && stats && (
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="bg-zinc-950/90 border border-zinc-800 rounded-xl p-8 shadow-2xl space-y-8">
              <div className="text-center pb-4 border-b border-zinc-800">
                <h2 className="text-base font-bold text-zinc-100 tracking-tight">
                  PRISMA 2020 Flow Diagram
                </h2>
                <p className="text-xs text-zinc-400 mt-1">
                  Standardized systematic literature review provenance for publication
                </p>
              </div>

              {/* 4 Stages: Identification -> Screening -> Eligibility -> Included */}
              <div className="space-y-6 max-w-2xl mx-auto text-xs">
                {/* Stage 1: Identification */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-700/80 shadow-md">
                  <div className="font-bold text-zinc-200 uppercase tracking-wider text-[11px] mb-1">
                    1. Identification
                  </div>
                  <div className="text-zinc-300">
                    Records identified from OpenAlex, arXiv, Crossref: <strong>{stats.total_identified || papers.length}</strong>
                  </div>
                  <div className="text-zinc-500 text-[11px] mt-0.5">
                    Duplicate records removed: {stats.duplicates_removed}
                  </div>
                </div>

                <div className="flex justify-center text-zinc-600">↓</div>

                {/* Stage 2: Screening */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-700/80 shadow-md flex justify-between gap-4">
                  <div>
                    <div className="font-bold text-zinc-200 uppercase tracking-wider text-[11px] mb-1">
                      2. Screening
                    </div>
                    <div className="text-zinc-300">
                      Records screened (Title &amp; Abstract): <strong>{stats.total_screened}</strong>
                    </div>
                  </div>
                  <div className="text-right text-red-400">
                    <div>Records excluded: <strong>{stats.screen_excluded}</strong></div>
                    <div className="text-[10px] text-zinc-500 mt-1 space-y-0.5">
                      {Object.entries(stats.screen_excluded_by_reason).map(([r, cnt]) => (
                        <div key={r}>{r}: {cnt}</div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex justify-center text-zinc-600">↓</div>

                {/* Stage 3: Eligibility */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-700/80 shadow-md flex justify-between gap-4">
                  <div>
                    <div className="font-bold text-zinc-200 uppercase tracking-wider text-[11px] mb-1">
                      3. Eligibility
                    </div>
                    <div className="text-zinc-300">
                      Full-text reports assessed for eligibility: <strong>{stats.eligibility_assessed}</strong>
                    </div>
                  </div>
                  <div className="text-right text-red-400">
                    <div>Reports excluded: <strong>{stats.eligibility_excluded}</strong></div>
                  </div>
                </div>

                <div className="flex justify-center text-zinc-600">↓</div>

                {/* Stage 4: Included */}
                <div className="p-5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 text-emerald-300 shadow-lg text-center">
                  <div className="font-bold uppercase tracking-wider text-[11px] mb-1">
                    4. Included
                  </div>
                  <div className="text-sm font-semibold">
                    Final Studies Included in Review Synthesis: <strong>{stats.total_included}</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Audit Provenance Tab */}
        {activeTab === 'audit' && stats && (
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950 shadow-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-900 text-zinc-400 uppercase text-[10px] font-semibold border-b border-zinc-800">
                    <th className="py-2.5 px-4">Timestamp</th>
                    <th className="py-2.5 px-4">Paper Title</th>
                    <th className="py-2.5 px-4">Decision</th>
                    <th className="py-2.5 px-4">Reason / Notes</th>
                    <th className="py-2.5 px-4">Reviewer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-sans">
                  {stats.recent_audit_log.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-900/40 transition">
                      <td className="py-2.5 px-4 text-zinc-500 font-mono text-[11px]">
                        {item.created_at.slice(0, 19).replace('T', ' ')}
                      </td>
                      <td className="py-2.5 px-4 text-zinc-200 font-medium max-w-xs truncate" title={item.paper_title}>
                        {item.paper_title}
                      </td>
                      <td className="py-2.5 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase ${
                            item.action === 'included'
                              ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20'
                              : item.action === 'excluded'
                              ? 'bg-red-950/40 text-red-400 border border-red-500/20'
                              : 'bg-amber-950/40 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {item.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-zinc-400">
                        {item.exclusion_reason || '-'}
                      </td>
                      <td className="py-2.5 px-4 text-zinc-500 font-mono text-[11px]">
                        {item.reviewer_id}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Exclusion Reason Modal */}
      {isExclusionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <XCircle className="w-4 h-4 text-red-400" />
              <span>Select Exclusion Reason</span>
            </h3>
            <p className="text-xs text-zinc-400">
              PRISMA 2020 protocol mandates documenting formal justification for excluded literature.
            </p>

            <div className="space-y-1.5">
              {EXCLUSION_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setSelectedReason(reason)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium border transition ${
                    selectedReason === reason
                      ? 'bg-red-950/30 border-red-500/40 text-red-200'
                      : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsExclusionModalOpen(false)}
                className="px-3 py-1.5 rounded-lg border border-zinc-800 text-xs text-zinc-400 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDecision('excluded', selectedReason)}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-xs font-semibold text-white shadow-xs"
              >
                Confirm Exclusion
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
