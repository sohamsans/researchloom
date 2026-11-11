import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileEdit,
  FileText,
  FileCode,
  Plus,
  Trash2,
  Search,
  BookOpen,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Sparkles
} from 'lucide-react';
import { ManuscriptItem, ManuscriptMode, ReviewPaper, RawPaperMetadata } from '../../types';
import { api } from '../../services/api';
import { RichDocEditor } from './RichDocEditor';
import { LatexStudio, LATEX_TEMPLATES } from './LatexStudio';
import { CitationPickerModal } from './CitationPickerModal';
import { useNativeDialog } from '../../context/NativeDialogContext';

interface WritingStudioProps {
  papers: ReviewPaper[];
  candidatePapers?: RawPaperMetadata[];
  currentTopic?: string;
  incomingCitation?: { id: string; title: string; authors?: string[]; year?: number; doi?: string } | null;
  incomingFormulaSnippet?: string | null;
  incomingStylusNote?: string | null;
  incomingSection?: { title: string; latex: string; bibtex: string[] } | null;
  onClearIncomingCitation?: () => void;
  onClearIncomingFormula?: () => void;
  onClearIncomingStylusNote?: () => void;
  onClearIncomingSection?: () => void;
}

const DEFAULT_DOC_NOTE = `# Research Synthesis & Literature Notes

## 1. Executive Problem Formulation
Summarize the primary research challenge and operational boundaries identified across the analyzed papers.

## 2. Core Methodology Findings
- **Dominant Approach**: Highlight the consensus techniques and architecture backbones.
- **Novel Insights**: Note unconventional or state-of-the-art formulations.

## 3. Quantitative Comparison
| Model / Pipeline | Accuracy | Latency | Key Advantage |
|:---|:---:|:---:|:---|
| Baseline | 88.2% | 45ms | High interpretability |
| Proposed SOTA | 94.6% | 12ms | Low computational footprint |

## 4. Unaddressed Research Gaps
Document areas where current literature remains inconclusive or vulnerable to real-world edge cases.

## 5. Mathematical Formulations
$$
\\mathcal{L}_{\\text{total}} = \\lambda_1 \\mathcal{L}_{\\text{task}} + \\lambda_2 \\mathcal{L}_{\\text{reg}}
$$
`;

