import React, { useState, useEffect, useRef } from 'react';
import {
  Bookmark,
  Search,
  Filter,
  Download,
  Copy,
  Check,
  FileText,
  ExternalLink,
  MessageSquare,
  Sparkles,
  Layers,
  Archive,
  RefreshCw,
  BookOpen,
  Quote,
  Info,
  UploadCloud,
  ShieldCheck,
  AlertCircle,
  ShieldAlert,
  FolderPlus
} from 'lucide-react';
import { api } from '../services/api';

interface ReferenceItem {
  id: string;
  citation_key?: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string;
  doi: string | null;
  doi_link: string;
  doi_verified?: boolean;
  pdf_url: string;
  pdf_downloaded: boolean;
  is_vaulted: boolean;
  vault_id: string | null;
  file_size_bytes: number;
  source: string;
  is_synthesized: boolean;
  relevance_score: number;
  core_problem: string;
  methodology: string;
  key_findings: string;
  research_gaps: string;
  abstract: string;
  has_figures: boolean;
  created_at: string | null;
}

interface MasterReferenceManagerProps {
  onOpenPdf: (vaultId: string, title: string) => void;
  onChatAboutPaper: (paper: any) => void;
  onCitePaper?: (paper: any) => void;
}

type CitationFormat = 'bibtex' | 'apa' | 'mla' | 'chicago' | 'ieee' | 'ris';

