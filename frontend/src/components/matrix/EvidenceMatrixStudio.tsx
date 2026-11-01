import React, { useState, useEffect, useMemo } from 'react';
import {
  Table,
  Plus,
  Trash2,
  Download,
  RefreshCw,
  Edit2,
  ExternalLink,
  Check,
  AlertCircle,
  FileText,
  Search,
  Sparkles,
  HelpCircle,
  ShieldAlert
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { ReviewPaper, RawPaperMetadata, MatrixColumnDefinition, MatrixCellData } from '../../types';
import {
  fetchWorkspaceMatrix,
  createMatrixColumn,
  deleteMatrixColumn,
  extractMatrixCell,
  updateMatrixCellManually
} from '../../services/api';
import { useNativeDialog } from '../../context/NativeDialogContext';
import { useAuth } from '../../context/AuthContext';

interface EvidenceMatrixStudioProps {
  papers: ReviewPaper[];
  candidatePapers?: RawPaperMetadata[];
  onOpenPdfWithHighlight?: (paperId: string, title: string, page?: number, sentence?: string) => void;
}

export const EvidenceMatrixStudio: React.FC<EvidenceMatrixStudioProps> = ({
  papers = [],
  candidatePapers = [],
  onOpenPdfWithHighlight
}) => {
  const { showAlert, showConfirm, showToast } = useNativeDialog();
  const { activeProvider, activeModel, runtimeKeys } = useAuth();

  // Combine all available papers (synthesized + candidate pool + user-added manual rows)
  const [manualRows, setManualRows] = useState<Array<{ id: string; title: string; doi?: string; year?: number; authors?: string[] }>>([]);
  const [isAddRowModalOpen, setIsAddRowModalOpen] = useState(false);
  const [manualTitle, setManualTitle] = useState('');
  const [manualYear, setManualYear] = useState('');
  const [manualDoi, setManualDoi] = useState('');

  const allPapers = useMemo(() => {
    const list: Array<{ id: string; title: string; doi?: string; year?: number; authors?: string[] }> = [];
    const seen = new Set<string>();

    papers.forEach((p) => {
      const doi = p.doi_link ? p.doi_link.replace(/^https?:\/\/doi\.org\//, '') : undefined;
      const key = (doi || p.title).toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ id: p.id, title: p.title, doi, year: p.year, authors: p.authors });
      }
    });

    candidatePapers.forEach((p) => {
      const key = (p.doi || p.title).toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        list.push({ id: p.id, title: p.title, doi: p.doi, year: p.year, authors: p.authors });
      }
    });

    manualRows.forEach((p) => {
      const key = (p.doi || p.title).toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        list.push(p);
      }
    });

    return list;
  }, [papers, candidatePapers, manualRows]);

  // Matrix State
  const [columns, setColumns] = useState<MatrixColumnDefinition[]>([]);
  const [cells, setCells] = useState<Record<string, MatrixCellData>>({}); // key: `${paperId}_${columnId}`
  const [loading, setLoading] = useState(false);
  const [extractingCells, setExtractingCells] = useState<Set<string>>(new Set());

  // Modal State for New Column
  const [isColModalOpen, setIsColModalOpen] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColPrompt, setNewColPrompt] = useState('');
  const [newColType, setNewColType] = useState<'string' | 'integer' | 'float' | 'list'>('string');

  // Edit Cell Modal
  const [editingCell, setEditingCell] = useState<{
    key: string;
    cell: MatrixCellData | null;
    paperId: string;
    columnId: string;
    currentValue: string;
  } | null>(null);

  // Search Filter
  const [searchQuery, setSearchQuery] = useState('');

  // Pre-set Prompt Templates
  const PROMPT_TEMPLATES = [
    { label: 'Sample Size / Population', prompt: 'Extract the exact sample size as an integer and describe the participant or subject population.', type: 'string' },
    { label: 'Methodology / Architecture', prompt: 'Extract the specific algorithm, neural architecture, or experimental methodology employed.', type: 'string' },
    { label: 'Primary Dataset', prompt: 'Extract the primary benchmark, corpus, or experimental dataset used.', type: 'string' },
    { label: 'Key Performance Metric', prompt: 'Extract the primary quantitative evaluation metric and final score reported (e.g. F1, accuracy, thrust efficiency).', type: 'string' },
    { label: 'Reported Limitations', prompt: 'Extract the explicit limitations, threats to validity, or computational bottlenecks reported by the authors.', type: 'string' }
  ];

  // Load Matrix Data
  const loadMatrix = async () => {
    setLoading(true);
    try {
      const data = await fetchWorkspaceMatrix('default_workspace');
      setColumns(data.columns);
      const cellMap: Record<string, MatrixCellData> = {};
      data.cells.forEach((c) => {
        cellMap[`${c.paper_id}_${c.column_id}`] = c;
      });
      setCells(cellMap);
    } catch (e) {
      console.warn('Failed to load matrix:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMatrix();
  }, []);

  // Create Column Handler
  const handleCreateColumn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newColName.trim() || !newColPrompt.trim()) return;

    try {
      const created = await createMatrixColumn(newColName.trim(), newColPrompt.trim(), newColType);
      setColumns((prev) => [...prev, created]);
      setIsColModalOpen(false);
      setNewColName('');
      setNewColPrompt('');
      showToast(`Column "${created.column_name}" created`, 'success');
    } catch (err: any) {
      showAlert(err.message || 'Failed to create column', 'Error', 'error');
    }
  };

  // Add Manual Paper Row Handler
  const handleAddManualRow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualTitle.trim()) return;

    const newRow = {
      id: `manual_paper_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: manualTitle.trim(),
      year: manualYear ? parseInt(manualYear) : new Date().getFullYear(),
      doi: manualDoi.trim() || undefined,
      authors: ['Researcher (Manual)']
    };

    setManualRows((prev) => [newRow, ...prev]);
    setManualTitle('');
    setManualYear('');
    setManualDoi('');
    setIsAddRowModalOpen(false);
    showToast('Manual row added to matrix', 'success');
  };

  // Delete Column Handler
  const handleDeleteColumn = async (columnId: string) => {
    const confirmed = await showConfirm(
      'Delete this extraction column and its extracted data?',
      'Delete Column'
    );
    if (!confirmed) return;

    try {
      await deleteMatrixColumn(columnId);
      setColumns((prev) => prev.filter((c) => c.id !== columnId));
      setCells((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => {
          if (k.endsWith(`_${columnId}`)) delete next[k];
        });
        return next;
      });
      showToast('Column deleted', 'info');
    } catch (err: any) {
      showAlert(err.message || 'Failed to delete column', 'Error', 'error');
    }
  };

  // Single Cell Extraction
  const handleExtractCell = async (paper: { id: string; title: string; doi?: string }, col: MatrixColumnDefinition) => {
    const cellKey = `${paper.id}_${col.id}`;
    setExtractingCells((prev) => new Set(prev).add(cellKey));

    try {
      const cellData = await extractMatrixCell({
        paperId: paper.id,
        paperTitle: paper.title,
        paperDoi: paper.doi,
        columnId: col.id,
        columnName: col.column_name,
        prompt: col.prompt,
        dataType: col.data_type,
        modelProvider: activeProvider,
        modelName: activeModel,
        groqApiKey: runtimeKeys?.groq,
        geminiApiKey: runtimeKeys?.gemini
      });
      setCells((prev) => ({ ...prev, [cellKey]: cellData }));
      showToast(`Extracted value for "${col.column_name}"`, 'success');
    } catch (err: any) {
      showAlert(`Extraction failed for "${col.column_name}": ${err.message}`, 'Extraction Error', 'error');
    } finally {
      setExtractingCells((prev) => {
        const next = new Set(prev);
        next.delete(cellKey);
        return next;
      });
    }
  };

  // Batch Extract Column across all papers
  const handleExtractEntireColumn = async (col: MatrixColumnDefinition) => {
    if (allPapers.length === 0) return;
    const confirmed = await showConfirm(
      `Run automated extraction for column "${col.column_name}" across ${allPapers.length} papers?`,
      'Batch Column Extraction'
    );
    if (!confirmed) return;

    for (const paper of allPapers) {
      await handleExtractCell(paper, col);
    }
  };

  // Manual Cell Edit Save (Immediate In-Cell Override or Creation)
  const handleSaveCellEdit = async () => {
    if (!editingCell) return;
    const { cell, paperId, columnId, currentValue } = editingCell;

    try {
      const cellIdToUse = cell ? cell.id : 'new';
      const updated = await updateMatrixCellManually(cellIdToUse, {
        value: currentValue,
        paper_id: paperId,
        column_id: columnId,
        workspace_id: 'default_workspace',
        status: 'reported',
        confidence: 'high'
      });
      setCells((prev) => ({ ...prev, [editingCell.key]: updated }));
      setEditingCell(null);
      showToast('Cell updated manually', 'success');
    } catch (err: any) {
      showAlert(err.message || 'Failed to update cell', 'Error', 'error');
    }
  };

  // Export Matrix to Excel
  const handleExportExcel = () => {
    const dataRows = allPapers.map((p) => {
      const row: Record<string, string> = {
        'Paper Title': p.title,
        'Year': String(p.year || ''),
        'DOI': p.doi || ''
      };
      columns.forEach((c) => {
        const cellData = cells[`${p.id}_${c.id}`];
        row[c.column_name] = cellData ? cellData.value : 'Not extracted';
      });
      return row;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Evidence Matrix');
    XLSX.writeFile(workbook, `Evidence_Matrix_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // Export to LaTeX Tabular Syntax
  const handleExportLatex = () => {
    const colHeaders = ['Paper', ...columns.map((c) => c.column_name)];
    const colAlign = 'l' + 'p{4cm}'.repeat(columns.length);

    let tex = `\\begin{table*}[t]\n\\centering\n\\caption{Automated Evidence Extraction Matrix}\n\\begin{tabular}{${colAlign}}\n\\hline\n`;
    tex += colHeaders.map((h) => `\\textbf{${h}}`).join(' & ') + ' \\\\\n\\hline\n';

    allPapers.forEach((p) => {
      const rowValues = [
        p.title.replace(/[_$%&]/g, '\\$&').slice(0, 35) + '...'
      ];
      columns.forEach((c) => {
        const cellData = cells[`${p.id}_${c.id}`];
        const val = cellData ? cellData.value.replace(/[_$%&]/g, '\\$&') : '-';
        rowValues.push(val.slice(0, 50));
      });
      tex += rowValues.join(' & ') + ' \\\\\n';
    });

    tex += `\\hline\n\\end{tabular}\n\\end{table*}`;

    navigator.clipboard.writeText(tex);
    showToast('LaTeX table syntax copied to clipboard!', 'success');
  };

  const filteredPapers = useMemo(() => {
    if (!searchQuery.trim()) return allPapers;
    const q = searchQuery.toLowerCase();
    return allPapers.filter((p) => p.title.toLowerCase().includes(q) || (p.doi && p.doi.toLowerCase().includes(q)));
  }, [allPapers, searchQuery]);

  return (
    <div className="flex-1 flex flex-col h-full bg-[#07080a] text-zinc-200 overflow-hidden">
      {/* Top Action Toolbar */}
      <div className="px-6 py-3.5 bg-zinc-950/80 border-b border-zinc-800/80 flex items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700/80 flex items-center justify-center text-zinc-100">
            <Table className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-zinc-100 tracking-tight flex items-center gap-2">
              <span>Evidence Extraction Matrix</span>
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
                {allPapers.length} papers • {columns.length} custom columns
              </span>
            </h1>
            <p className="text-[11px] text-zinc-400">
              Structured multi-column data extraction with click-to-source bounding box verification
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search Papers Filter */}
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter papers in matrix..."
              className="w-full pl-8 pr-3 py-1 text-xs bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-zinc-600"
            />
          </div>

          <button
            type="button"
            onClick={() => setIsAddRowModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 text-zinc-100 text-xs font-semibold shadow-xs transition cursor-pointer"
            title="Add a custom paper or study row manually"
          >
            <Plus className="w-3.5 h-3.5 text-sky-400" />
            <span>Add Row</span>
          </button>

          <button
            type="button"
            onClick={() => setIsColModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold shadow-xs transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Column</span>
          </button>

          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200 transition cursor-pointer"
            title="Export matrix as .xlsx spreadsheet"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
            <span>Excel</span>
          </button>

          <button
            type="button"
            onClick={handleExportLatex}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-xs font-medium text-zinc-200 transition cursor-pointer"
            title="Copy LaTeX table syntax"
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>LaTeX Table</span>
          </button>
        </div>
      </div>

      {/* Main Matrix Table View */}
      <div className="flex-1 overflow-auto p-6">
        {columns.length === 0 ? (
          <div className="h-64 border border-dashed border-zinc-800 rounded-xl flex flex-col items-center justify-center text-center p-6 bg-zinc-950/40">
            <Table className="w-8 h-8 text-zinc-600 mb-2" />
            <h3 className="text-sm font-semibold text-zinc-200">No Custom Columns Defined Yet</h3>
            <p className="text-xs text-zinc-500 max-w-md mt-1 mb-4">
              Create your first dynamic extraction column (e.g. "Sample Size", "Methodology", "Benchmark Dataset") to start multi-paper evidence synthesis.
            </p>
            <button
              type="button"
              onClick={() => setIsColModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Define Column Prompt</span>
            </button>
          </div>
        ) : (
          <div className="border border-zinc-800 rounded-xl overflow-hidden bg-zinc-950/60 shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-zinc-900/90 border-b border-zinc-800 text-zinc-400 uppercase tracking-wider text-[10px] font-semibold">
                    <th className="py-3 px-4 min-w-[280px] sticky left-0 bg-zinc-900 z-10 border-r border-zinc-800/80">
                      Paper &amp; Source
                    </th>
                    {columns.map((col) => (
                      <th key={col.id} className="py-3 px-4 min-w-[260px] border-r border-zinc-800/80 last:border-r-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-zinc-200 font-bold" title={col.prompt}>
                            {col.column_name}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleExtractEntireColumn(col)}
                              className="p-1 hover:bg-zinc-800 rounded text-zinc-500 hover:text-emerald-400 transition"
                              title="Extract column across all papers"
                            >
                              <RefreshCw className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteColumn(col.id)}
                              className="p-1 hover:bg-red-950/50 rounded text-zinc-500 hover:text-red-400 transition"
                              title="Delete column"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                        <p className="text-[10px] font-normal text-zinc-500 line-clamp-1 lowercase font-mono">
                          {col.data_type} • {col.prompt}
                        </p>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {filteredPapers.map((paper) => (
                    <tr key={paper.id} className="hover:bg-zinc-900/40 transition-colors">
                      {/* Paper metadata column (Sticky Left) */}
                      <td className="py-3 px-4 sticky left-0 bg-zinc-950/95 z-10 border-r border-zinc-800/80">
                        <h4 className="font-medium text-zinc-200 leading-snug line-clamp-2" title={paper.title}>
                          {paper.title}
                        </h4>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-zinc-500 font-mono">
                          {paper.year && <span>{paper.year}</span>}
                          {paper.doi && (
                            <a
                              href={`https://doi.org/${paper.doi}`}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:text-zinc-300 hover:underline flex items-center gap-0.5"
                            >
                              <span>DOI</span>
                              <ExternalLink className="w-2.5 h-2.5 inline" />
                            </a>
                          )}
                        </div>
                      </td>

                      {/* Custom Extraction Columns */}
                      {columns.map((col) => {
                        const cellKey = `${paper.id}_${col.id}`;
                        const cellData = cells[cellKey];
                        const isExtracting = extractingCells.has(cellKey);

                        return (
                          <td
                            key={col.id}
                            className="py-3 px-4 border-r border-zinc-800/60 last:border-r-0 align-top relative group"
                          >
                            {isExtracting ? (
                              <div className="flex items-center gap-2 text-zinc-400 text-xs py-2">
                                <div className="w-3 h-3 border-2 border-zinc-500 border-t-zinc-200 rounded-full animate-spin" />
                                <span>Extracting...</span>
                              </div>
                            ) : cellData ? (
                              <div className="space-y-1.5">
                                {/* Value display */}
                                <div className="flex items-start justify-between gap-1">
                                  <p className="text-zinc-200 leading-relaxed font-sans select-text">
                                    {cellData.value}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setEditingCell({
                                        key: cellKey,
                                        cell: cellData,
                                        paperId: paper.id,
                                        columnId: col.id,
                                        currentValue: cellData.value
                                      })
                                    }
                                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 rounded transition"
                                    title="Edit value manually"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>
                                </div>

                                {/* Status, confidence and provenance pill */}
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {cellData.status === 'not_reported' ? (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-900 text-zinc-500 border border-zinc-800">
                                      Not reported
                                    </span>
                                  ) : (
                                    <span
                                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono ${
                                        cellData.confidence === 'high'
                                          ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-500/20'
                                          : 'bg-amber-950/40 text-amber-400 border border-amber-500/20'
                                      }`}
                                    >
                                      {cellData.confidence} confidence
                                    </span>
                                  )}

                                  {cellData.is_human_edited && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-950/40 text-amber-300 border border-amber-500/30">
                                      Edited
                                    </span>
                                  )}

                                  {/* Click-to-source link */}
                                  {cellData.source_page && onOpenPdfWithHighlight && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onOpenPdfWithHighlight(
                                          paper.id,
                                          paper.title,
                                          cellData.source_page || undefined,
                                          cellData.source_sentence || undefined
                                        )
                                      }
                                      className="inline-flex items-center gap-1 text-[10px] font-mono text-sky-400 hover:underline hover:text-sky-300 cursor-pointer"
                                      title={`View source sentence on page ${cellData.source_page}`}
                                    >
                                      <FileText className="w-2.5 h-2.5" />
                                      <span>Page {cellData.source_page}</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleExtractCell(paper, col)}
                                  className="flex-1 py-1.5 px-2 border border-dashed border-zinc-800 hover:border-zinc-600 rounded-lg text-zinc-500 hover:text-zinc-300 text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                                  title="Extract using AI and document search"
                                >
                                  <Sparkles className="w-3 h-3 text-zinc-500" />
                                  <span>AI Extract</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setEditingCell({
                                      key: cellKey,
                                      cell: null,
                                      paperId: paper.id,
                                      columnId: col.id,
                                      currentValue: ''
                                    })
                                  }
                                  className="py-1.5 px-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                                  title="Enter value manually without AI"
                                >
                                  <Edit2 className="w-3 h-3" />
                                  <span>Enter</span>
                                </button>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Define Column Modal */}
      {isColModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/40">
              <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-zinc-400" />
                <span>Define Extraction Column</span>
              </h2>
              <button
                type="button"
                onClick={() => setIsColModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300 p-1"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateColumn} className="p-5 space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-zinc-300">Column Label</label>
                <input
                  type="text"
                  required
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  placeholder="e.g. Sample Size, Benchmark Dataset, Architecture"
                  className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-zinc-600"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-medium text-zinc-300">Extraction Prompt Instruction</label>
                  <span className="text-[10px] text-zinc-500">Natural Language</span>
                </div>
                <textarea
                  required
                  rows={3}
                  value={newColPrompt}
                  onChange={(e) => setNewColPrompt(e.target.value)}
                  placeholder="e.g. Extract the primary benchmark evaluation dataset and metric reported in the experiments section."
                  className="w-full px-3 py-1.5 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-zinc-600 resize-none leading-relaxed"
                />
              </div>

              {/* Pre-set Templates */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-zinc-400 font-medium">Or Pick a Standard Template:</span>
                <div className="flex flex-wrap gap-1.5">
                  {PROMPT_TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setNewColName(tmpl.label);
                        setNewColPrompt(tmpl.prompt);
                        setNewColType(tmpl.type as any);
                      }}
                      className="px-2 py-1 rounded bg-zinc-950 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300 transition"
                    >
                      {tmpl.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800/80">
                <button
                  type="button"
                  onClick={() => setIsColModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-zinc-800 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold shadow-xs transition"
                >
                  Create Column
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manual Cell Edit Modal */}
      {editingCell && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden p-5 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-100">Manual Cell Value Override</h3>
            <textarea
              rows={4}
              value={editingCell.currentValue}
              onChange={(e) => setEditingCell({ ...editingCell, currentValue: e.target.value })}
              className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-zinc-600 resize-none leading-relaxed"
            />
            <p className="text-[11px] text-zinc-500 flex items-center gap-1">
              <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
              <span>This cell will be tagged with a permanent human-edited audit badge.</span>
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                className="px-3 py-1.5 rounded-lg border border-zinc-800 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCellEdit}
                className="px-4 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold shadow-xs"
              >
                Save Override
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Paper Row Modal */}
      {isAddRowModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Plus className="w-4 h-4 text-sky-400" />
                <span>Add Study or Paper to Matrix</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddRowModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-300"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddManualRow} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">
                  Paper or Study Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={manualTitle}
                  onChange={(e) => setManualTitle(e.target.value)}
                  placeholder="e.g. Hydrodynamic Analysis of Ventilated Supercavities"
                  className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-zinc-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">Year</label>
                  <input
                    type="number"
                    value={manualYear}
                    onChange={(e) => setManualYear(e.target.value)}
                    placeholder="2024"
                    className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-zinc-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-300 mb-1">DOI (Optional)</label>
                  <input
                    type="text"
                    value={manualDoi}
                    onChange={(e) => setManualDoi(e.target.value)}
                    placeholder="10.1016/..."
                    className="w-full px-3 py-2 text-xs bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-hidden focus:border-zinc-600"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddRowModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border border-zinc-800 text-xs font-medium text-zinc-300 hover:bg-zinc-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold shadow-xs"
                >
                  Add Row
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
