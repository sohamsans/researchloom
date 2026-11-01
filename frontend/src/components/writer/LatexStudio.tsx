import React, { useState, useRef, useMemo } from 'react';
import {
  Code,
  Eye,
  Columns,
  Download,
  Copy,
  Check,
  BookOpen,
  FileCode,
  Sigma,
  Plus,
  RotateCcw,
  Sparkles,
  HelpCircle,
  TrendingUp,
  AlertTriangle,
  ExternalLink,
  Wrench,
  X
} from 'lucide-react';
import katex from 'katex';
import { lintLatexSource, autoFixLatexSource, LatexDiagnosticError } from './latexLinter';
import { MathPlotterModal } from './MathPlotterModal';
import { useNativeDialog } from '../../context/NativeDialogContext';

interface LatexStudioProps {
  latexSource: string;
  onChange: (val: string) => void;
  title: string;
  onTitleChange: (val: string) => void;
  onOpenCitationPicker: () => void;
  onExportTex: () => void;
  isSaving?: boolean;
  lastSaved?: string;
}

// Built-in academic LaTeX templates
export const LATEX_TEMPLATES = {
  literature_review: `% =========================================================================
% LitBuddy Autonomous Literature Review Manuscript
% =========================================================================
\\documentclass[11pt,a4paper]{article}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{graphicx}
\\usepackage{booktabs}
\\usepackage{hyperref}

\\title{A Comprehensive Survey of SOTA Methodologies and Open Research Frontiers}
\\author{Research Team}
\\date{\\today}

\\begin{document}
\\maketitle

\\begin{abstract}
This survey investigates recent methodological advancements and empirical benchmarks in modern literature. We synthesize key problem formulations, taxonomy classifications, empirical metrics, and critical research gaps identified across peer-reviewed publications.
\\end{abstract}

\\section{Introduction}
The exponential expansion of contemporary academic literature necessitates rigorous, grounded synthesis of methodologies. In this review, we examine primary formulations, foundational hypotheses, and empirical evaluations.

\\section{Methodological Taxonomy}
To organize the current landscape, we categorize dominant paradigms based on objective functions and evaluation protocols. Consider the general optimization objective:

\\begin{equation}
\\min_{\\theta} \\mathcal{L}(\\theta) = \\frac{1}{N} \\sum_{i=1}^N \\ell(f(x_i; \\theta), y_i) + \\lambda \\mathcal{R}(\\theta)
\\end{equation}

where $\\mathcal{L}(\\theta)$ denotes the aggregate loss, $f(x; \\theta)$ represents the parameterized predictive model, and $\\mathcal{R}(\\theta)$ serves as the regularization prior.

\\section{Comparative Analysis & Benchmarks}
\\begin{table}[ht]
\\centering
\\caption{Comparative Performance Across Standard Benchmark Datasets}
\\begin{tabular}{l c c c}
\\toprule
\\textbf{Methodology} & \\textbf{Accuracy (\\%)} & \\textbf{F1 Score} & \\textbf{Latency (ms)} \\\\
\\midrule
Baseline Architecture & 88.4 & 0.862 & 34.2 \\\\
Proposed Paradigm     & 94.7 & 0.938 & 12.1 \\\\
\\bottomrule
\\end{tabular}
\\end{table}

\\section{Critical Limitations & Open Frontiers}
Key limitations persisting across investigated literature include data efficiency, out-of-distribution generalization, and high computational footprint. Future work should prioritize parameter-efficient mechanisms.

\\section{Conclusion}
We have presented an end-to-end survey of foundational mechanisms and empirical discoveries. Grounded literature tracking remains indispensable for accelerating verifiable scientific discovery.

\\begin{thebibliography}{99}
\\bibitem{vaswani2017} Vaswani, A., et al. (2017). Attention Is All You Need. \\textit{Advances in Neural Information Processing Systems}.
\\end{thebibliography}

\\end{document}
`,

  ieee_conference: `% =========================================================================
% IEEE Conference Paper Template
% =========================================================================
\\documentclass[conference]{IEEEtran}
\\usepackage{amsmath,amssymb}
\\usepackage{booktabs}

\\title{Scalable Neural Architectures for High-Throughput Literature Synthesis}
\\author{\\IEEEauthorblockN{Primary Author}
\\IEEEauthorblockA{Department of Computer Science\\\\University Research Lab\\\\Email: author@domain.edu}}

\\begin{document}
\\maketitle

\\begin{abstract}
We introduce a lightweight, low-latency framework for autonomous literature extraction and synthesis. Our formulation achieves significant latency reduction while preserving cross-document citation precision.
\\end{abstract}

\\section{Introduction}
Modern scientific inquiry requires accelerating synthesis without compromising factual attribution. We present a dual-stage pipeline optimizing triage latency.

\\section{System Formulation}
Given a query topic $q$ and document collection $\\mathcal{D} = \\{d_1, d_2, \\dots, d_K\\}$, we define the relevance score as:

\\begin{equation}
S(q, d_i) = \\sigma\\left(\\mathbf{w}^\\top [\\mathbf{e}_q \\odot \\mathbf{e}_{d_i}] + b\\right)
\\end{equation}

\\section{Experimental Results}
Extensive evaluation demonstrates robust convergence and high alignment with expert annotations.

\\section{Conclusion}
The proposed paradigm enables verifiable, hallucination-resistant academic workflows.

\\end{document}
`,

  research_proposal: `% =========================================================================
% Academic Research Proposal Template
% =========================================================================
\\documentclass[12pt]{article}
\\usepackage{amsmath,amsfonts}

\\title{Research Proposal: Autonomous Multi-Modal Evidence Synthesis}
\\author{Principal Investigator}
\\date{\\today}

\\begin{document}
\\maketitle

\\section{Project Summary}
This project aims to develop verifiable extraction pipelines for scientific literature, bridging structured knowledge graphs and multi-document reasoning.

\\section{Specific Aims}
\\textbf{Aim 1:} Formalize multi-document consistency checking.\\\\
\\textbf{Aim 2:} Construct latency-optimized extraction kernels.\\\\
\\textbf{Aim 3:} Validate empirical utility across biomedical and computational domains.

\\section{Preliminary Studies}
Preliminary evaluations indicate that selective slicing of intro and conclusion sections yields a 92\\% token conservation factor while maintaining analytical fidelity.

\\end{document}
`
};

