import React, { useState, useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  SortingState,
  createColumnHelper,
  flexRender,
} from '@tanstack/react-table';
import { ArrowUpDown, ExternalLink, Eye, Search, Download, Loader2 } from 'lucide-react';
import { ReviewPaper } from '../types';
import { TagBadge } from './TagBadge';
import { vaultSinglePaper } from '../services/api';
import { useNativeDialog } from '../context/NativeDialogContext';

interface LiteratureTableProps {
  papers: ReviewPaper[];
  onSelectPaper: (paper: ReviewPaper) => void;
}

const columnHelper = createColumnHelper<ReviewPaper>();

export const LiteratureTable: React.FC<LiteratureTableProps> = ({ papers, onSelectPaper }) => {
  const { showAlert } = useNativeDialog();
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'relevance_score', desc: true },
  ]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownloadPdf = async (e: React.MouseEvent, paper: ReviewPaper) => {
    e.stopPropagation();
    setDownloadingId(paper.id);
    try {
      const res = await vaultSinglePaper(paper);
      if (res.download_url) {
        window.open(res.download_url, '_blank');
      }
    } catch (err: any) {
      showAlert(err.message || 'Full-text retrieval failed.', 'Download Failed', 'warning');
    } finally {
      setDownloadingId(null);
    }
  };

  const columns = useMemo(
    () => [
      columnHelper.accessor('relevance_score', {
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 dark:text-[#c4c7c5] text-[#444746] hover:text-[#8ab4f8] font-medium"
          >
            <span>Score</span>
            <ArrowUpDown className="w-3 h-3 text-[#9aa0a6]" />
          </button>
        ),
        cell: (info) => {
          const score = info.getValue();
          return (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${
                score === 5
                  ? 'dark:bg-[#81c995]/15 text-[#81c995] border border-[#81c995]/30'
                  : score === 4
                  ? 'dark:bg-[#8ab4f8]/15 text-[#8ab4f8] border border-[#8ab4f8]/30'
                  : 'dark:bg-[#fdd663]/15 text-[#fdd663] border border-[#fdd663]/30'
              }`}
            >
              {score} / 5
            </span>
          );
        },
      }),

      columnHelper.accessor('title', {
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 dark:text-[#c4c7c5] text-[#444746] hover:text-[#8ab4f8] font-medium"
          >
            <span>Title & Database</span>
            <ArrowUpDown className="w-3 h-3 text-[#9aa0a6]" />
          </button>
        ),
        cell: (info) => {
          const paper = info.row.original;
          return (
            <div className="max-w-md py-1">
              <div className="flex items-center gap-1.5 mb-1">
                <TagBadge type={paper.source || 'openalex'} />
                {paper.pdf_downloaded ? (
                  <TagBadge type="oa_pdf" />
                ) : (
                  <TagBadge type="abstract_only" />
                )}
              </div>
              <button
                onClick={() => onSelectPaper(paper)}
                className="font-medium dark:text-[#e3e3e3] text-[#1f1f1f] hover:text-[#8ab4f8] text-left line-clamp-2 transition-colors cursor-pointer"
              >
                {paper.title}
              </button>
              <div className="flex items-center gap-2 text-xs dark:text-[#9aa0a6] text-[#5f6368] mt-1">
                <span className="truncate max-w-[240px]">
                  {paper.authors.length > 0 ? paper.authors.join(', ') : 'Authors not listed'}
                </span>
                {paper.venue && (
                  <>
                    <span>•</span>
                    <span className="truncate max-w-[120px] dark:text-[#c4c7c5] text-[#444746]">
                      {paper.venue}
                    </span>
                  </>
                )}
              </div>
            </div>
          );
        },
      }),

      columnHelper.accessor('year', {
        header: ({ column }) => (
          <button
            onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
            className="flex items-center gap-1 dark:text-[#c4c7c5] text-[#444746] hover:text-[#8ab4f8] font-medium"
          >
            <span>Year</span>
            <ArrowUpDown className="w-3 h-3 text-[#9aa0a6]" />
          </button>
        ),
        cell: (info) => (
          <span className="text-xs dark:text-[#9aa0a6] text-[#5f6368] font-mono">
            {info.getValue() || '—'}
          </span>
        ),
      }),

      columnHelper.accessor('core_problem', {
        header: 'Problem Formulation',
        cell: (info) => (
          <p className="text-xs dark:text-[#c4c7c5] text-[#444746] line-clamp-2 max-w-xs leading-relaxed">
            {info.getValue()}
          </p>
        ),
      }),

      columnHelper.accessor('methodology', {
        header: 'Methodology & Findings',
        cell: (info) => {
          const paper = info.row.original;
          return (
            <div className="max-w-xs text-xs space-y-1">
              <p className="dark:text-[#e3e3e3] text-[#1f1f1f] line-clamp-1">
                <strong className="dark:text-[#9aa0a6] text-[#5f6368] font-normal">Method: </strong>
                {paper.methodology}
              </p>
              <p className="dark:text-[#9aa0a6] text-[#5f6368] line-clamp-1">
                <strong className="font-normal">Findings: </strong>
                {paper.key_findings}
              </p>
            </div>
          );
        },
      }),

      columnHelper.display({
        id: 'actions',
        header: 'Review',
        cell: (info) => {
          const paper = info.row.original;
          return (
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => onSelectPaper(paper)}
                className="p-1.5 rounded-lg dark:text-[#9aa0a6] text-[#5f6368] hover:dark:text-white hover:text-black hover:dark:bg-[#282a2c] hover:bg-slate-100 transition-colors"
                title="Open structured literature synthesis"
              >
                <Eye className="w-4 h-4" />
              </button>
              <button
                onClick={(e) => handleDownloadPdf(e, paper)}
                disabled={downloadingId === paper.id}
                className="p-1.5 rounded-lg dark:text-[#9aa0a6] text-[#5f6368] hover:text-[#8ab4f8] hover:dark:bg-[#282a2c] hover:bg-slate-100 transition-colors disabled:opacity-40"
                title="Download full-text PDF to vault"
              >
                {downloadingId === paper.id ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#8ab4f8]" />
                ) : (
                  <Download className="w-4 h-4" />
                )}
              </button>
              {paper.doi_link && (
                <a
                  href={paper.doi_link}
                  target="_blank"
                  rel="noreferrer"
                  className="p-1.5 rounded-lg dark:text-[#9aa0a6] text-[#5f6368] hover:dark:text-white hover:text-black hover:dark:bg-[#282a2c] hover:bg-slate-100 transition-colors"
                  title="Open source DOI publication"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          );
        },
      }),
    ],
    [onSelectPaper]
  );

  const table = useReactTable({
    data: papers,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className="rounded-2xl dark:bg-[#1e1f20] bg-white border dark:border-[#3c4043] border-[#dadce0] shadow-md overflow-hidden transition-all">
      {/* Table Filter Header */}
      <div className="px-5 py-3.5 border-b dark:border-[#3c4043] border-[#dadce0] dark:bg-[#18191a] bg-[#f8fafd] flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-sm dark:text-[#e3e3e3] text-[#1f1f1f]">
            Synthesis Matrix
          </h3>
          <span className="text-[11px] px-2 py-0.5 rounded-full dark:bg-[#282a2c] bg-slate-100 dark:text-[#9aa0a6] text-[#5f6368] font-mono">
            {papers.length} synthesized papers
          </span>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-[#9aa0a6] pointer-events-none" />
          <input
            type="text"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Filter matrix entries..."
            className="w-full pl-8 pr-3 py-1.5 rounded-full dark:bg-[#131314] bg-white border dark:border-[#3c4043] border-slate-300 text-xs dark:text-[#e3e3e3] text-[#1f1f1f] placeholder-[#9aa0a6] focus:outline-none focus:border-[#8ab4f8]"
          />
        </div>
      </div>

      {/* Table Responsive Wrapper */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left border-collapse text-xs">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="dark:bg-[#18191a] bg-slate-50 border-b dark:border-[#2d2f31] border-slate-200 text-[11px] uppercase tracking-wider dark:text-[#9aa0a6] text-[#5f6368] font-medium">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-5 py-3">
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y dark:divide-[#282a2c] divide-slate-100">
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-6 py-12 text-center dark:text-[#9aa0a6] text-[#5f6368]">
                  No matching literature found in matrix.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:dark:bg-[#282a2c]/60 hover:bg-slate-50/80 transition-colors"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-5 py-3.5 align-top">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
