import React, { useState, useMemo } from 'react';
import {
  X,
  Search,
  BookOpen,
  Layers,
  Quote,
  Copy,
  Check,
  Download,
  ExternalLink,
  Plus,
  FileText,
  Archive,
  Loader2,
  CheckSquare,
  Square
} from 'lucide-react';
import { ReviewPaper, RawPaperMetadata } from '../types';
import { TagBadge } from './TagBadge';
import { vaultSinglePaper, batchVaultPapers, getVaultDownloadUrl, bulkDownloadPapers } from '../services/api';
import { VaultPaperItem } from '../types';

interface SourcesSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  synthesizedPapers: ReviewPaper[];
  candidatePool: RawPaperMetadata[];
  onSelectPaper: (paper: ReviewPaper | RawPaperMetadata) => void;
  onSearchMore: (query: string) => void;
  onBulkDownload?: (papers: (ReviewPaper | RawPaperMetadata)[]) => Promise<void> | void;
  activeCitationIndex?: number | null;
  onOpenPdf?: (vaultId: string, title: string) => void;
}

export const SourcesSidebar: React.FC<SourcesSidebarProps> = ({
  isOpen,
  onClose,
  synthesizedPapers,
  candidatePool,
  onSelectPaper,
  onSearchMore,
  onBulkDownload,
  activeCitationIndex,
  onOpenPdf
}) => {
  const [activeTab, setActiveTab] = useState<'sources' | 'pool' | 'references'>('sources');
  const [searchFilter, setSearchFilter] = useState('');
  const [miniQuery, setMiniQuery] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<'bibtex' | 'apa' | 'mla' | 'ris'>('bibtex');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isBulkDownloading, setIsBulkDownloading] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // In-app batch downloading & vaulted mapping state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [vaultedMap, setVaultedMap] = useState<Record<string, string>>({});
  const [isBatchDownloading, setIsBatchDownloading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filter synthesized papers
  const filteredSources = useMemo(() => {
    if (!searchFilter.trim()) return synthesizedPapers;
    const q = searchFilter.toLowerCase();
    return synthesizedPapers.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.authors && p.authors.some((a) => a.toLowerCase().includes(q))) ||
        (p.venue && p.venue.toLowerCase().includes(q)) ||
        (p.year && p.year.toString().includes(q))
    );
  }, [synthesizedPapers, searchFilter]);

  // Filter candidate pool
  const filteredPool = useMemo(() => {
    if (!searchFilter.trim()) return candidatePool;
    const q = searchFilter.toLowerCase();
    return candidatePool.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.authors && p.authors.some((a) => a.toLowerCase().includes(q))) ||
        (p.venue && p.venue.toLowerCase().includes(q))
    );
  }, [candidatePool, searchFilter]);

  const currentList = activeTab === 'sources' ? filteredSources : filteredPool;
  const isAllCurrentSelected = currentList.length > 0 && currentList.every((p) => selectedIds.has(p.id));

  const toggleSelectAllCurrent = () => {
    if (isAllCurrentSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        currentList.forEach((p) => next.delete(p.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        currentList.forEach((p) => next.add(p.id));
        return next;
      });
    }
  };

  // Single download: archives in vault AND triggers direct browser download to user's device
  const handleDownloadSingle = async (e: React.MouseEvent, p: ReviewPaper | RawPaperMetadata) => {
    e.stopPropagation();
    setDownloadingId(p.id);
    try {
      const res = await vaultSinglePaper(p);
      if (res.vault_id) {
        setVaultedMap((prev) => ({ ...prev, [p.id]: res.vault_id }));
        // Trigger browser file download
        const downloadUrl = getVaultDownloadUrl(res.vault_id);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', `${p.title.slice(0, 50)}.pdf`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        showToast(`Downloading "${p.title.slice(0, 30)}..." to your device`);
      }
    } catch (err: any) {
      // Graceful fallback: If publisher paywalled/blocked, open direct publisher or OA landing
      const fallbackUrl = (p as any).doi_link || ((p as any).doi ? `https://doi.org/${(p as any).doi}` : (p as any).pdf_url);
      if (fallbackUrl) {
        window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
        showToast('Direct PDF restricted. Opening external publication source...');
      } else {
        showToast(err.message || 'Direct PDF restricted by publisher.');
      }
    } finally {
      setDownloadingId(null);
    }
  };

  // Direct download for already vaulted paper
  const handleDownloadVaulted = (e: React.MouseEvent, vaultId: string, title: string) => {
    e.stopPropagation();
    const downloadUrl = getVaultDownloadUrl(vaultId);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.setAttribute('download', `${title.slice(0, 50)}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast(`Downloading "${title.slice(0, 30)}..."`);
  };

  // Bulk download selected: bundles into ZIP and downloads to user's device
  const handleBatchDownloadSelected = async () => {
    const papersToDownload = [...synthesizedPapers, ...candidatePool].filter((p) => selectedIds.has(p.id));
    if (papersToDownload.length === 0) return;

    setIsBatchDownloading(true);
    try {
      if (onBulkDownload) {
        await onBulkDownload(papersToDownload);
      } else {
        const items: VaultPaperItem[] = papersToDownload.map((p) => ({
          id: p.id,
          title: p.title,
          doi: (p as any).doi || ((p as any).doi_link ? (p as any).doi_link.replace(/^https?:\/\/doi\.org\//, '') : undefined),
          pdf_url: (p as any).pdf_url,
          source: (p as any).source,
          authors: p.authors,
          year: p.year,
          venue: (p as any).venue,
        }));
        await bulkDownloadPapers(items);
      }
      showToast(`ZIP package downloaded with ${papersToDownload.length} papers`);
    } catch (err: any) {
      showToast(err.message || 'Bulk ZIP download failed.');
    } finally {
      setIsBatchDownloading(false);
    }
  };

  const handleMiniSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (miniQuery.trim()) {
      onSearchMore(miniQuery.trim());
      setMiniQuery('');
    }
  };

  // Helper generators for Reference Manager
  const getPaperDoi = (p: ReviewPaper | RawPaperMetadata): string => {
    return (p as RawPaperMetadata).doi || ((p as ReviewPaper).doi_link ? (p as ReviewPaper).doi_link.replace(/^https?:\/\/doi\.org\//, '') : '');
  };

  const generateBibTeX = (p: ReviewPaper | RawPaperMetadata, index: number) => {
    const firstAuthor = (p.authors && p.authors[0] ? p.authors[0].split(' ').pop()?.toLowerCase() : 'author') || 'author';
    const year = p.year || 2024;
    const key = `${firstAuthor}${year}_${index + 1}`;
    const authorsStr = (p.authors || []).join(' and ') || 'Unknown Author';
    const doi = getPaperDoi(p);
    const doiPart = doi ? `,\n  doi = {${doi}}` : '';
    const journal = (p as any).venue ? `,\n  journal = {${(p as any).venue}}` : '';

    return `@article{${key},
  title = {${p.title}},
  author = {${authorsStr}},
  year = {${year}}${journal}${doiPart}
}`;
  };

  const generateAPA = (p: ReviewPaper | RawPaperMetadata) => {
    const authorStr = p.authors && p.authors.length > 0 ? p.authors.join(', ') : 'Unknown Author';
    const yearStr = p.year ? `(${p.year})` : '(n.d.)';
    const venueStr = (p as any).venue ? ` *${(p as any).venue}*.` : '';
    const doi = getPaperDoi(p);
    const doiStr = doi ? ` https://doi.org/${doi}` : '';
    return `${authorStr} ${yearStr}. ${p.title}.${venueStr}${doiStr}`;
  };

  const generateMLA = (p: ReviewPaper | RawPaperMetadata) => {
    const lead = p.authors && p.authors[0] ? p.authors[0] : 'Unknown';
    const venue = (p as any).venue ? ` *${(p as any).venue}*,` : '';
    const year = p.year ? ` ${p.year}.` : '';
    return `${lead}, et al. "${p.title}."${venue}${year}`;
  };

  const generateRIS = (p: ReviewPaper | RawPaperMetadata) => {
    const authors = (p.authors || []).map((a) => `AU  - ${a}`).join('\n');
    const doi = getPaperDoi(p);
    return `TY  - JOUR\nTI  - ${p.title}\n${authors}\nPY  - ${p.year || ''}\nJO  - ${(p as any).venue || ''}\nDO  - ${doi || ''}\nER  - `;
  };

  const formatCitation = (p: ReviewPaper | RawPaperMetadata, index: number) => {
    switch (selectedFormat) {
      case 'bibtex':
        return generateBibTeX(p, index);
      case 'apa':
        return generateAPA(p);
      case 'mla':
        return generateMLA(p);
      case 'ris':
        return generateRIS(p);
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const downloadAllBibTeX = () => {
    const papersToExport = synthesizedPapers.length > 0 ? synthesizedPapers : candidatePool;
    const bibtexAll = papersToExport.map((p, idx) => generateBibTeX(p, idx)).join('\n\n');
    const blob = new Blob([bibtexAll], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `litbuddy_references_${Date.now()}.bib`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <aside className="fixed top-14 right-0 w-80 md:w-96 flex-shrink-0 h-[calc(100vh-3.5rem)] bg-[#1e1f20] border-l border-[#3c4043] flex flex-col z-30 transition-all duration-300 shadow-2xl">
      {/* Sidebar Header */}
      <div className="p-3.5 border-b border-[#3c4043] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-zinc-300" />
          <h2 className="text-xs font-semibold text-zinc-200 uppercase tracking-wider">
            Literature Sources
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-[#9aa0a6] hover:text-[#e3e3e3] hover:bg-[#282a2c] transition-colors"
          title="Close Sources"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Mini Searcher (Append more literature) */}
      <div className="p-3 border-b border-[#3c4043]/60 bg-[#171718]">
        <form onSubmit={handleMiniSearch} className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-[#9aa0a6] absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={miniQuery}
              onChange={(e) => setMiniQuery(e.target.value)}
              placeholder="Search & append papers..."
              className="w-full pl-8 pr-2.5 py-1.5 bg-[#282a2c] border border-[#3c4043] rounded-lg text-xs text-[#e3e3e3] placeholder-[#9aa0a6] focus:outline-none focus:border-[#8ab4f8]"
            />
          </div>
          <button
            type="submit"
            className="p-1.5 rounded-lg bg-[#8ab4f8] text-[#131314] hover:bg-[#8ab4f8]/90 transition-colors"
            title="Search & add to pool"
          >
            <Plus className="w-4 h-4" />
          </button>
        </form>
      </div>

      {/* 3-Way Tabs */}
      <div className="flex border-b border-[#3c4043] text-xs font-medium bg-[#1e1f20]">
        <button
          type="button"
          onClick={() => setActiveTab('sources')}
          className={`flex-1 py-2.5 text-center flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'sources'
              ? 'border-[#8ab4f8] text-[#8ab4f8]'
              : 'border-transparent text-[#9aa0a6] hover:text-[#e3e3e3]'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Sources ({synthesizedPapers.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('pool')}
          className={`flex-1 py-2.5 text-center flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'pool'
              ? 'border-[#8ab4f8] text-[#8ab4f8]'
              : 'border-transparent text-[#9aa0a6] hover:text-[#e3e3e3]'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Pool ({candidatePool.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('references')}
          className={`flex-1 py-2.5 text-center flex items-center justify-center gap-1.5 border-b-2 transition-colors ${
            activeTab === 'references'
              ? 'border-[#8ab4f8] text-[#8ab4f8]'
              : 'border-transparent text-[#9aa0a6] hover:text-[#e3e3e3]'
          }`}
        >
          <Quote className="w-3.5 h-3.5" />
          <span>Citations</span>
        </button>
      </div>

      {/* Filter / Search within collection */}
      {activeTab !== 'references' && (
        <div className="p-2 border-b border-[#3c4043]/40 space-y-2">
          <input
            type="text"
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            placeholder="Filter list by title, author, year..."
            className="w-full px-2.5 py-1 bg-[#171718] border border-[#3c4043] rounded-md text-[11px] text-[#e3e3e3] placeholder-[#9aa0a6] focus:outline-none focus:border-[#8ab4f8]"
          />

          {/* Selection & Batch Action Toolbar */}
          {currentList.length > 0 && (
            <div className="flex items-center justify-between gap-1.5 pt-1 text-[11px]">
              <button
                type="button"
                onClick={toggleSelectAllCurrent}
                className="inline-flex items-center gap-1 text-[#9aa0a6] hover:text-[#e3e3e3] transition-colors"
              >
                {isAllCurrentSelected ? (
                  <CheckSquare className="w-3.5 h-3.5 text-[#8ab4f8]" />
                ) : (
                  <Square className="w-3.5 h-3.5 text-[#5f6368]" />
                )}
                <span>Select All ({currentList.length})</span>
              </button>

              {selectedIds.size > 0 && (
                <button
                  type="button"
                  onClick={handleBatchDownloadSelected}
                  disabled={isBatchDownloading}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#8ab4f8] text-[#131314] font-medium hover:bg-[#8ab4f8]/90 transition-colors disabled:opacity-50"
                  title="Download selected papers as ZIP archive to your device"
                >
                  {isBatchDownloading ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <Download className="w-3 h-3" />
                  )}
                  <span>Download ZIP ({selectedIds.size})</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* In-app Toast Banner */}
      {toastMessage && (
        <div className="mx-3 mt-2 px-3 py-1.5 rounded-lg bg-[#81c995]/20 border border-[#81c995]/40 text-[#81c995] text-[11px] flex items-center gap-1.5 animate-fadeIn">
          <Check className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">{toastMessage}</span>
        </div>
      )}

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {/* TAB 1: Synthesized Sources */}
        {activeTab === 'sources' && (
          <>
            {filteredSources.length === 0 ? (
              <div className="text-center py-10 px-4 text-[#9aa0a6] text-xs">
                <FileText className="w-8 h-8 mx-auto mb-2 text-[#5f6368]" />
                <p>No synthesized sources in current session.</p>
                <p className="text-[11px] mt-1 text-[#5f6368]">
                  Run literature synthesis to populate grounded references.
                </p>
              </div>
            ) : (
              filteredSources.map((paper, idx) => {
                const isHighlighted = activeCitationIndex === idx + 1;
                const isSelected = selectedIds.has(paper.id);
                const vaultId = vaultedMap[paper.id];

                return (
                  <div
                    key={paper.id || idx}
                    onClick={() => onSelectPaper(paper)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isHighlighted
                        ? 'bg-[#8ab4f8]/10 border-[#8ab4f8] shadow-md ring-1 ring-[#8ab4f8]'
                        : isSelected
                        ? 'bg-[#8ab4f8]/5 border-[#8ab4f8]/50'
                        : 'bg-[#282a2c]/60 border-[#3c4043] hover:border-[#5f6368] hover:bg-[#282a2c]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(paper.id);
                          }}
                          className="p-0.5 text-[#9aa0a6] hover:text-[#8ab4f8] transition-colors"
                          title={isSelected ? 'Deselect' : 'Select for download'}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-3.5 h-3.5 text-[#8ab4f8]" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-[#5f6368]" />
                          )}
                        </button>
                        <span className="px-1.5 py-0.5 rounded-md bg-[#8ab4f8]/20 text-[#8ab4f8] text-[10px] font-mono font-bold">
                          [{idx + 1}]
                        </span>
                      </div>
                      <span className="px-1.5 py-0.5 rounded-full bg-[#81c995]/20 text-[#81c995] text-[10px] font-semibold">
                        Score {paper.relevance_score}/5
                      </span>
                    </div>

                    <h4 className="text-xs font-semibold text-[#e3e3e3] line-clamp-2 mb-1">
                      {paper.title}
                    </h4>

                    <div className="text-[11px] text-[#9aa0a6] line-clamp-1 mb-2">
                      {paper.authors && paper.authors.length > 0 ? paper.authors.slice(0, 3).join(', ') : 'Unknown'}
                      {paper.year ? ` • ${paper.year}` : ''}
                      {paper.venue ? ` • ${paper.venue}` : ''}
                    </div>

                    <p className="text-[11px] text-[#c4c7c5] line-clamp-2 mb-2 italic">
                      "{paper.core_problem || paper.key_findings}"
                    </p>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <TagBadge type={paper.source || 'openalex'} />
                      {paper.doi_link && (
                        <a
                          href={paper.doi_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[10px] text-[#8ab4f8] hover:underline"
                        >
                          DOI <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}

                      <div className="ml-auto flex items-center gap-1">
                        {vaultId ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenPdf?.(vaultId, paper.title);
                              }}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#8ab4f8]/20 text-[#8ab4f8] text-[10px] font-semibold hover:bg-[#8ab4f8]/30 transition-colors"
                              title="Read vaulted PDF inside app"
                            >
                              <BookOpen className="w-3 h-3" />
                              <span>Read</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDownloadVaulted(e, vaultId, paper.title)}
                              className="p-1 rounded text-[#9aa0a6] hover:text-[#8ab4f8] hover:bg-[#3c4043] transition-colors"
                              title="Download PDF to computer"
                            >
                              <Download className="w-3 h-3" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleDownloadSingle(e, paper)}
                            disabled={downloadingId === paper.id}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#282a2c] text-[10px] text-[#8ab4f8] hover:bg-[#3c4043] border border-[#3c4043] disabled:opacity-40 transition-colors"
                            title="Download PDF to your computer"
                          >
                            {downloadingId === paper.id ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            ) : (
                              <Download className="w-2.5 h-2.5" />
                            )}
                            <span>Download PDF</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </>
        )}

        {/* TAB 2: Candidate Pool */}
        {activeTab === 'pool' && (
          <>
            {filteredPool.length === 0 ? (
              <div className="text-center py-10 px-4 text-[#9aa0a6] text-xs">
                <Layers className="w-8 h-8 mx-auto mb-2 text-[#5f6368]" />
                <p>Candidate pool is empty.</p>
                <p className="text-[11px] mt-1 text-[#5f6368]">
                  Search a topic to fetch candidate literature across engines.
                </p>
              </div>
            ) : (
              filteredPool.map((p, idx) => {
                const isSelected = selectedIds.has(p.id);
                const vaultId = vaultedMap[p.id];

                return (
                  <div
                    key={p.id || idx}
                    onClick={() => onSelectPaper(p)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#8ab4f8]/5 border-[#8ab4f8]/50'
                        : 'bg-[#282a2c]/40 border-[#3c4043] hover:border-[#5f6368] hover:bg-[#282a2c]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(p.id);
                          }}
                          className="p-0.5 text-[#9aa0a6] hover:text-[#8ab4f8] transition-colors"
                          title={isSelected ? 'Deselect' : 'Select for download'}
                        >
                          {isSelected ? (
                            <CheckSquare className="w-3.5 h-3.5 text-[#8ab4f8]" />
                          ) : (
                            <Square className="w-3.5 h-3.5 text-[#5f6368]" />
                          )}
                        </button>
                        <span className="text-[10px] font-mono text-[#9aa0a6]">#{idx + 1}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TagBadge type={p.source} />
                        {p.is_oa && <TagBadge type="oa_pdf" />}
                        {vaultId ? (
                          <div className="flex items-center gap-1 ml-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenPdf?.(vaultId, p.title);
                              }}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#8ab4f8]/20 text-[#8ab4f8] text-[10px] font-medium hover:bg-[#8ab4f8]/30 transition-colors"
                              title="Read in App"
                            >
                              <BookOpen className="w-2.5 h-2.5" />
                              <span>Read</span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDownloadVaulted(e, vaultId, p.title)}
                              className="p-1 rounded text-[#9aa0a6] hover:text-[#8ab4f8] hover:bg-[#3c4043] transition-colors"
                              title="Download PDF to computer"
                            >
                              <Download className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => handleDownloadSingle(e, p)}
                            disabled={downloadingId === p.id}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#282a2c] text-[10px] text-[#8ab4f8] hover:bg-[#3c4043] border border-[#3c4043] ml-1 disabled:opacity-40 transition-colors"
                            title="Download PDF to computer"
                          >
                            {downloadingId === p.id ? (
                              <Loader2 className="w-2.5 h-2.5 animate-spin" />
                            ) : (
                              <Download className="w-2.5 h-2.5" />
                            )}
                            <span>Download PDF</span>
                          </button>
                        )}
                      </div>
                    </div>
                    <h4 className="text-xs font-medium text-[#e3e3e3] line-clamp-2 mb-1">
                      {p.title}
                    </h4>
                    <div className="text-[11px] text-[#9aa0a6] line-clamp-1 mb-1.5">
                      {p.authors && p.authors.length > 0 ? p.authors[0] : 'Unknown'}
                      {p.year ? ` • ${p.year}` : ''}
                      {p.venue ? ` • ${p.venue}` : ''}
                    </div>
                    <p className="text-[10px] text-[#9aa0a6] line-clamp-2">
                      {p.abstract || 'No abstract preview available.'}
                    </p>
                  </div>
                );
              })
            )}
          </>
        )}

        {/* TAB 3: Reference Manager */}
        {activeTab === 'references' && (
          <div className="space-y-3">
            {/* Format Selector Bar */}
            <div className="flex items-center justify-between gap-1 p-1 bg-[#171718] rounded-lg border border-[#3c4043]">
              {(['bibtex', 'apa', 'mla', 'ris'] as const).map((fmt) => (
                <button
                  key={fmt}
                  type="button"
                  onClick={() => setSelectedFormat(fmt)}
                  className={`flex-1 py-1 rounded text-[10px] font-mono uppercase tracking-wider transition-colors ${
                    selectedFormat === fmt
                      ? 'bg-[#8ab4f8] text-[#131314] font-semibold'
                      : 'text-[#9aa0a6] hover:text-[#e3e3e3]'
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>

            {/* Global Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={downloadAllBibTeX}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#282a2c] border border-[#3c4043] text-xs text-[#e3e3e3] hover:bg-[#3c4043] transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-[#8ab4f8]" />
                <span>Export .bib</span>
              </button>

              {onBulkDownload && (
                <button
                  type="button"
                  onClick={async () => {
                    const papersToExport = synthesizedPapers.length > 0 ? synthesizedPapers : candidatePool;
                    if (papersToExport.length === 0) return;
                    setIsBulkDownloading(true);
                    try {
                      await onBulkDownload(papersToExport);
                    } finally {
                      setIsBulkDownloading(false);
                    }
                  }}
                  disabled={isBulkDownloading || (synthesizedPapers.length === 0 && candidatePool.length === 0)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-[#282a2c] border border-[#3c4043] text-xs text-[#8ab4f8] hover:bg-[#3c4043] disabled:opacity-40 transition-colors"
                  title="Download all papers as a ZIP archive bundled with BibTeX and manifest"
                >
                  {isBulkDownloading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#8ab4f8]" />
                      <span>Zipping...</span>
                    </>
                  ) : (
                    <>
                      <Archive className="w-3.5 h-3.5 text-[#8ab4f8]" />
                      <span>Download ZIP</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Citations List */}
            {synthesizedPapers.length === 0 && candidatePool.length === 0 ? (
              <div className="text-center py-10 px-4 text-[#9aa0a6] text-xs">
                <Quote className="w-8 h-8 mx-auto mb-2 text-[#5f6368]" />
                <p>No papers to generate citations for.</p>
              </div>
            ) : (
              (synthesizedPapers.length > 0 ? synthesizedPapers : candidatePool).map((p, idx) => {
                const formatted = formatCitation(p, idx);
                const isCopied = copiedKey === (p.id || String(idx));
                return (
                  <div
                    key={p.id || idx}
                    className="p-3 rounded-xl bg-[#282a2c]/60 border border-[#3c4043] relative group"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono text-[#8ab4f8] font-semibold">
                        Ref [{idx + 1}]
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(formatted, p.id || String(idx))}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#171718] border border-[#3c4043] text-[10px] text-[#e3e3e3] hover:border-[#8ab4f8] transition-colors"
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3 h-3 text-[#81c995]" />
                            <span className="text-[#81c995]">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3 text-[#9aa0a6]" />
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    <pre className="text-[10px] font-mono text-[#c4c7c5] whitespace-pre-wrap break-all bg-[#171718] p-2 rounded-lg border border-[#3c4043]/60 max-h-36 overflow-y-auto">
                      {formatted}
                    </pre>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </aside>
  );
};
