import React, { useState } from 'react';
import { X, Globe, FileCode, CheckCircle, AlertCircle, Loader2, Sparkles } from 'lucide-react';
import { getApiBase, getAuthHeader } from '../services/api';

export interface WebClipperModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: (clipped: any) => void;
}

export const WebClipperModal: React.FC<WebClipperModalProps> = ({
  isOpen,
  onClose,
  onSave
}) => {
  const [activeTab, setActiveTab] = useState<'url' | 'paste'>('url');
  
  // Form fields
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [year, setYear] = useState('');
  const [doi, setDoi] = useState('');
  const [venue, setVenue] = useState('');
  const [abstract, setAbstract] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [tags, setTags] = useState('web-clipper');

  // Paste tab raw text
  const [rawPasteText, setRawPasteText] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState<{ type: 'info' | 'error' | 'success'; message: string } | null>(null);

  if (!isOpen) return null;

  const handleParseRawPaste = () => {
    if (!rawPasteText.trim()) return;
    const text = rawPasteText.trim();

    // Check if BibTeX
    if (text.startsWith('@')) {
      const getField = (field: string): string => {
        const m = text.match(new RegExp(`${field}\\s*=\\s*[{"]([^}"]+)[}"]`, 'i'));
        return m ? m[1].trim() : '';
      };
      const bibTitle = getField('title');
      const bibAuthor = getField('author');
      const bibYear = getField('year') || (text.match(/year\s*=\s*(\d{4})/i)?.[1] || '');
      const bibDoi = getField('doi');
      const bibJournal = getField('journal') || getField('booktitle');
      const bibAbstract = getField('abstract');

      if (bibTitle) setTitle(bibTitle);
      if (bibAuthor) setAuthors(bibAuthor.split(/\s+and\s+/i).join(', '));
      if (bibYear) setYear(bibYear);
      if (bibDoi) setDoi(bibDoi);
      if (bibJournal) setVenue(bibJournal);
      if (bibAbstract) setAbstract(bibAbstract);

      setBanner({ type: 'info', message: 'Parsed BibTeX metadata fields successfully.' });
    } else {
      // Basic heuristic HTML metadata parser (<meta name="citation_title" content="...">)
      const extractMeta = (name: string): string => {
        const regex = new RegExp(`<meta\\s+name=["'](?:citation_|dc\\.)?${name}["']\\s+content=["']([^"']+)["']`, 'i');
        const m = text.match(regex);
        return m ? m[1].trim() : '';
      };

      const htmlTitle = extractMeta('title');
      const htmlDoi = extractMeta('doi');
      const htmlDate = extractMeta('date') || extractMeta('publication_date');
      const htmlVenue = extractMeta('journal_title') || extractMeta('conference_title');
      const htmlPdf = extractMeta('pdf_url');

      if (htmlTitle) setTitle(htmlTitle);
      if (htmlDoi) setDoi(htmlDoi);
      if (htmlDate) {
        const yrMatch = htmlDate.match(/\d{4}/);
        if (yrMatch) setYear(yrMatch[0]);
      }
      if (htmlVenue) setVenue(htmlVenue);
      if (htmlPdf) setPdfUrl(htmlPdf);

      if (htmlTitle || htmlDoi) {
        setBanner({ type: 'info', message: 'Parsed HTML metadata tags into form fields.' });
      } else {
        // Fallback: If text doesn't contain tags, assume user pasted title or abstract
        if (!title) {
          const lines = text.split('\n').filter(l => l.trim().length > 0);
          if (lines.length > 0) setTitle(lines[0]);
          if (lines.length > 1) setAbstract(lines.slice(1).join('\n'));
          setBanner({ type: 'info', message: 'Extracted title and text from pasted content.' });
        }
      }
    }
  };

  const handleUrlPrefill = (urlInput: string) => {
    setSourceUrl(urlInput);
    const trimmed = urlInput.trim();
    // arXiv URL detection: e.g. https://arxiv.org/abs/2301.12345
    const arxivMatch = trimmed.match(/arxiv\.org\/(?:abs|pdf)\/(\d+\.\d+(?:v\d+)?)/i);
    if (arxivMatch) {
      const arxivId = arxivMatch[1].replace(/v\d+$/, '');
      if (!doi) setDoi(`10.48550/arXiv.${arxivId}`);
      if (!pdfUrl) setPdfUrl(`https://arxiv.org/pdf/${arxivId}.pdf`);
      if (!venue) setVenue('arXiv preprint');
    }
    // DOI URL detection: e.g. https://doi.org/10.1145/12345
    const doiMatch = trimmed.match(/doi\.org\/(10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+)/i);
    if (doiMatch) {
      if (!doi) setDoi(doiMatch[1]);
    }
  };

  const saveToLocalStorageFallback = (clippedItem: any) => {
    try {
      const existingRaw = localStorage.getItem('researchloom_references_');
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      const authorsList = authors.split(',').map(a => a.trim()).filter(Boolean);
      const yearNum = year ? parseInt(year, 10) : undefined;
      const firstAuthor = authorsList[0] || 'Paper';
      const safeKey = `${firstAuthor.replace(/[^a-zA-Z]/g, '')}${yearNum || new Date().getFullYear()}`;

      const newRef = {
        id: clippedItem.paper_id || `clip_${Date.now()}`,
        citation_key: safeKey,
        cite_author_year: `${firstAuthor} (${yearNum || new Date().getFullYear()})`,
        entry_type: 'article',
        title: title.trim(),
        authors: authorsList,
        year: yearNum,
        venue: venue.trim() || undefined,
        doi: doi.trim() || undefined,
        doi_verified: Boolean(doi.trim()),
        url: sourceUrl.trim() || undefined,
        abstract: abstract.trim() || undefined,
        collection_name: tags.split(',')[0]?.trim() || 'Web Clipper',
        source: 'loom_clipper',
        is_vaulted: true,
        created_at: new Date().toISOString()
      };

      const alreadyExists = existing.some((r: any) =>
        (doi.trim() && r.doi && r.doi.toLowerCase() === doi.trim().toLowerCase()) ||
        (r.title && r.title.toLowerCase() === title.trim().toLowerCase())
      );

      if (!alreadyExists) {
        existing.push(newRef);
        localStorage.setItem('researchloom_references_', JSON.stringify(existing));
      }
    } catch (err) {
      console.warn('Failed to save clipped reference to localStorage fallback:', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setBanner({ type: 'error', message: 'Paper title is required.' });
      return;
    }

    setLoading(true);
    setBanner(null);

    const authorsList = authors.split(',').map(a => a.trim()).filter(Boolean);
    const tagsList = tags.split(',').map(t => t.trim()).filter(Boolean);
    const parsedYear = year.trim() ? parseInt(year.trim(), 10) : undefined;

    const payload = {
      title: title.trim(),
      authors: authorsList,
      year: isNaN(Number(parsedYear)) ? undefined : parsedYear,
      abstract: abstract.trim() || undefined,
      doi: doi.trim() || undefined,
      venue: venue.trim() || undefined,
      pdf_url: pdfUrl.trim() || undefined,
      source_url: sourceUrl.trim() || undefined,
      tags: tagsList
    };

    try {
      const response = await fetch(`${getApiBase()}/clipper/ingest`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeader()
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Ingest failed with HTTP ${response.status}`);
      }

      const data = await response.json();
      saveToLocalStorageFallback(data);

      if (data.status === 'already_exists') {
        setBanner({ type: 'info', message: 'Paper already exists in ResearchLoom vault.' });
        onSave?.(data);
        setTimeout(() => {
          onClose();
        }, 1200);
      } else {
        setBanner({ type: 'success', message: data.message || 'Successfully clipped to ResearchLoom vault.' });
        onSave?.(data);
        setTimeout(() => {
          onClose();
        }, 900);
      }
    } catch (err: any) {
      console.warn('Backend /clipper/ingest request failed, applying offline fallback:', err);
      // Fallback offline storage
      const fallbackItem = {
        paper_id: `clip_${Date.now()}`,
        status: 'offline_cached',
        title: title.trim()
      };
      saveToLocalStorageFallback(fallbackItem);
      setBanner({ type: 'success', message: 'Saved to local offline library.' });
      onSave?.(fallbackItem);
      setTimeout(() => {
        onClose();
      }, 900);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-800">
          <div>
            <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" />
              Clip Academic Paper
            </h3>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Directly ingest paper metadata and PDFs into ResearchLoom Vault
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Headers */}
        <div className="flex border-b border-zinc-800 px-5 bg-zinc-950/40">
          <button
            type="button"
            onClick={() => setActiveTab('url')}
            className={`py-2 px-3 text-xs font-medium cursor-pointer border-b-2 transition ${
              activeTab === 'url'
                ? 'border-zinc-200 text-zinc-100'
                : 'border-transparent text-zinc-400 hover:text-zinc-300'
            }`}
          >
            URL / DOI / arXiv
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('paste')}
            className={`py-2 px-3 text-xs font-medium cursor-pointer border-b-2 transition ${
              activeTab === 'paste'
                ? 'border-zinc-200 text-zinc-100'
                : 'border-transparent text-zinc-400 hover:text-zinc-300'
            }`}
          >
            Paste HTML / BibTeX
          </button>
        </div>

        {/* Banner notification */}
        {banner && (
          <div
            className={`mx-5 mt-3 px-3 py-2 rounded-md text-xs flex items-center gap-2 ${
              banner.type === 'error'
                ? 'bg-red-950/40 border border-red-800/60 text-red-300'
                : banner.type === 'info'
                ? 'bg-sky-950/40 border border-sky-800/60 text-sky-300'
                : 'bg-emerald-950/40 border border-emerald-800/60 text-emerald-300'
            }`}
          >
            {banner.type === 'error' ? (
              <AlertCircle className="w-4 h-4 shrink-0" />
            ) : (
              <CheckCircle className="w-4 h-4 shrink-0" />
            )}
            <span>{banner.message}</span>
          </div>
        )}

        {/* Tab Body & Form */}
        <form onSubmit={handleSubmit} className="p-5 flex-1 overflow-y-auto space-y-3.5">
          {activeTab === 'url' ? (
            <div>
              <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                Source URL or Paper Identifier
              </label>
              <input
                type="text"
                placeholder="https://arxiv.org/abs/... or https://doi.org/..."
                value={sourceUrl}
                onChange={(e) => handleUrlPrefill(e.target.value)}
                className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-600 focus-visible:outline-none"
              />
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-medium text-zinc-300">
                  Raw BibTeX Snippet or Webpage HTML
                </label>
                <button
                  type="button"
                  onClick={handleParseRawPaste}
                  className="text-[11px] text-sky-400 hover:text-sky-300 font-medium cursor-pointer flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3" />
                  Auto-Fill Fields
                </button>
              </div>
              <textarea
                placeholder="Paste @article{...} or <meta name='citation_title' ...>"
                value={rawPasteText}
                onChange={(e) => setRawPasteText(e.target.value)}
                rows={3}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-100 font-mono placeholder-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-600 focus-visible:outline-none resize-none"
              />
            </div>
          )}

          {/* Form Fields */}
          <div>
            <label className="block text-[11px] font-medium text-zinc-300 mb-1">
              Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="Paper title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-600 focus-visible:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                Authors (comma-separated)
              </label>
              <input
                type="text"
                placeholder="e.g. Alice Smith, Bob Jones"
                value={authors}
                onChange={(e) => setAuthors(e.target.value)}
                className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-600 focus-visible:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                Year
              </label>
              <input
                type="number"
                placeholder="2024"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-600 focus-visible:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                DOI
              </label>
              <input
                type="text"
                placeholder="10.xxxx/yyyy"
                value={doi}
                onChange={(e) => setDoi(e.target.value)}
                className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-600 focus-visible:outline-none"
              />
            </div>
            <div>
              <label className="block text-[11px] font-medium text-zinc-300 mb-1">
                Venue / Journal
              </label>
              <input
                type="text"
                placeholder="e.g. NeurIPS, ICML, Nature"
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-600 focus-visible:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-300 mb-1">
              Direct PDF URL (Optional)
            </label>
            <input
              type="text"
              placeholder="https://.../paper.pdf"
              value={pdfUrl}
              onChange={(e) => setPdfUrl(e.target.value)}
              className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-600 focus-visible:outline-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-300 mb-1">
              Abstract
            </label>
            <textarea
              rows={3}
              placeholder="Summary or abstract of the academic paper..."
              value={abstract}
              onChange={(e) => setAbstract(e.target.value)}
              className="w-full h-20 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-600 focus-visible:outline-none resize-none"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-zinc-300 mb-1">
              Collection / Tags (comma-separated)
            </label>
            <input
              type="text"
              placeholder="e.g. transformers, deep-learning"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              className="w-full h-9 bg-zinc-950 border border-zinc-800 rounded-md px-3 py-1.5 text-xs text-zinc-100 placeholder-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-600 focus-visible:outline-none"
            />
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-zinc-800/80">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs px-3 py-1.5 rounded-md border border-zinc-700 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold px-4 py-1.5 rounded-md shadow-xs transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Save to Vault</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
