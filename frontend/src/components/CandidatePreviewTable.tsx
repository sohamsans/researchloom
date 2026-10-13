import React, { useState, useMemo } from 'react';
import { RawPaperMetadata } from '../types';
import { CheckSquare, Square, ExternalLink, Search, ChevronDown, ChevronUp, ArrowRight, Download, Filter, Info } from 'lucide-react';
import { TagBadge } from './TagBadge';

interface CandidatePreviewTableProps {
  papers: RawPaperMetadata[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onProceedToSynthesis: () => void;
  onBulkDownload?: (papers: RawPaperMetadata[]) => void;
  isProcessing: boolean;
  pooledQueries?: string[];
  onRemoveQuery?: (query: string) => void;
  onClearPool?: () => void;
}

export const CandidatePreviewTable: React.FC<CandidatePreviewTableProps> = ({
  papers,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onDeselectAll,
  onProceedToSynthesis,
  onBulkDownload,
  isProcessing,
  pooledQueries = [],
  onRemoveQuery,
  onClearPool,
}) => {
  const [filterText, setFilterText] = useState('');
  const [expandedAbstracts, setExpandedAbstracts] = useState<Set<string>>(new Set());
  const [isZipping, setIsZipping] = useState(false);

  const toggleAbstract = (id: string) => {
    setExpandedAbstracts((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredPapers = useMemo(() => {
    if (!filterText.trim()) return papers;
    const q = filterText.toLowerCase();
    return papers.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.authors.some((a) => a.toLowerCase().includes(q)) ||
        (p.venue && p.venue.toLowerCase().includes(q)) ||
        p.abstract.toLowerCase().includes(q)
    );
  }, [papers, filterText]);

  const allSelected = papers.length > 0 && selectedIds.size === papers.length;

  const handleDownloadZip = async () => {
    if (!onBulkDownload) return;
    const selectedList = papers.filter((p) => selectedIds.has(p.id));
    if (selectedList.length === 0) return;

    setIsZipping(true);
    try {
      await onBulkDownload(selectedList);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="w-full bg-zinc-900/40 border border-zinc-800 rounded-xl shadow-xs overflow-hidden mb-8 transition-all">
      {/* Multi-Query Candidate Pool Strip */}
      {pooledQueries.length > 0 && (
        <div className="px-5 py-2.5 bg-zinc-950/80 border-b border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-zinc-400 font-medium mr-1 text-[11px] uppercase tracking-wider">
              Pooled Queries ({pooledQueries.length}):
            </span>
            {pooledQueries.map((q, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-zinc-900 border border-zinc-700/80 text-sky-400 text-[11px] font-medium"
              >
                <span>"{q}"</span>
                {onRemoveQuery && (
                  <button
                    type="button"
                    onClick={() => onRemoveQuery(q)}
                    className="text-zinc-500 hover:text-zinc-200 ml-0.5"
                    title={`Remove "${q}" from pool`}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
          </div>

          {onClearPool && (
            <button
              type="button"
              onClick={onClearPool}
              className="text-[11px] text-zinc-500 hover:text-rose-400 transition cursor-pointer"
            >
              Reset Pool
            </button>
          )}
        </div>
      )}

      {/* Native Desktop Workbench Toolbar */}
      <div className="sticky top-0 z-10 px-5 py-3 bg-zinc-900/90 backdrop-blur-md border-b border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button
            type="button"
            onClick={allSelected ? onDeselectAll : onSelectAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 hover:bg-zinc-800 text-zinc-200 text-xs font-medium transition cursor-pointer"
          >
            {allSelected ? (
              <CheckSquare className="w-3.5 h-3.5 text-zinc-100" />
            ) : (
              <Square className="w-3.5 h-3.5 text-zinc-500" />
            )}
            <span>{allSelected ? 'Deselect All' : `Select All (${papers.length})`}</span>
          </button>

          <span className="text-xs text-zinc-400 font-mono">
            <strong className="text-zinc-200 font-semibold">{selectedIds.size}</strong> of {papers.length} selected
          </span>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto flex-wrap sm:flex-nowrap">
          {/* Quick Filter */}
          <div className="relative flex-1 sm:w-60">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Filter candidates..."
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-zinc-950 border border-zinc-800 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:border-zinc-700 focus:ring-1 focus:ring-zinc-700"
            />
          </div>

          {onBulkDownload && (
            <button
              type="button"
              onClick={handleDownloadZip}
              disabled={selectedIds.size === 0 || isZipping}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-xs font-medium text-zinc-200 disabled:opacity-40 transition shrink-0 cursor-pointer"
              title="Download all selected papers as a single .zip archive"
            >
              {isZipping ? (
                <>
                  <div className="w-3 h-3 border-2 border-zinc-400 border-t-zinc-100 rounded-full animate-spin" />
                  <span>Zipping...</span>
                </>
              ) : (
                <>
                  <Download className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Download ZIP ({selectedIds.size})</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onProceedToSynthesis}
            disabled={selectedIds.size === 0 || isProcessing}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-zinc-100 hover:bg-white disabled:opacity-40 text-zinc-950 text-xs font-semibold shadow-xs transition shrink-0 cursor-pointer"
          >
            {isProcessing ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-zinc-400 border-t-zinc-900 rounded-full animate-spin" />
                <span>Synthesizing...</span>
              </>
            ) : (
              <>
                <span>Synthesize Selected ({selectedIds.size})</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>

      {/* Polite Bulk Download & Academic Paywall Advisory */}
      <div className="px-5 py-2.5 bg-amber-500/5 border-b border-amber-500/15 flex items-start gap-2.5 text-[11px] text-zinc-400">
        <Info className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
        <span className="leading-relaxed">
          <strong className="text-zinc-300 font-medium">Notice on Full-Text Retrieval:</strong> While LitBuddy queries multiple open-access repositories (arXiv, Unpaywall, OpenAlex, IPFS, Project Gutenberg), commercial publishers frequently adjust paywalls and Cloudflare captchas. If a specific paper fails to download automatically, you can retrieve the PDF manually (via your university portal, Sci-Hub, or author preprints) and import it directly into the vault.
        </span>
      </div>

      {/* Unified Paper Items (Full-Bleed Desktop View, No Nested Scroll Container) */}
      <div className="divide-y divide-zinc-800/80">
        {filteredPapers.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-500">
            No papers match your filter criteria.
          </div>
        ) : (
          filteredPapers.map((paper, idx) => {
            const isSelected = selectedIds.has(paper.id);
            const isAbstractExpanded = expandedAbstracts.has(paper.id);

            return (
              <div
                key={paper.id}
                className={`p-4 sm:p-5 transition-colors flex items-start gap-4 ${
                  isSelected ? 'bg-zinc-800/30' : 'hover:bg-zinc-800/20'
                }`}
              >
                {/* Checkbox */}
                <button
                  type="button"
                  onClick={() => onToggleSelect(paper.id)}
                  className="mt-0.5 text-zinc-400 hover:text-zinc-200 cursor-pointer shrink-0"
                >
                  {isSelected ? (
                    <CheckSquare className="w-4 h-4 text-zinc-200" />
                  ) : (
                    <Square className="w-4 h-4 text-zinc-600" />
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono text-zinc-500">#{idx + 1}</span>
                    <TagBadge type={paper.source} />
                    {paper.is_oa && <TagBadge type="oa_pdf" />}
                    {paper.year && (
                      <span className="text-[11px] text-zinc-400 font-mono">
                        {paper.year}
                      </span>
                    )}
                  </div>

                  <h3 className="text-sm font-medium text-zinc-100 leading-snug hover:text-white transition-colors">
                    {paper.doi ? (
                      <a
                        href={`https://doi.org/${paper.doi}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 hover:underline"
                      >
                        <span>{paper.title}</span>
                        <ExternalLink className="w-3 h-3 text-zinc-500 shrink-0 inline" />
                      </a>
                    ) : (
                      paper.title
                    )}
                  </h3>

                  <p className="text-xs text-zinc-400 line-clamp-1">
                    {paper.authors.length > 0 ? paper.authors.join(', ') : 'Authors not specified'}
                    {paper.venue && ` • ${paper.venue}`}
                  </p>

                  {/* Abstract Accordion */}
                  {paper.abstract && (
                    <div className="mt-2 text-xs">
                      <p
                        className={`text-zinc-400 leading-relaxed ${
                          isAbstractExpanded ? '' : 'line-clamp-2'
                        }`}
                      >
                        {paper.abstract}
                      </p>
                      <button
                        type="button"
                        onClick={() => toggleAbstract(paper.id)}
                        className="mt-1 text-[11px] text-zinc-300 hover:text-white hover:underline font-medium inline-flex items-center gap-0.5 cursor-pointer"
                      >
                        {isAbstractExpanded ? (
                          <>
                            <span>Show less</span>
                            <ChevronUp className="w-3 h-3" />
                          </>
                        ) : (
                          <>
                            <span>Read abstract</span>
                            <ChevronDown className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
