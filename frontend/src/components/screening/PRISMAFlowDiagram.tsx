import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
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
import { useNativeDialog } from '../../context/NativeDialogContext';

interface PRISMAFlowDiagramProps {
  papers: RawPaperMetadata[];
  onOpenPdf?: (paperId: string, title: string) => void;
}

export function advanceScreeningIndex(currentIndex: number, totalPapers: number): number {
  if (currentIndex < totalPapers - 1) {
    return currentIndex + 1;
  }
  return totalPapers;
}

export const PRISMAFlowDiagram: React.FC<PRISMAFlowDiagramProps> = ({
  papers = [],
  onOpenPdf
}) => {
  const { showAlert, showToast } = useNativeDialog();
  const [stats, setStats] = useState<PRISMAStatsResponse | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [isExclusionModalOpen, setIsExclusionModalOpen] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string>('Wrong Population');
  const [activeTab, setActiveTab] = useState<'screening' | 'flowchart' | 'audit'>('screening');
  const svgRef = useRef<SVGSVGElement | null>(null);

  const EXCLUSION_REASONS = [
    'Wrong Population',
    'Non-English',
    'No Empirical Data',
    'Preprint Only',
    'Methodology Flaw',
    'Duplicate'
  ];

  const handleExportSVG = () => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const source = serializer.serializeToString(svgRef.current);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'prisma_2020_flow_diagram.svg';
    link.click();
    URL.revokeObjectURL(url);
    showToast('Exported PRISMA 2020 Vector SVG!', 'success');
  };

  const handleExportPDF = () => {
    if (!svgRef.current) return;
    const serializer = new XMLSerializer();
    const svgStr = serializer.serializeToString(svgRef.current);
    const img = new Image();
    const svgBlob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const scale = 3;
      const canvas = document.createElement('canvas');
      canvas.width = (svgRef.current?.clientWidth || 780) * scale;
      canvas.height = (svgRef.current?.clientHeight || 620) * scale;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#090a0f';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/png');
        a.download = 'prisma_2020_flow_diagram_300dpi.png';
        a.click();
        showToast('Exported PRISMA 2020 300 DPI High-Res Image!', 'success');
      }
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const handleCopyTikZ = () => {
    if (!stats) return;
    const identified = stats.total_identified || papers.length;
    const duplicates = stats.duplicates_removed || 0;
    const screened = stats.total_screened || 0;
    const screen_ex = stats.screen_excluded || 0;
    const eligibility = stats.eligibility_assessed || 0;
    const elig_ex = stats.eligibility_excluded || 0;
    const included = stats.total_included || 0;

    const reasons = Object.entries(stats.screen_excluded_by_reason || {})
      .map(([r, c]) => `${r.replace(/[%$&#_]/g, '\\$&')}: $n = ${c}$`)
      .join('\\\\ ');

    const tikzCode = `\\documentclass{article}
\\usepackage{tikz}
\\usetikzlibrary{shapes.geometric, arrows.meta, positioning, calc}

\\begin{document}
\\begin{figure*}[!t]
\\centering
\\begin{tikzpicture}[
    node distance=1.2cm and 1.8cm,
    every node/.style={font=\\sffamily\\small},
    box/.style={rectangle, draw=black, thick, fill=white, text width=6.2cm, minimum height=1.6cm, align=left, inner sep=6pt},
    sidebox/.style={rectangle, draw=black, thick, fill=gray!10, text width=5.6cm, minimum height=1.6cm, align=left, inner sep=6pt},
    arrow/.style={-{Stealth[scale=1.2]}, thick}
]

% Nodes
\\node (ident) [box] {\\textbf{Identification}\\\\[3pt]Records identified from OpenAlex, arXiv, Crossref ($n = ${identified}$)\\\\[2pt]Duplicate records removed ($n = ${duplicates}$)};

\\node (screen) [box, below=of ident] {\\textbf{Screening}\\\\[3pt]Records screened ($n = ${screened}$)};
\\node (screen_ex) [sidebox, right=of screen] {\\textbf{Records excluded} ($n = ${screen_ex}$)\\\\[2pt]${reasons || 'Preprints/Irrelevant'}};

\\node (elig) [box, below=of screen] {\\textbf{Eligibility}\\\\[3pt]Reports sought for retrieval ($n = ${eligibility}$)};
\\node (elig_ex) [sidebox, right=of elig] {\\textbf{Reports excluded} ($n = ${elig_ex}$)};

\\node (incl) [box, below=of elig, xshift=3.7cm, text width=13.6cm, fill=teal!10, draw=teal!60!black] {\\textbf{Included}\\\\[3pt]Final studies included in review synthesis ($n = ${included}$)};

% Arrows
\\draw [arrow] (ident) -- (screen);
\\draw [arrow] (screen) -- (screen_ex);
\\draw [arrow] (screen) -- (elig);
\\draw [arrow] (elig) -- (elig_ex);
\\draw [arrow] (elig) |- (incl);

\\end{tikzpicture}
\\caption{PRISMA 2020 flow diagram depicting the study identification, screening, eligibility, and inclusion process.}
\\label{fig:prisma2020}
\\end{figure*}
\\end{document}`;

    navigator.clipboard.writeText(tikzCode);
    showToast('LaTeX TikZ source copied to clipboard!', 'success');
  };

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
    if (isCompleted || !currentPaper) return;

    try {
      await logScreeningDecision({
        paper_id: String(currentPaper.id || `paper_${currentIndex}_${Date.now()}`),
        paper_title: String(currentPaper.title || 'Untitled Candidate Paper'),
        paper_doi: currentPaper.doi || undefined,
        action,
        exclusion_reason: action === 'excluded' ? (reason || selectedReason) : undefined,
        stage: 'screening',
        reviewer_id: 'primary_researcher'
      });

      // Move to next paper or terminate screening loop
      if (currentIndex < papers.length - 1) {
        setCurrentIndex((i) => i + 1);
      } else {
        setIsCompleted(true);
        showToast('Screening completed for all candidate papers!', 'success');
      }
      setIsExclusionModalOpen(false);
      loadStats();
      showToast(`Decision recorded: ${action.toUpperCase()}`, action === 'included' ? 'success' : action === 'excluded' ? 'warning' : 'info');
    } catch (err: any) {
      showAlert(`Screening decision could not be recorded: ${err.message}`, 'Screening Error', 'error');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isCompleted || isExclusionModalOpen) return;
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

          {activeTab === 'flowchart' && (
            <div className="flex items-center gap-1.5 ml-2 border-l border-zinc-800 pl-2">
              <button
                type="button"
                onClick={handleExportSVG}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200 flex items-center gap-1.5 transition cursor-pointer"
                title="Download Vector SVG"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                <span>SVG</span>
              </button>
              <button
                type="button"
                onClick={handleExportPDF}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200 flex items-center gap-1.5 transition cursor-pointer"
                title="Download 300 DPI High-Res Image"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                <span>300 DPI</span>
              </button>
              <button
                type="button"
                onClick={handleCopyTikZ}
                className="px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200 flex items-center gap-1.5 transition cursor-pointer"
                title="Copy Overleaf TikZ Code"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                <span>LaTeX TikZ</span>
              </button>
            </div>
          )}
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

              {/* Publication Vector SVG Diagram */}
              <div className="pt-6 border-t border-zinc-800 flex flex-col items-center">
                <div className="flex items-center justify-between w-full mb-3">
                  <span className="text-xs font-semibold text-zinc-300">Vector SVG Diagram View</span>
                  <span className="text-[10px] text-zinc-500 font-mono">Publication-ready vector graphic &amp; TikZ generator</span>
                </div>
                <div className="w-full overflow-x-auto p-4 rounded-xl bg-zinc-950 border border-zinc-800/80 flex justify-center">
                  <svg
                    ref={svgRef}
                    viewBox="0 0 780 500"
                    width="780"
                    height="500"
                    className="max-w-full h-auto"
                    style={{ background: '#090a0f', fontFamily: 'sans-serif' }}
                  >
                    <defs>
                      <marker id="prisma-arrow" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                        <polygon points="0 0, 8 3, 0 6" fill="#a1a1aa" />
                      </marker>
                    </defs>

                    {/* Stage 1: Identification */}
                    <rect x="40" y="20" width="320" height="75" rx="8" fill="#18181b" stroke="#3f3f46" strokeWidth="1.5" />
                    <text x="55" y="44" fill="#f4f4f5" fontSize="12" fontWeight="bold">1. IDENTIFICATION</text>
                    <text x="55" y="64" fill="#a1a1aa" fontSize="11">Records identified (n = {stats.total_identified || papers.length})</text>
                    <text x="55" y="80" fill="#71717a" fontSize="10">Duplicates removed (n = {stats.duplicates_removed})</text>

                    {/* Arrow Ident -> Screen */}
                    <line x1="200" y1="95" x2="200" y2="135" stroke="#a1a1aa" strokeWidth="1.5" markerEnd="url(#prisma-arrow)" />

                    {/* Stage 2: Screening */}
                    <rect x="40" y="135" width="320" height="75" rx="8" fill="#18181b" stroke="#3f3f46" strokeWidth="1.5" />
                    <text x="55" y="159" fill="#f4f4f5" fontSize="12" fontWeight="bold">2. SCREENING</text>
                    <text x="55" y="179" fill="#a1a1aa" fontSize="11">Records screened (n = {stats.total_screened})</text>
                    <text x="55" y="195" fill="#71717a" fontSize="10">Title &amp; abstract rapid triage</text>

                    {/* Arrow Screen -> Excluded */}
                    <line x1="360" y1="172" x2="425" y2="172" stroke="#a1a1aa" strokeWidth="1.5" markerEnd="url(#prisma-arrow)" />

                    {/* Screen Excluded Box */}
                    <rect x="425" y="135" width="315" height="75" rx="8" fill="#18181b" stroke="#7f1d1d" strokeWidth="1.5" />
                    <text x="440" y="159" fill="#f87171" fontSize="12" fontWeight="bold">Records excluded (n = {stats.screen_excluded})</text>
                    <text x="440" y="179" fill="#a1a1aa" fontSize="10">Primary reasons: {Object.keys(stats.screen_excluded_by_reason).slice(0, 2).join(', ') || 'Irrelevant'}</text>

                    {/* Arrow Screen -> Eligibility */}
                    <line x1="200" y1="210" x2="200" y2="250" stroke="#a1a1aa" strokeWidth="1.5" markerEnd="url(#prisma-arrow)" />

                    {/* Stage 3: Eligibility */}
                    <rect x="40" y="250" width="320" height="75" rx="8" fill="#18181b" stroke="#3f3f46" strokeWidth="1.5" />
                    <text x="55" y="274" fill="#f4f4f5" fontSize="12" fontWeight="bold">3. ELIGIBILITY</text>
                    <text x="55" y="294" fill="#a1a1aa" fontSize="11">Full-text reports assessed (n = {stats.eligibility_assessed})</text>
                    <text x="55" y="310" fill="#71717a" fontSize="10">Full criteria evaluation</text>

                    {/* Arrow Eligibility -> Excluded */}
                    <line x1="360" y1="287" x2="425" y2="287" stroke="#a1a1aa" strokeWidth="1.5" markerEnd="url(#prisma-arrow)" />

                    {/* Eligibility Excluded Box */}
                    <rect x="425" y="250" width="315" height="75" rx="8" fill="#18181b" stroke="#7f1d1d" strokeWidth="1.5" />
                    <text x="440" y="274" fill="#f87171" fontSize="12" fontWeight="bold">Reports excluded (n = {stats.eligibility_excluded})</text>
                    <text x="440" y="294" fill="#a1a1aa" fontSize="10">Full-text review exclusions</text>

                    {/* Arrow Eligibility -> Included */}
                    <line x1="200" y1="325" x2="200" y2="385" stroke="#a1a1aa" strokeWidth="1.5" markerEnd="url(#prisma-arrow)" />

                    {/* Stage 4: Included (Full Centered Box) */}
                    <rect x="40" y="385" width="700" height="85" rx="10" fill="#064e3b" stroke="#10b981" strokeWidth="2" />
                    <text x="390" y="420" fill="#a7f3d0" fontSize="13" fontWeight="bold" textAnchor="middle">4. INCLUDED STUDIES</text>
                    <text x="390" y="445" fill="#ecfdf5" fontSize="15" fontWeight="bold" textAnchor="middle">Final Studies Included in Systematic Review Synthesis (n = {stats.total_included})</text>
                  </svg>
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
