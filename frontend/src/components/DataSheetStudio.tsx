import React, { useState } from 'react';
import {
  Table,
  Plus,
  Trash2,
  Download,
  Upload,
  FileSpreadsheet,
  Copy,
  Check,
  Code,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { useNativeDialog } from '../context/NativeDialogContext';

export interface DataRow {
  id: string;
  [key: string]: any;
}

// Helper to escape LaTeX special characters in table headers and data cells
export const escapeLatex = (val: any): string => {
  if (val === null || val === undefined) return '-';
  const str = String(val);
  if (!str.trim()) return '-';
  return str
    .replace(/\\/g, '\\textbackslash{}')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/&/g, '\\&')
    .replace(/#/g, '\\#')
    .replace(/\$/g, '\\$')
    .replace(/\^/g, '\\textasciicircum{}')
    .replace(/~/g, '\\textasciitilde{}');
};

export const DataSheetStudio: React.FC = () => {
  const { showAlert, showConfirm, showToast } = useNativeDialog();
  const [columns, setColumns] = useState<string[]>(['Model / Method', 'Dataset', 'Accuracy (%)', 'Latency (ms)', 'F1 Score']);
  const [rows, setRows] = useState<DataRow[]>([
    { id: '1', 'Model / Method': 'LitBuddy Fast Triage', 'Dataset': 'arXiv AI Survey', 'Accuracy (%)': '94.2', 'Latency (ms)': '14', 'F1 Score': '0.92' },
    { id: '2', 'Model / Method': 'Baseline Transformer', 'Dataset': 'arXiv AI Survey', 'Accuracy (%)': '88.7', 'Latency (ms)': '42', 'F1 Score': '0.86' },
    { id: '3', 'Model / Method': 'Ablation (No Vault)', 'Dataset': 'arXiv AI Survey', 'Accuracy (%)': '79.1', 'Latency (ms)': '11', 'F1 Score': '0.78' }
  ]);
  const [newColName, setNewColName] = useState('');
  const [copiedLatex, setCopiedLatex] = useState(false);

  // Add new column
  const handleAddColumn = () => {
    if (!newColName.trim()) return;
    const col = newColName.trim();
    if (!columns.includes(col)) {
      setColumns([...columns, col]);
      setRows(rows.map(r => ({ ...r, [col]: '' })));
    }
    setNewColName('');
  };

  // Add new empty row
  const handleAddRow = () => {
    const newRow: DataRow = { id: String(Date.now()) };
    columns.forEach(col => {
      newRow[col] = '';
    });
    setRows([...rows, newRow]);
  };

  // Update cell value
  const handleCellChange = (rowId: string, col: string, val: string) => {
    setRows(rows.map(r => r.id === rowId ? { ...r, [col]: val } : r));
  };

  // Delete row
  const handleDeleteRow = (rowId: string) => {
    setRows(rows.filter(r => r.id !== rowId));
  };

  // Delete column
  const handleDeleteColumn = async (colToDelete: string) => {
    if (columns.length <= 1) {
      showAlert('A data sheet must have at least one column.', 'Cannot Delete', 'warning');
      return;
    }
    const confirmed = await showConfirm(
      `Delete column "${colToDelete}" and all its recorded data values?`,
      'Delete Column'
    );
    if (!confirmed) return;

    setColumns((prev) => prev.filter((c) => c !== colToDelete));
    setRows((prev) =>
      prev.map((r) => {
        const next = { ...r };
        delete next[colToDelete];
        return next;
      })
    );
    showToast(`Column "${colToDelete}" deleted`, 'info');
  };

  // Export to Excel / CSV via SheetJS
  const handleExportExcel = () => {
    const dataToExport = rows.map(({ id, ...rest }) => rest);
    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'ResearchData');
    XLSX.writeFile(wb, 'LitBuddy_Research_Data.xlsx');
  };

  // Import from Excel / CSV
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<any>(ws);

        if (data.length > 0) {
          const newCols = Object.keys(data[0]);
          const newRows = data.map((d, idx) => ({ id: String(idx + 1), ...d }));
          setColumns(newCols);
          setRows(newRows);
        }
      } catch (err) {
        showAlert('Failed to parse spreadsheet file.', 'Import Error', 'error');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Generate publication-ready LaTeX Booktabs Table
  const generateLatexTable = () => {
    const colAlign = 'l ' + 'c '.repeat(Math.max(0, columns.length - 1));
    const headerRow = columns.map(c => `\\textbf{${escapeLatex(c)}}`).join(' & ');
    const bodyRows = rows.map(r => columns.map(c => escapeLatex(r[c])).join(' & ')).join(' \\\\\n');

    return `\\begin{table}[ht]
\\centering
\\caption{Experimental Benchmark Results and Empirical Comparison}
\\label{tab:empirical_benchmarks}
\\begin{tabular}{${colAlign.trim()}}
\\toprule
${headerRow} \\\\
\\midrule
${bodyRows} \\\\
\\bottomrule
\\end{tabular}
\\end{table}`;
  };

  const handleCopyLatexTable = () => {
    navigator.clipboard.writeText(generateLatexTable());
    setCopiedLatex(true);
    setTimeout(() => setCopiedLatex(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-[#07080a] text-zinc-200 overflow-hidden">
      {/* Top Action Bar */}
      <div className="h-14 px-6 border-b border-zinc-800/80 bg-zinc-950/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-xs font-semibold text-zinc-100">Research Data Sheets &amp; Experiment Tables</h2>
            <p className="text-[10px] text-zinc-400">Structured project datasets with instant LaTeX booktabs export</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Add Column Input */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-0.5">
            <input
              type="text"
              placeholder="New column name..."
              value={newColName}
              onChange={(e) => setNewColName(e.target.value)}
              className="bg-transparent px-2 py-1 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-hidden w-36"
            />
            <button
              type="button"
              onClick={handleAddColumn}
              className="p-1 hover:bg-zinc-800 rounded text-zinc-300 transition"
              title="Add Column"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={handleAddRow}
            className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Row</span>
          </button>

          {/* Import File */}
          <label className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span>Import .xlsx / .csv</span>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={handleImportFile} className="hidden" />
          </label>

          {/* Export Excel */}
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-2.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 rounded-lg text-xs font-medium flex items-center gap-1.5 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Excel</span>
          </button>

          {/* Copy LaTeX Table */}
          <button
            type="button"
            onClick={handleCopyLatexTable}
            className="px-3 py-1.5 bg-zinc-100 hover:bg-white text-zinc-950 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition shadow-md"
          >
            {copiedLatex ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Code className="w-3.5 h-3.5" />}
            <span>{copiedLatex ? 'Copied LaTeX Table!' : 'Copy LaTeX Table'}</span>
          </button>
        </div>
      </div>

      {/* Spreadsheet Table View */}
      <div className="flex-1 overflow-auto p-6">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 overflow-hidden shadow-2xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-zinc-900/90 border-b border-zinc-800 text-zinc-400 font-semibold">
                <th className="py-2.5 px-3 w-10 text-center font-mono">#</th>
                {columns.map((col, idx) => (
                  <th key={idx} className="py-2.5 px-3 border-r border-zinc-800/80 last:border-r-0 group/th">
                    <div className="flex items-center justify-between gap-1">
                      <span className="truncate">{col}</span>
                      <button
                        type="button"
                        onClick={() => handleDeleteColumn(col)}
                        className="opacity-0 group-hover/th:opacity-100 p-0.5 hover:bg-red-950/60 text-zinc-500 hover:text-red-400 rounded transition"
                        title={`Delete "${col}" column`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </th>
                ))}
                <th className="py-2.5 px-2 w-10 text-center"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => (
                <tr key={row.id} className="border-b border-zinc-800/60 hover:bg-zinc-900/40 transition-colors">
                  <td className="py-2 px-3 text-center font-mono text-zinc-500">{rowIdx + 1}</td>
                  {columns.map((col, colIdx) => (
                    <td key={colIdx} className="p-0 border-r border-zinc-800/60 last:border-r-0">
                      <input
                        type="text"
                        value={row[col] ?? ''}
                        onChange={(e) => handleCellChange(row.id, col, e.target.value)}
                        className="w-full bg-transparent px-3 py-2 text-zinc-200 focus:outline-hidden focus:bg-zinc-900/80"
                      />
                    </td>
                  ))}
                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(row.id)}
                      className="text-zinc-600 hover:text-red-400 transition"
                      title="Delete Row"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