export const WritingStudio: React.FC<WritingStudioProps> = ({
  papers,
  candidatePapers = [],
  currentTopic = '',
  incomingCitation = null,
  incomingFormulaSnippet = null,
  incomingStylusNote = null,
  incomingSection = null,
  onClearIncomingCitation,
  onClearIncomingFormula,
  onClearIncomingStylusNote,
  onClearIncomingSection
}) => {
  const { showConfirm, showToast } = useNativeDialog();
  const [manuscripts, setManuscripts] = useState<ManuscriptItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeManuscript, setActiveManuscript] = useState<ManuscriptItem | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string>('');
  const [isCitationPickerOpen, setIsCitationPickerOpen] = useState(false);
  const [pendingCitation, setPendingCitation] = useState<string | null>(null);
  const [toastBanner, setToastBanner] = useState<string | null>(null);

  // Auto-save debounce timer ref
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load existing manuscripts on mount
  const loadManuscripts = useCallback(async () => {
    try {
      const res = await api.fetchManuscripts();
      if (res && res.items) {
        setManuscripts(res.items);
        if (res.items.length > 0) {
          // If no active manuscript selected, select the first one
          setActiveId((prev) => prev || res.items[0].id);
          setActiveManuscript((prev) => prev || res.items[0]);
        } else {
          // Create an initial default note if database is empty
          handleCreateNew('rich');
        }
      }
    } catch (err) {
      console.warn('Failed to fetch manuscripts from API, creating offline draft:', err);
      // Create local fallback draft
      if (manuscripts.length === 0) {
        const fallbackDraft: ManuscriptItem = {
          id: 'draft_' + Date.now(),
          title: currentTopic ? `${currentTopic} - Synthesis Note` : 'Autonomous Literature Note',
          mode: 'rich',
          content: DEFAULT_DOC_NOTE,
          latex_source: LATEX_TEMPLATES.literature_review,
          associated_topic: currentTopic,
          citations: [],
          word_count: 140,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        setManuscripts([fallbackDraft]);
        setActiveId(fallbackDraft.id);
        setActiveManuscript(fallbackDraft);
      }
    }
  }, [currentTopic]);

  useEffect(() => {
    loadManuscripts();
  }, [loadManuscripts]);

  // Sync activeManuscript when activeId changes
  useEffect(() => {
    if (activeId) {
      const target = manuscripts.find((m) => m.id === activeId);
      if (target) {
        setActiveManuscript(target);
      }
    }
  }, [activeId, manuscripts]);

  // Debounced auto-save handler
  const triggerAutoSave = useCallback((updated: ManuscriptItem) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setIsSaving(true);
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const saved = await api.saveManuscript({
          id: updated.id.startsWith('draft_') ? undefined : updated.id,
          title: updated.title,
          mode: updated.mode,
          content: updated.content,
          latex_source: updated.latex_source,
          associated_topic: updated.associated_topic,
          citations: updated.citations,
          word_count: updated.word_count
        });

        // Update list with server saved item
        setManuscripts((prev) =>
          prev.map((item) => (item.id === updated.id ? saved : item))
        );
        setActiveId(saved.id);
        setActiveManuscript(saved);
        setLastSaved(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      } catch (err) {
        console.warn('Auto-save error:', err);
      } finally {
        setIsSaving(false);
      }
    }, 1200);
  }, []);

  // Update content for Rich Doc
  const handleContentChange = (newContent: string) => {
    if (!activeManuscript) return;
    const wordCount = newContent.trim().split(/\s+/).filter(Boolean).length;
    const updated: ManuscriptItem = {
      ...activeManuscript,
      content: newContent,
      word_count: wordCount,
      updated_at: new Date().toISOString()
    };
    setActiveManuscript(updated);
    setManuscripts((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    triggerAutoSave(updated);
  };

  // Update LaTeX source
  const handleLatexChange = (newSource: string) => {
    if (!activeManuscript) return;
    const wordCount = newSource
      .replace(/\\[a-zA-Z]+(\{[^}]*\})?/g, ' ')
      .replace(/[%$&#_{}]/g, ' ')
      .split(/\s+/)
      .filter(Boolean).length;
    const updated: ManuscriptItem = {
      ...activeManuscript,
      latex_source: newSource,
      word_count: wordCount,
      updated_at: new Date().toISOString()
    };
    setActiveManuscript(updated);
    setManuscripts((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    triggerAutoSave(updated);
  };

  // Update Title
  const handleTitleChange = (newTitle: string) => {
    if (!activeManuscript) return;
    const updated: ManuscriptItem = {
      ...activeManuscript,
      title: newTitle,
      updated_at: new Date().toISOString()
    };
    setActiveManuscript(updated);
    setManuscripts((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    triggerAutoSave(updated);
  };

  // Create new manuscript
  const handleCreateNew = async (mode: ManuscriptMode) => {
    const isLatex = mode === 'latex';
    const newDoc: ManuscriptItem = {
      id: 'draft_' + Date.now(),
      title: isLatex
        ? currentTopic ? `${currentTopic} - LaTeX Paper` : 'New Academic LaTeX Manuscript'
        : currentTopic ? `${currentTopic} - Research Note` : 'New Academic Note',
      mode,
      content: isLatex ? '' : DEFAULT_DOC_NOTE,
      latex_source: isLatex ? LATEX_TEMPLATES.literature_review : '',
      associated_topic: currentTopic || undefined,
      citations: [],
      word_count: isLatex ? 250 : 140,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      const saved = await api.saveManuscript({
        title: newDoc.title,
        mode: newDoc.mode,
        content: newDoc.content,
        latex_source: newDoc.latex_source,
        associated_topic: newDoc.associated_topic,
        citations: newDoc.citations,
        word_count: newDoc.word_count
      });
      setManuscripts((prev) => [saved, ...prev]);
      setActiveId(saved.id);
      setActiveManuscript(saved);
    } catch {
      setManuscripts((prev) => [newDoc, ...prev]);
      setActiveId(newDoc.id);
      setActiveManuscript(newDoc);
    }
  };

  // Delete manuscript
  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await showConfirm('Are you sure you want to delete this manuscript?', 'Delete Manuscript');
    if (confirmed) {
      try {
        await api.deleteManuscript(id);
      } catch (err) {
        console.warn('Delete request failed:', err);
      }
      setManuscripts((prev) => {
        const nextList = prev.filter((m) => m.id !== id);
        if (activeId === id) {
          if (nextList.length > 0) {
            setActiveId(nextList[0].id);
            setActiveManuscript(nextList[0]);
          } else {
            setActiveId(null);
            setActiveManuscript(null);
          }
        }
        return nextList;
      });
      showToast('Manuscript deleted', 'info');
    }
  };

  // Insert citation from picker
  const handleInsertCitation = (citationText: string, paperInfo: { id: string; title: string; authors: string[]; year?: number; doi?: string }) => {
    if (!activeManuscript) return;

    if (activeManuscript.mode === 'latex') {
      // In LaTeX mode: Append \bibitem to bibliography if present, and insert cite command
      let updatedSource = activeManuscript.latex_source;
      const citeKey = citationText.replace(/\\cite\{|\}/g, '').trim();

      // Check if bibitem already exists
      if (!updatedSource.includes(`\\bibitem{${citeKey}}`)) {
        const firstAuthor = paperInfo.authors[0] || 'Author';
        const year = paperInfo.year || 2024;
        const newBibItem = `\\bibitem{${citeKey}} ${firstAuthor}, et al. (${year}). ${paperInfo.title}. ${paperInfo.doi ? `DOI: ${paperInfo.doi}` : ''}\n`;

        if (updatedSource.includes('\\end{thebibliography}')) {
          updatedSource = updatedSource.replace('\\end{thebibliography}', `${newBibItem}\\end{thebibliography}`);
        }
      }

      // Append citation at current position
      updatedSource = updatedSource + ` ${citationText} `;
      handleLatexChange(updatedSource);
    } else {
      // In rich mode, trigger direct in-place citation insertion into WYSIWYG sheet
      setPendingCitation(citationText);
    }
  };

  // Handle incoming citation from external views (e.g. Flow Maps or Paper Detail Modal)
  useEffect(() => {
    if (!incomingCitation) return;
    
    // Fallback manuscript resolution if activeManuscript is not yet populated
    const targetDoc = activeManuscript || manuscripts[0];
    if (!targetDoc) return;

    const authors = incomingCitation.authors || [];
    const firstAuthor = authors.length > 0
      ? (authors[0].split(' ').pop() || 'Ref').replace(/[^a-zA-Z]/g, '')
      : 'Ref';
    const year = incomingCitation.year || 2024;
    const citeKey = `${firstAuthor.toLowerCase()}${year}`;
    const citeCmd = `\\cite{${citeKey}}`;
    const citeText = `[${firstAuthor} et al., ${year}]`;

    if (targetDoc.mode === 'latex') {
      let updatedSource = targetDoc.latex_source;
      if (!updatedSource.includes(`\\bibitem{${citeKey}}`)) {
        const newBibItem = `\\bibitem{${citeKey}} ${firstAuthor}, et al. (${year}). ${incomingCitation.title}. ${incomingCitation.doi ? `DOI: ${incomingCitation.doi}` : ''}\n`;
        if (updatedSource.includes('\\end{thebibliography}')) {
          updatedSource = updatedSource.replace('\\end{thebibliography}', `${newBibItem}\\end{thebibliography}`);
        } else {
          updatedSource += `\n\n\\begin{thebibliography}{99}\n${newBibItem}\\end{thebibliography}\n`;
        }
      }
      updatedSource = updatedSource + ` ${citeCmd} `;
      handleLatexChange(updatedSource);
    } else {
      const appended = targetDoc.content + `\n\n> [Citation] **Cited Paper**: ${citeText} *${incomingCitation.title}* ${incomingCitation.doi ? `([DOI](https://doi.org/${incomingCitation.doi}))` : ''}\n`;
      handleContentChange(appended);
    }

    setToastBanner(`Inserted citation: "${incomingCitation.title.slice(0, 40)}..." into active manuscript!`);
    onClearIncomingCitation?.();
  }, [incomingCitation, activeManuscript, manuscripts, onClearIncomingCitation]);

  // Handle incoming formula from Formula Studio
  useEffect(() => {
    if (!incomingFormulaSnippet) return;

    const targetDoc = activeManuscript || manuscripts[0];
    if (!targetDoc) return;

    const isDisplayMath = /^\s*(\\begin\{(equation|align|gather|multline|flalign)\*?\}|\\\[|\$\$)/.test(incomingFormulaSnippet);

    if (targetDoc.mode === 'latex') {
      const snippetToInsert = isDisplayMath
        ? incomingFormulaSnippet
        : `\\begin{equation}\n  ${incomingFormulaSnippet}\n\\end{equation}`;

      const updatedSource = targetDoc.latex_source + `\n\n% Inserted from Formula Studio\n${snippetToInsert}\n`;
      handleLatexChange(updatedSource);
    } else {
      const isAlreadyWrappedInDollars = incomingFormulaSnippet.trim().startsWith('$$') || isDisplayMath;
      const snippetToInsert = isAlreadyWrappedInDollars
        ? incomingFormulaSnippet
        : `$$\n${incomingFormulaSnippet}\n$$`;

      const appended = targetDoc.content + `\n\n${snippetToInsert}\n`;
      handleContentChange(appended);
    }

    setToastBanner('Inserted mathematical formula into active manuscript!');
    onClearIncomingFormula?.();
  }, [incomingFormulaSnippet, activeManuscript, manuscripts, onClearIncomingFormula]);

  // Handle incoming stylus handwritten note
  useEffect(() => {
    if (!incomingStylusNote) return;

    const targetDoc = activeManuscript || manuscripts[0];
    if (!targetDoc) return;

    if (targetDoc.mode === 'latex') {
      const updatedSource = targetDoc.latex_source + `\n\n% --- Handwritten Stylus Note ---\n% ${incomingStylusNote.replace(/\n/g, '\n% ')}\n`;
      handleLatexChange(updatedSource);
    } else {
      const appended = targetDoc.content + `\n\n${incomingStylusNote}\n`;
      handleContentChange(appended);
    }

    setToastBanner('Inserted handwritten note into active manuscript!');
    onClearIncomingStylusNote?.();
  }, [incomingStylusNote, activeManuscript, manuscripts, onClearIncomingStylusNote]);

  // Handle incoming comparative synthesis section from EvidenceMatrixStudio
  useEffect(() => {
    if (!incomingSection) return;

    const targetDoc = activeManuscript || manuscripts[0];
    if (!targetDoc) return;

    if (targetDoc.mode === 'latex') {
      let updatedSource = targetDoc.latex_source;
      const sectionLatex = `\n\n% --- Synthesized Comparative Section ---\n${incomingSection.latex}\n`;

      if (updatedSource.includes('\\end{document}')) {
        updatedSource = updatedSource.replace('\\end{document}', `${sectionLatex}\n\\end{document}`);
      } else {
        updatedSource += sectionLatex;
      }

      handleLatexChange(updatedSource);
      showToast(`Injected comparative section "${incomingSection.title}" into LaTeX manuscript!`, 'success');
    } else {
      const markdownSection = `\n\n## ${incomingSection.title}\n\n` +
        incomingSection.latex
          .replace(/\\section\{([^}]+)\}/g, '### $1\n')
          .replace(/\\subsection\{([^}]+)\}/g, '#### $1\n')
          .replace(/\\cite\{([^}]+)\}/g, '[$1]');
      const updated = targetDoc.content + markdownSection;
      handleContentChange(updated);
      showToast(`Injected comparative section "${incomingSection.title}" into notes document!`, 'success');
    }

    onClearIncomingSection?.();
  }, [incomingSection, activeManuscript, manuscripts, onClearIncomingSection]);

  // Export handlers
  const handleExportRichDoc = (format: 'md' | 'html' | 'txt') => {
    if (!activeManuscript) return;
    const filename = `${activeManuscript.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.${format}`;
    let blob: Blob;

    if (format === 'html') {
      const htmlDoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>${activeManuscript.title}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Times New Roman", serif; max-width: 850px; margin: 40px auto; padding: 0 24px; line-height: 1.7; color: #1f2937; }
h1, h2, h3 { color: #111827; }
table { border-collapse: collapse; width: 100%; margin: 20px 0; border: 1px solid #d1d5db; }
th, td { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
th { background-color: #f3f4f6; font-weight: 600; }
code { background-color: #f3f4f6; padding: 2px 4px; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
</style>
</head>
<body>
<h1>${activeManuscript.title}</h1>
<div>${activeManuscript.content}</div>
</body>
</html>`;
      blob = new Blob([htmlDoc], { type: 'text/html' });
    } else {
      blob = new Blob([activeManuscript.content], { type: format === 'md' ? 'text/markdown' : 'text/plain' });
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportLatex = () => {
    if (!activeManuscript) return;
    const filename = `${activeManuscript.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.tex`;
    const blob = new Blob([activeManuscript.latex_source], { type: 'text/x-tex' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Filter manuscripts
  const filteredManuscripts = manuscripts.filter((m) =>
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (m.associated_topic && m.associated_topic.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="flex-1 flex overflow-hidden bg-zinc-950 text-zinc-100 min-h-0">
      {/* 1. Manuscripts Sidebar */}
      <aside
        className={`${
          isSidebarOpen ? 'w-72' : 'w-0'
        } shrink-0 border-r border-zinc-800 bg-zinc-900/60 flex flex-col transition-all duration-200 overflow-hidden relative`}
      >
        {/* Sidebar Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-zinc-800 text-sky-400">
              <FileEdit className="w-4 h-4" />
            </div>
            <h2 className="text-xs font-semibold text-zinc-200">Writing Studio</h2>
          </div>

          {/* New Manuscript Menu */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleCreateNew('rich')}
              className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
              title="New Rich Doc Note (Word/Docs style)"
            >
              <FileText className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleCreateNew('latex')}
              className="p-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition"
              title="New LaTeX Manuscript (Overleaf style)"
            >
              <FileCode className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Filter Input */}
        <div className="p-3 border-b border-zinc-800/80">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search drafts..."
              className="w-full bg-zinc-950 border border-zinc-800 rounded-md pl-8 pr-2.5 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
            />
          </div>
        </div>

        {/* Manuscript List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {filteredManuscripts.length === 0 ? (
            <div className="py-10 text-center text-zinc-500">
              <p className="text-xs">No drafts found</p>
            </div>
          ) : (
            filteredManuscripts.map((m) => {
              const isSelected = m.id === activeId;
              return (
                <div
                  key={m.id}
                  onClick={() => {
                    setActiveId(m.id);
                    setActiveManuscript(m);
                  }}
                  className={`group relative p-3 rounded-lg cursor-pointer border transition ${
                    isSelected
                      ? 'bg-zinc-800/90 border-zinc-700 text-zinc-100 shadow-xs'
                      : 'border-transparent hover:bg-zinc-850 hover:border-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      {m.mode === 'latex' ? (
                        <FileCode className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                      ) : (
                        <FileText className="w-3.5 h-3.5 shrink-0 text-zinc-400" />
                      )}
                      <h4 className="text-xs font-medium truncate leading-tight">
                        {m.title || 'Untitled Draft'}
                      </h4>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleDelete(m.id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-400 transition"
                      title="Delete manuscript"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-500 font-mono">
                    <span
                      className={`px-1 py-0.2 rounded text-[9px] uppercase font-semibold ${
                        m.mode === 'latex'
                          ? 'bg-zinc-700/60 text-zinc-300'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {m.mode === 'latex' ? 'LaTeX' : 'Doc'}
                    </span>
                    <span>{m.word_count || 0} w</span>
                    {m.associated_topic && (
                      <span className="truncate max-w-[90px] text-zinc-500">
                        {m.associated_topic}
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-zinc-800 bg-zinc-950/60 flex items-center justify-between text-[11px] text-zinc-500">
          <span>{manuscripts.length} Manuscripts</span>
          <span className="font-mono text-[10px]">SQLite Vault</span>
        </div>
      </aside>

      {/* Sidebar Toggle Handle */}
      <button
        type="button"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="w-4 hover:w-5 bg-zinc-900 hover:bg-zinc-800 border-r border-zinc-800 flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-all shrink-0 cursor-pointer"
        title={isSidebarOpen ? 'Collapse Drafts Sidebar' : 'Expand Drafts Sidebar'}
      >
        {isSidebarOpen ? <ChevronLeft className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
      </button>

      {/* 2. Main Editor Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {toastBanner && (
          <div className="absolute top-3 left-6 right-6 z-30 px-4 py-2 rounded-xl antigravity-glass border border-emerald-500/40 text-emerald-300 text-xs font-medium flex items-center justify-between shadow-2xl animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
              <span className="truncate">{toastBanner}</span>
            </div>
            <button
              type="button"
              onClick={() => setToastBanner(null)}
              className="text-emerald-400 hover:text-white px-1.5 py-0.5 rounded hover:bg-emerald-500/20 text-xs ml-2"
            >
              ×
            </button>
          </div>
        )}
        {activeManuscript ? (
          activeManuscript.mode === 'latex' ? (
            <LatexStudio
              latexSource={activeManuscript.latex_source}
              onChange={handleLatexChange}
              title={activeManuscript.title}
              onTitleChange={handleTitleChange}
              onOpenCitationPicker={() => setIsCitationPickerOpen(true)}
              onExportTex={handleExportLatex}
              isSaving={isSaving}
              lastSaved={lastSaved}
            />
          ) : (
            <RichDocEditor
              content={activeManuscript.content}
              onChange={handleContentChange}
              title={activeManuscript.title}
              onTitleChange={handleTitleChange}
              onOpenCitationPicker={() => setIsCitationPickerOpen(true)}
              onExport={handleExportRichDoc}
              isSaving={isSaving}
              lastSaved={lastSaved}
              citationToInsert={pendingCitation}
              onCitationInserted={() => setPendingCitation(null)}
            />
          )
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-zinc-500">
            <FileEdit className="w-12 h-12 mb-3 opacity-30 text-sky-400" />
            <h3 className="text-sm font-semibold text-zinc-300 mb-1">Select or Create a Manuscript</h3>
            <p className="text-xs text-zinc-500 max-w-sm mb-4">
              Draft academic synthesis notes in rich markdown or full Overleaf-grade LaTeX with live KaTeX preview.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleCreateNew('rich')}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition"
              >
                + New Rich Note
              </button>
              <button
                type="button"
                onClick={() => handleCreateNew('latex')}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium transition"
              >
                + New LaTeX Paper
              </button>
            </div>
          </div>
        )}
      </main>

      {/* 3. Citation Picker Modal */}
      <CitationPickerModal
        isOpen={isCitationPickerOpen}
        onClose={() => setIsCitationPickerOpen(false)}
        onInsertCitation={handleInsertCitation}
        papers={papers}
        candidatePapers={candidatePapers}
        mode={activeManuscript?.mode || 'rich'}
      />
    </div>
  );
};