export const MasterReferenceManager: React.FC<MasterReferenceManagerProps> = ({
  onOpenPdf,
  onChatAboutPaper,
  onCitePaper
}) => {
  const [references, setReferences] = useState<ReferenceItem[]>([]);
  const [total, setTotal] = useState(0);
  const [vaultedCount, setVaultedCount] = useState(0);
  const [synthesizedCount, setSynthesizedCount] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [onlyVaulted, setOnlyVaulted] = useState(false);
  const [onlySynthesized, setOnlySynthesized] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<CitationFormat>('bibtex');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPaperIds, setSelectedPaperIds] = useState<Set<string>>(new Set());

  // Zotero / Better BibTeX Importer State
  const [isImporting, setIsImporting] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [verifyingDoiId, setVerifyingDoiId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Debounce search input by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchReferences = async () => {
    setIsLoading(true);
    try {
      const data = await api.getAllReferences({
        search: debouncedSearch.trim() || undefined,
        only_vaulted: onlyVaulted || undefined,
        only_synthesized: onlySynthesized || undefined
      });
      setReferences(data.items || []);
      setTotal(data.total || 0);
      setVaultedCount(data.vaulted_count || 0);
      setSynthesizedCount(data.synthesized_count || 0);
    } catch (e) {
      console.error('Failed to load references:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReferences();
  }, [debouncedSearch, onlyVaulted, onlySynthesized]);

  const handleFileUpload = async (file: File) => {
    const text = await file.text();
    const isJson = file.name.endsWith('.json') || file.name.endsWith('.csl-json');
    setIsImporting(true);
    try {
      const collectionName = file.name.replace(/\.[^/.]+$/, '');
      const res = await api.importReferences(isJson ? 'csl-json' : 'bibtex', text, collectionName);
      setImportNotice(`Imported ${res.imported_count} references (${res.duplicates_merged} duplicates merged) into local vault.`);
      fetchReferences();
      setTimeout(() => setImportNotice(null), 6000);
    } catch (e: any) {
      setImportNotice(`Import error: ${e.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleVerifyDoi = async (paperId: string, doi: string) => {
    setVerifyingDoiId(paperId);
    try {
      const res = await api.verifyReferenceDOI(doi);
      if (res.verified) {
        setReferences((prev) =>
          prev.map((p) => (p.id === paperId ? { ...p, doi_verified: true } : p))
        );
      } else {
        alert(`Crossref verification note: ${res.error || 'DOI not registered'}`);
      }
    } catch (e: any) {
      alert(`DOI verification failed: ${e.message}`);
    } finally {
      setVerifyingDoiId(null);
    }
  };

  const generateCitation = (p: ReferenceItem, format: CitationFormat): string => {
    const authorsAll = p.authors.join(', ') || 'Unknown Authors';
    const year = p.year || 'n.d.';
    const title = p.title || 'Untitled';
    const venue = p.venue ? ` ${p.venue}.` : '';
    const doiPart = p.doi ? ` https://doi.org/${p.doi}` : '';

    switch (format) {
      case 'apa':
        return `${authorsAll} (${year}). ${title}.${venue}${doiPart}`;
      case 'mla':
        return `${authorsAll}. "${title}."${venue ? ` ${venue},` : ''} ${year}.${doiPart}`;
      case 'chicago':
        return `${authorsAll}. "${title}."${venue ? ` ${venue}` : ''} (${year}).${doiPart}`;
      case 'ieee':
        return `${authorsAll}, "${title},"${venue ? ` in ${venue},` : ''} ${year}.${doiPart}`;
      case 'ris':
        return `TY  - JOUR\nTI  - ${title}\n${p.authors.map((a) => `AU  - ${a}`).join('\n')}\nPY  - ${year}///\n${p.venue ? `JO  - ${p.venue}\n` : ''}${p.doi ? `DO  - ${p.doi}\n` : ''}ER  - \n`;
      case 'bibtex':
      default: {
        const firstAuthor = p.authors.length > 0 ? (p.authors[0].split(' ').pop() || 'author').toLowerCase() : 'author';
        const key = p.citation_key || `${firstAuthor}${year}`;
        return `@article{${key},\n  title = {${title}},\n  author = {${p.authors.join(' and ') || 'Unknown'}},\n  year = {${year}}${p.venue ? `,\n  journal = {${p.venue}}` : ''}${p.doi ? `,\n  doi = {${p.doi}}` : ''}\n}`;
      }
    }
  };

  const handleCopyCitation = (paper: ReferenceItem) => {
    const text = generateCitation(paper, selectedFormat);
    navigator.clipboard.writeText(text);
    setCopiedId(paper.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleExportAll = async (format: 'bibtex' | 'ris') => {
    try {
      await api.exportReferences(format);
    } catch (e) {
      console.error('Export failed:', e);
    }
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDraggingFile(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
          handleFileUpload(e.dataTransfer.files[0]);
        }
      }}
      className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-8 py-6 flex flex-col space-y-6 overflow-y-auto animate-fade-in"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".bib,.bibtex,.json,.csl-json"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleFileUpload(e.target.files[0]);
          }
        }}
      />

      {/* Import Notice Banner */}
      {importNotice && (
        <div className="p-3.5 bg-emerald-950/40 border border-emerald-500/40 rounded-2xl flex items-center justify-between text-xs text-emerald-300">
          <span>{importNotice}</span>
          <button onClick={() => setImportNotice(null)} className="text-emerald-400 hover:text-white font-bold ml-2">✕</button>
        </div>
      )}

      {/* Drag & Drop Overlay */}
      {isDraggingFile && (
        <div className="p-8 border-2 border-dashed border-emerald-500 bg-emerald-950/20 rounded-3xl text-center flex flex-col items-center justify-center gap-2">
          <UploadCloud className="w-10 h-10 text-emerald-400 animate-bounce" />
          <h3 className="text-sm font-semibold text-emerald-300">Drop .bib or .csl-json here to import</h3>
          <p className="text-xs text-zinc-400">Automatic deduplication, key normalization, and AES-256 local vault ingestion.</p>
        </div>
      )}

      {/* Header & Stats Banner */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-zinc-900 text-zinc-200 rounded-2xl border border-zinc-800">
              <Bookmark className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-zinc-100">Master Reference Manager</h1>
              <p className="text-xs text-zinc-400">
                Encrypted local bibliographic repository &amp; multi-format citation generator
              </p>
            </div>
          </div>
        </div>

        {/* Counts & Import/Export Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-2xl text-center">
            <div className="text-lg font-bold text-zinc-100">{total}</div>
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Total References</div>
          </div>

          <div className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-2xl text-center">
            <div className="text-lg font-bold text-cyan-400">{vaultedCount}</div>
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Vaulted PDFs</div>
          </div>

          <div className="px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-2xl text-center">
            <div className="text-lg font-bold text-emerald-400">{synthesizedCount}</div>
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">Synthesized</div>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="px-3.5 py-2.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-2xl text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
            title="Import Zotero, Mendeley, or Better BibTeX collection"
          >
            <UploadCloud className={`w-4 h-4 text-emerald-400 ${isImporting ? 'animate-spin' : ''}`} />
            <span>{isImporting ? 'Importing...' : 'Import Zotero / .bib'}</span>
          </button>

          <div className="flex items-center gap-1.5 p-1 bg-zinc-900 border border-zinc-800 rounded-2xl">
            <button
              onClick={() => handleExportAll('bibtex')}
              className="px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 rounded-xl transition-colors"
              title="Download entire library as .bib file"
            >
              Export .BIB
            </button>
            <button
              onClick={() => handleExportAll('ris')}
              className="px-3 py-1.5 text-xs font-semibold text-zinc-200 hover:bg-zinc-800 rounded-xl transition-colors"
              title="Download entire library as .ris file"
            >
              Export .RIS
            </button>
          </div>
        </div>
      </div>

      {/* Toolbar: Search, Filters, Citation Style Switcher */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-zinc-950 border border-zinc-800 rounded-2xl p-4 shadow-md">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              placeholder="Filter references by title, author, key, or DOI..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
            />
          </div>

          <button
            onClick={() => setOnlyVaulted(!onlyVaulted)}
            className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              onlyVaulted
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Vaulted PDFs Only</span>
          </button>

          <button
            onClick={() => setOnlySynthesized(!onlySynthesized)}
            className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors flex items-center gap-1.5 ${
              onlySynthesized
                ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Synthesized Only</span>
          </button>
        </div>

        {/* Citation Format Switcher */}
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-xl p-1">
          {(['bibtex', 'apa', 'mla', 'chicago', 'ieee', 'ris'] as CitationFormat[]).map((fmt) => (
            <button
              key={fmt}
              onClick={() => setSelectedFormat(fmt)}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg uppercase tracking-wider transition-colors ${
                selectedFormat === fmt
                  ? 'bg-zinc-100 text-zinc-950 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {fmt}
            </button>
          ))}
        </div>
      </div>

      {/* References Paper Cards */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl">
        {isLoading ? (
          <div className="py-20 text-center space-y-3">
            <RefreshCw className="w-6 h-6 text-zinc-400 animate-spin mx-auto" />
            <p className="text-xs text-zinc-500">Loading reference repository...</p>
          </div>
        ) : references.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <BookOpen className="w-10 h-10 text-zinc-600 mx-auto" />
            <p className="text-sm font-medium text-zinc-200">No references found</p>
            <p className="text-xs text-zinc-500 max-w-sm mx-auto">
              Drag-and-drop a .bib / .csl-json file or run a literature search to pool citations.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-850">
            {references.map((paper, idx) => (
              <div
                key={paper.id || idx}
                className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-5 hover:bg-zinc-900/50 transition-colors"
              >
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono text-zinc-400 font-semibold">[{idx + 1}]</span>
                    {paper.citation_key && (
                      <span className="px-2 py-0.5 bg-zinc-900 text-emerald-400 border border-zinc-800 font-mono text-[10px] font-medium rounded-md">
                        {paper.citation_key}
                      </span>
                    )}
                    {paper.is_vaulted && (
                      <span className="px-2 py-0.5 bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 rounded-md text-[10px] font-medium">
                        Vaulted PDF
                      </span>
                    )}
                    {paper.is_synthesized && (
                      <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 rounded-md text-[10px] font-medium">
                        Synthesized
                      </span>
                    )}
                    {paper.year && (
                      <span className="text-xs text-zinc-400">{paper.year}</span>
                    )}
                    {paper.venue && (
                      <span className="text-xs text-zinc-500 truncate max-w-xs">• {paper.venue}</span>
                    )}
                  </div>

                  <h3 className="text-sm font-semibold text-zinc-100 leading-snug">
                    {paper.title}
                  </h3>

                  <p className="text-xs text-zinc-400 line-clamp-1">
                    {paper.authors.length > 0 ? paper.authors.join(', ') : 'Unknown Authors'}
                  </p>

                  {paper.core_problem ? (
                    <p className="text-xs text-zinc-300 line-clamp-2 pt-1 bg-zinc-900/60 p-2.5 rounded-xl border border-zinc-800/60">
                      <span className="text-zinc-200 font-medium">Core Problem: </span>
                      {paper.core_problem}
                    </p>
                  ) : paper.abstract ? (
                    <p className="text-xs text-zinc-400 line-clamp-2 pt-1">
                      {paper.abstract}
                    </p>
                  ) : null}

                  {paper.doi && (
                    <div className="pt-1 flex items-center gap-2">
                      <a
                        href={paper.doi_link || `https://doi.org/${paper.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] text-zinc-300 hover:text-white hover:underline font-mono"
                      >
                        <span>doi:{paper.doi}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>

                      {/* Crossref Validation Shield */}
                      {paper.doi_verified ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400 bg-emerald-950/30 border border-emerald-500/30 px-1.5 py-0.5 rounded-md">
                          <ShieldCheck className="w-3 h-3" />
                          <span>Crossref Verified</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleVerifyDoi(paper.id, paper.doi!)}
                          disabled={verifyingDoiId === paper.id}
                          className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-400 hover:text-amber-300 bg-amber-950/20 border border-amber-500/20 px-1.5 py-0.5 rounded-md transition cursor-pointer"
                          title="Verify DOI against Crossref registry"
                        >
                          <AlertCircle className={`w-3 h-3 ${verifyingDoiId === paper.id ? 'animate-spin' : ''}`} />
                          <span>{verifyingDoiId === paper.id ? 'Verifying...' : 'Verify on Crossref'}</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0 self-end md:self-start">
                  <button
                    onClick={() => handleCopyCitation(paper)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                    title={`Copy in ${selectedFormat.toUpperCase()} format`}
                  >
                    {copiedId === paper.id ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-emerald-400">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-zinc-400" />
                        <span>Copy {selectedFormat.toUpperCase()}</span>
                      </>
                    )}
                  </button>

                  {onCitePaper && (
                    <button
                      onClick={() => onCitePaper(paper)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                      title="Cite this reference directly in Writing Studio"
                    >
                      <Quote className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Cite in Studio</span>
                    </button>
                  )}

                  {paper.is_vaulted && paper.vault_id && (
                    <button
                      onClick={() => onOpenPdf(paper.vault_id!, paper.title)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                      title="Read PDF in-app viewer"
                    >
                      <FileText className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Read PDF</span>
                    </button>
                  )}

                  <button
                    onClick={() => onChatAboutPaper(paper)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-200 rounded-xl text-xs font-medium transition-colors cursor-pointer"
                    title="Jump to grounded chat focusing on this paper"
                  >
                    <MessageSquare className="w-3.5 h-3.5 text-zinc-400" />
                    <span>Ask AI</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