export const LatexStudio: React.FC<LatexStudioProps> = ({
  latexSource,
  onChange,
  title,
  onTitleChange,
  onOpenCitationPicker,
  onExportTex,
  isSaving,
  lastSaved
}) => {
  const { showPrompt } = useNativeDialog();
  const [viewMode, setViewMode] = useState<'split' | 'code' | 'preview'>('split');
  const [copied, setCopied] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showPlotterModal, setShowPlotterModal] = useState(false);
  const [showDiagnosticModal, setShowDiagnosticModal] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Compute live LaTeX syntax diagnostic warnings
  const diagnosticErrors = useMemo(() => {
    return lintLatexSource(latexSource);
  }, [latexSource]);

  // One-click Open in Overleaf Cloud
  const handleOpenOverleafCloud = () => {
    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://www.overleaf.com/docs';
    form.target = '_blank';

    // snip_name parameter specifies the project and filename
    const nameInput = document.createElement('input');
    nameInput.type = 'hidden';
    nameInput.name = 'snip_name';
    const cleanDocName = (title || 'LitBuddy_Manuscript').replace(/[^a-zA-Z0-9_\-]/g, '_');
    nameInput.value = `${cleanDocName}.tex`;
    form.appendChild(nameInput);

    // textarea holds raw LaTeX code ensuring special characters and newlines are safely submitted
    const textarea = document.createElement('textarea');
    textarea.name = 'snip';
    textarea.style.display = 'none';
    textarea.value = latexSource;
    form.appendChild(textarea);

    document.body.appendChild(form);
    form.submit();
    document.body.removeChild(form);
  };

  // One-click Open in Local Overleaf Community Edition
  const handleOpenLocalOverleaf = async () => {
    const localUrl = await showPrompt('Enter your local Overleaf Community Edition URL:', 'http://localhost:80', 'Connect Overleaf Server', 'http://localhost:80');
    if (localUrl) {
      window.open(localUrl, '_blank');
    }
  };

  // AI-Assisted Auto-Fix for LaTeX Syntax Errors
  const handleAutoFixErrors = () => {
    if (diagnosticErrors.length === 0) return;
    const fixed = autoFixLatexSource(latexSource, diagnosticErrors);
    onChange(fixed);
    setShowDiagnosticModal(false);
  };

  // Line count & word count
  const stats = useMemo(() => {
    const lines = latexSource.split('\n').length;
    const words = latexSource
      .replace(/\\[a-zA-Z]+(\{[^}]*\})?/g, ' ')
      .replace(/[%$&#_{}]/g, ' ')
      .split(/\s+/)
      .filter(Boolean).length;
    return { lines, words };
  }, [latexSource]);

  // Insert snippet into textarea
  const insertSnippet = (snippet: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newContent =
      latexSource.substring(0, start) +
      snippet +
      latexSource.substring(end);

    onChange(newContent);

    setTimeout(() => {
      textarea.focus();
      const pos = start + snippet.length;
      textarea.setSelectionRange(pos, pos);
    }, 0);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(latexSource);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Compile / Parse LaTeX to Academic HTML Preview with KaTeX
  const compiledPreview = useMemo(() => {
    if (!latexSource.trim()) return null;

    let source = latexSource;

    // 1. Remove comments (% to end of line)
    source = source.replace(/(^|[^\\])%.*$/gm, '$1');

    // 2. Extract Document Metadata
    const titleMatch = source.match(/\\title\{([^}]+)\}/);
    const authorMatch = source.match(/\\author\{([^}]+)\}/);
    const dateMatch = source.match(/\\date\{([^}]+)\}/);
    const abstractMatch = source.match(/\\begin\{abstract\}([\s\S]*?)\\end\{abstract\}/);

    const docTitle = titleMatch ? titleMatch[1].replace(/\\\\/g, ' ') : title;
    const docAuthor = authorMatch ? authorMatch[1].replace(/\\\\/g, ', ') : '';
    const docDate = dateMatch ? (dateMatch[1] === '\\today' ? new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : dateMatch[1]) : '';
    const abstractContent = abstractMatch ? abstractMatch[1].trim() : '';

    // Clean body: extract between \begin{document} and \end{document} if present
    const docMatch = source.match(/\\begin\{document\}([\s\S]*?)\\end\{document\}/);
    let body = docMatch ? docMatch[1] : source;

    // Remove \maketitle and \begin{abstract}...\end{abstract} from body
    body = body.replace(/\\maketitle/g, '');
    body = body.replace(/\\begin\{abstract\}[\s\S]*?\\end\{abstract\}/g, '');

    // 3. Render Equations / Display Math
    // Match \begin{equation}...\end{equation} and \begin{align}...\end{align}
    body = body.replace(/\\begin\{(?:equation|align)\*?\}([\s\S]*?)\\end\{(?:equation|align)\*?\}/g, (_, math) => {
      try {
        const rendered = katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
        return `<div class="my-4 py-2 text-center overflow-x-auto bg-zinc-950/70 border border-zinc-800 rounded-lg p-3">${rendered}</div>`;
      } catch {
        return `<pre class="text-xs text-rose-400 p-2">${math}</pre>`;
      }
    });

    // Match $$...$$
    body = body.replace(/\$\$([\s\S]*?)\$\$/g, (_, math) => {
      try {
        const rendered = katex.renderToString(math.trim(), { displayMode: true, throwOnError: false });
        return `<div class="my-4 py-2 text-center overflow-x-auto bg-zinc-950/70 border border-zinc-800 rounded-lg p-3">${rendered}</div>`;
      } catch {
        return `$$${math}$$`;
      }
    });

    // Match inline math $...$
    body = body.replace(/\$([^$\n\r]+?)\$/g, (_, math) => {
      try {
        const rendered = katex.renderToString(math.trim(), { displayMode: false, throwOnError: false });
        return `<span class="inline-math font-serif px-0.5">${rendered}</span>`;
      } catch {
        return `$${math}$`;
      }
    });

    // 4. Sections & Numbering
    let secCount = 0;
    let subSecCount = 0;
    body = body.replace(/\\section\{([^}]+)\}/g, (_, secTitle) => {
      secCount++;
      subSecCount = 0;
      return `<h2 class="text-lg font-bold text-zinc-100 mt-6 mb-3 font-serif border-b border-zinc-800/80 pb-1.5"><span class="text-zinc-400 mr-2 font-sans font-medium">${secCount}.</span>${secTitle}</h2>`;
    });

    body = body.replace(/\\subsection\{([^}]+)\}/g, (_, subTitle) => {
      subSecCount++;
      return `<h3 class="text-sm font-semibold text-zinc-200 mt-4 mb-2 font-serif"><span class="text-zinc-500 mr-2 font-sans">${secCount}.${subSecCount}</span>${subTitle}</h3>`;
    });

    body = body.replace(/\\subsubsection\{([^}]+)\}/g, (_, sub3Title) => {
      return `<h4 class="text-xs font-semibold text-zinc-300 mt-3 mb-1.5 font-serif italic">${sub3Title}</h4>`;
    });

    // 5. Text styles: \textbf, \textit, \texttt, \emph
    body = body.replace(/\\textbf\{([^}]+)\}/g, '<strong>$1</strong>');
    body = body.replace(/\\textit\{([^}]+)\}/g, '<em>$1</em>');
    body = body.replace(/\\emph\{([^}]+)\}/g, '<em>$1</em>');
    body = body.replace(/\\texttt\{([^}]+)\}/g, '<code class="bg-zinc-800 text-zinc-300 px-1 py-0.5 rounded text-[11px] font-mono">$1</code>');

    // 6. Citations: \cite{key} -> [Key]
    body = body.replace(/\\cite\{([^}]+)\}/g, (_, keys) => {
      const parts = keys.split(',').map((k: string) => k.trim());
      return parts
        .map(
          (k: string) =>
            `<span class="inline-flex items-center px-1.5 py-0.2 mx-0.5 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 text-[10px] font-mono font-medium hover:border-zinc-500 transition-colors" title="Citation: ${k}">[${k}]</span>`
        )
        .join('');
    });

    // 7. Itemize & Enumerate lists
    body = body.replace(/\\begin\{itemize\}([\s\S]*?)\\end\{itemize\}/g, (_, items) => {
      const listItems = items
        .split('\\item')
        .slice(1)
        .map((item: string) => `<li class="my-1">${item.trim()}</li>`)
        .join('');
      return `<ul class="list-disc list-inside space-y-1 my-3 text-zinc-300 text-xs">${listItems}</ul>`;
    });

    body = body.replace(/\\begin\{enumerate\}([\s\S]*?)\\end\{enumerate\}/g, (_, items) => {
      const listItems = items
        .split('\\item')
        .slice(1)
        .map((item: string) => `<li class="my-1">${item.trim()}</li>`)
        .join('');
      return `<ol class="list-decimal list-inside space-y-1 my-3 text-zinc-300 text-xs">${listItems}</ol>`;
    });

    // 8. Tables & Tabular
    body = body.replace(/\\begin\{table\}[\s\S]*?\\caption\{([^}]+)\}[\s\S]*?\\begin\{tabular\}\{[^}]+\}([\s\S]*?)\\end\{tabular\}[\s\S]*?\\end\{table\}/g, (_, caption, rows) => {
      const cleanRows = rows
        .split('\\\\')
        .map((r: string) => r.replace(/\\toprule|\\midrule|\\bottomrule|\\hline/g, '').trim())
        .filter((r: string) => r.length > 0);

      const tableHtml = `
        <div class="my-6 overflow-x-auto">
          <div class="text-center text-xs font-semibold text-zinc-300 mb-1.5 font-serif italic">Table: ${caption}</div>
          <table class="w-full text-xs text-left border-collapse border-y-2 border-zinc-600">
            <tbody>
              ${cleanRows
                .map((row: string, i: number) => {
                  const cells = row.split('&').map((c) => c.trim());
                  const isHeader = i === 0;
                  const tag = isHeader ? 'th' : 'td';
                  const border = isHeader ? 'border-b border-zinc-700 font-semibold text-zinc-200' : 'text-zinc-300';
                  return `<tr>${cells.map((c) => `<${tag} class="px-3 py-1.5 ${border}">${c}</${tag}>`).join('')}</tr>`;
                })
                .join('')}
            </tbody>
          </table>
        </div>
      `;
      return tableHtml;
    });

    // 9. Line breaks \\
    body = body.replace(/\\\\/g, '<br/>');

    // 10. Paragraph breaks
    const paragraphs = body
      .split(/\n\s*\n/)
      .map((p) => {
        const trimmed = p.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('<h') || trimmed.startsWith('<div') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol') || trimmed.startsWith('<table')) {
          return trimmed;
        }
        return `<p class="my-2.5 leading-relaxed text-zinc-300 text-xs">${trimmed}</p>`;
      })
      .join('\n');

    return {
      title: docTitle,
      author: docAuthor,
      date: docDate,
      abstract: abstractContent,
      bodyHtml: paragraphs
    };
  }, [latexSource, title]);

  return (
    <div className="flex flex-col h-full bg-zinc-950 text-zinc-100 overflow-hidden">
      {/* Top Header & Controls */}
      <div className="px-6 py-3 border-b border-zinc-800 bg-zinc-900/70 backdrop-blur flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <FileCode className="w-4 h-4 text-zinc-400 shrink-0" />
          <input
            type="text"
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            placeholder="Untitled LaTeX Manuscript..."
            className="bg-transparent border-none text-sm font-semibold text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:ring-0 w-full min-w-0"
          />
        </div>

        {/* Status, Templates & Mode Toggles */}
        <div className="flex items-center gap-3 shrink-0 text-xs">
          {/* Save Status */}
          <div className="flex items-center gap-1.5 text-zinc-400">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isSaving ? 'bg-amber-400 animate-pulse' : 'bg-emerald-400'
              }`}
            />
            <span className="text-[11px]">
              {isSaving ? 'Saving...' : lastSaved ? `Saved ${lastSaved}` : 'Local Vault'}
            </span>
          </div>

          {/* Template Selector Button */}
          <button
            type="button"
            onClick={() => setShowTemplateModal(true)}
            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md font-medium flex items-center gap-1.5 transition border border-zinc-700"
          >
            <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
            <span>Templates</span>
          </button>

          {/* View Modes */}
          <div className="flex items-center bg-zinc-950 p-1 rounded-lg border border-zinc-800">
            <button
              type="button"
              onClick={() => setViewMode('code')}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition ${
                viewMode === 'code' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="LaTeX Source Only"
            >
              <Code className="w-3.5 h-3.5" />
              <span>Source</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('split')}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition ${
                viewMode === 'split' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Overleaf-style Split Editor & Live Preview"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Split</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('preview')}
              className={`px-2.5 py-1 rounded text-xs font-medium flex items-center gap-1.5 transition ${
                viewMode === 'preview' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
              }`}
              title="Typeset Preview"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5">
            {/* AI Diagnostics Warning / Fix Pill */}
            {diagnosticErrors.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDiagnosticModal(true)}
                className="px-2 py-1 bg-amber-950/50 hover:bg-amber-900/60 border border-amber-700/60 text-amber-300 rounded-md font-medium flex items-center gap-1.5 transition text-xs"
                title={`${diagnosticErrors.length} LaTeX syntax warnings detected. Click to auto-fix.`}
              >
                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                <span>{diagnosticErrors.length} Warnings</span>
              </button>
            )}

            {/* Math Graphing Tool Button */}
            <button
              type="button"
              onClick={() => setShowPlotterModal(true)}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md font-medium flex items-center gap-1.5 transition border border-zinc-700"
              title="Graph functions and generate LaTeX PGFPlots code"
            >
              <TrendingUp className="w-3.5 h-3.5 text-zinc-400" />
              <span>Plot Graph</span>
            </button>

            {/* Overleaf Cloud Sync */}
            <button
              type="button"
              onClick={handleOpenOverleafCloud}
              className="px-2.5 py-1 bg-emerald-950/50 hover:bg-emerald-900/60 text-emerald-300 rounded-md font-medium flex items-center gap-1.5 transition border border-emerald-700/60"
              title="Open manuscript directly in Overleaf Cloud"
            >
              <ExternalLink className="w-3.5 h-3.5 text-emerald-400" />
              <span>Overleaf</span>
            </button>

            {/* Local Overleaf Link */}
            <button
              type="button"
              onClick={handleOpenLocalOverleaf}
              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 rounded-md transition"
              title="Connect to local Overleaf Community Edition container"
            >
              <Wrench className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={copyToClipboard}
              className="p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md transition"
              title="Copy Raw LaTeX Source"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
            <button
              type="button"
              onClick={onExportTex}
              className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md font-medium flex items-center gap-1.5 transition border border-zinc-700"
              title="Export as .tex file"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .tex</span>
            </button>
          </div>
        </div>
      </div>

      {/* LaTeX Quick Insertion Bar */}
      {viewMode !== 'preview' && (
        <div className="px-6 py-2 border-b border-zinc-800/80 bg-zinc-900/40 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none text-xs text-zinc-400">
          <span className="text-[11px] font-medium text-zinc-500 mr-1 uppercase tracking-wider">Insert:</span>

          <button
            type="button"
            onClick={() => insertSnippet('\\section{Section Title}\n')}
            className="px-2 py-0.5 hover:bg-zinc-800 hover:text-zinc-200 rounded font-mono text-[11px] transition"
          >
            \section
          </button>
          <button
            type="button"
            onClick={() => insertSnippet('\\subsection{Subsection Title}\n')}
            className="px-2 py-0.5 hover:bg-zinc-800 hover:text-zinc-200 rounded font-mono text-[11px] transition"
          >
            \subsection
          </button>

          <div className="w-px h-4 bg-zinc-800 mx-1" />

          <button
            type="button"
            onClick={() => insertSnippet('\\begin{equation}\n  \\mathcal{L}_{\\text{loss}} = -\\sum_{i=1}^N y_i \\log \\hat{y}_i\n\\end{equation}\n')}
            className="px-2 py-0.5 hover:bg-zinc-800 hover:text-zinc-200 rounded font-mono text-[11px] transition flex items-center gap-1"
          >
            <Sigma className="w-3 h-3 text-zinc-400" />
            <span>\equation</span>
          </button>

          <button
            type="button"
            onClick={() => insertSnippet('\\frac{a}{b}')}
            className="px-2 py-0.5 hover:bg-zinc-800 hover:text-zinc-200 rounded font-mono text-[11px] transition"
          >
            \frac&#123;a&#125;&#123;b&#125;
          </button>

          <button
            type="button"
            onClick={() => insertSnippet('\\sum_{i=1}^n ')}
            className="px-2 py-0.5 hover:bg-zinc-800 hover:text-zinc-200 rounded font-mono text-[11px] transition"
          >
            \sum
          </button>

          <button
            type="button"
            onClick={() => insertSnippet('\\int_0^\\infty ')}
            className="px-2 py-0.5 hover:bg-zinc-800 hover:text-zinc-200 rounded font-mono text-[11px] transition"
          >
            \int
          </button>

          <div className="w-px h-4 bg-zinc-800 mx-1" />

          <button
            type="button"
            onClick={() => insertSnippet('\\begin{table}[ht]\n\\centering\n\\caption{Table Caption}\n\\begin{tabular}{l c c}\n\\toprule\nMethod & Metric & Gain \\\\\n\\midrule\nModel A & 92.4 & +3.2 \\\\\n\\bottomrule\n\\end{tabular}\n\\end{table}\n')}
            className="px-2 py-0.5 hover:bg-zinc-800 hover:text-zinc-200 rounded font-mono text-[11px] transition"
          >
            \table
          </button>

          <button
            type="button"
            onClick={() => insertSnippet('\\begin{figure}[ht]\n\\centering\n% \\includegraphics[width=0.8\\linewidth]{figure.png}\n\\caption{Model Architecture Overview}\n\\label{fig:arch}\n\\end{figure}\n')}
            className="px-2 py-0.5 hover:bg-zinc-800 hover:text-zinc-200 rounded font-mono text-[11px] transition"
          >
            \figure
          </button>

          <div className="w-px h-4 bg-zinc-800 mx-1" />

          {/* Cite Paper */}
          <button
            type="button"
            onClick={onOpenCitationPicker}
            className="px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded text-xs font-medium flex items-center gap-1.5 transition ml-auto border border-zinc-700"
          >
            <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
            <span>\cite&#123;paper&#125;</span>
          </button>
        </div>
      )}

      {/* Editor & Preview Split */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left: Code Pane */}
        {(viewMode === 'code' || viewMode === 'split') && (
          <div className={`flex-1 flex flex-col h-full bg-zinc-950 ${viewMode === 'split' ? 'border-r border-zinc-800' : ''}`}>
            <textarea
              ref={textareaRef}
              value={latexSource}
              onChange={(e) => onChange(e.target.value)}
              placeholder="% Write or paste your LaTeX code here..."
              className="w-full flex-1 p-6 bg-transparent text-zinc-100 placeholder-zinc-600 font-mono text-xs leading-relaxed resize-none focus:outline-hidden focus:ring-0 overflow-y-auto"
              spellCheck="false"
            />
          </div>
        )}

        {/* Right: Academic Compiled Typeset Preview */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className="flex-1 overflow-y-auto p-8 bg-zinc-900/30">
            {compiledPreview ? (
              <div className="max-w-2xl mx-auto bg-zinc-900/90 border border-zinc-800 rounded-xl p-10 shadow-xl text-zinc-200">
                {/* Academic Title Block */}
                <div className="text-center mb-8 pb-6 border-b border-zinc-800">
                  <h1 className="text-xl font-bold font-serif text-zinc-100 tracking-tight mb-2">
                    {compiledPreview.title}
                  </h1>
                  {compiledPreview.author && (
                    <div className="text-xs text-zinc-400 font-serif italic mb-1">
                      {compiledPreview.author}
                    </div>
                  )}
                  {compiledPreview.date && (
                    <div className="text-[11px] text-zinc-500 font-mono">
                      {compiledPreview.date}
                    </div>
                  )}
                </div>

                {/* Abstract */}
                {compiledPreview.abstract && (
                  <div className="mb-6 px-6 py-4 bg-zinc-950/60 border border-zinc-800/80 rounded-lg">
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-center text-zinc-400 mb-2 font-serif">
                      Abstract
                    </h3>
                    <p className="text-xs text-zinc-300 leading-relaxed font-serif text-justify">
                      {compiledPreview.abstract}
                    </p>
                  </div>
                )}

                {/* Body Content */}
                <div
                  dangerouslySetInnerHTML={{ __html: compiledPreview.bodyHtml }}
                  className="space-y-3 font-serif"
                />
              </div>
            ) : (
              <div className="py-20 text-center text-zinc-600">
                <FileCode className="w-10 h-10 mx-auto mb-2 opacity-40" />
                <p className="text-xs">Type or load a LaTeX template to view real-time KaTeX typeset preview.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Metrics Bar */}
      <div className="px-6 py-2 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between text-[11px] text-zinc-400 shrink-0">
        <div className="flex items-center gap-4">
          <span>
            <strong className="text-zinc-300 font-mono">{stats.lines}</strong> lines
          </span>
          <span>
            <strong className="text-zinc-300 font-mono">{stats.words}</strong> words
          </span>
          <span className="text-zinc-500">Overleaf Compatible</span>
        </div>
        <div className="text-zinc-500 text-[10px]">
          Live KaTeX Engine (Math Mode, Equations, Tables, Citations)
        </div>
      </div>

      {/* Template Chooser Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-lg w-full space-y-4 shadow-2xl">
            <div>
              <h3 className="text-sm font-semibold text-zinc-100">Select Academic Template</h3>
              <p className="text-xs text-zinc-400">Loading a template will replace current LaTeX content in this draft.</p>
            </div>

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  onChange(LATEX_TEMPLATES.literature_review);
                  setShowTemplateModal(false);
                }}
                className="w-full text-left p-3 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition"
              >
                <div className="text-xs font-semibold text-zinc-200">Literature Review / Survey Paper</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">Comprehensive structure with Taxonomy, Equations, Tables, and Bibliography.</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onChange(LATEX_TEMPLATES.ieee_conference);
                  setShowTemplateModal(false);
                }}
                className="w-full text-left p-3 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition"
              >
                <div className="text-xs font-semibold text-zinc-200">IEEE Conference Paper</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">Two-column format, author block, problem formulation, and experimental benchmarks.</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onChange(LATEX_TEMPLATES.research_proposal);
                  setShowTemplateModal(false);
                }}
                className="w-full text-left p-3 rounded-lg bg-zinc-950 border border-zinc-800 hover:border-zinc-700 transition"
              >
                <div className="text-xs font-semibold text-zinc-200">Academic Research Proposal / Grant</div>
                <div className="text-[11px] text-zinc-400 mt-0.5">Project summary, Specific Aims, and Preliminary Studies outline.</div>
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 font-medium transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Math Function & Data Plotter Modal */}
      <MathPlotterModal
        isOpen={showPlotterModal}
        onClose={() => setShowPlotterModal(false)}
        onInsertLatex={(pgfCode) => insertSnippet('\n' + pgfCode + '\n')}
      />

      {/* AI LaTeX Syntax Diagnostics Modal */}
      {showDiagnosticModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl antigravity-glass p-6 text-zinc-200 border border-white/10 shadow-2xl relative space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <h3 className="font-semibold text-sm text-zinc-100">LaTeX Syntax Diagnostic Warnings</h3>
              </div>
              <button type="button" onClick={() => setShowDiagnosticModal(false)} className="text-zinc-400 hover:text-white p-1">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-60 overflow-y-auto space-y-2 text-xs">
              {diagnosticErrors.map((err, idx) => (
                <div key={idx} className="p-3 rounded-xl bg-zinc-900/80 border border-zinc-800 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-amber-300">
                      {err.line ? `Line ${err.line}: ` : ''}{err.message}
                    </span>
                    <span className="font-mono text-[10px] text-zinc-500 uppercase">{err.rule}</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">{err.suggestion}</p>
                </div>
              ))}
            </div>

            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => setShowDiagnosticModal(false)}
                className="flex-1 py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 font-medium text-xs transition"
              >
                Dismiss
              </button>
              <button
                type="button"
                onClick={handleAutoFixErrors}
                className="flex-1 py-2 px-3 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition shadow-md"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Auto-Fix with AI</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
