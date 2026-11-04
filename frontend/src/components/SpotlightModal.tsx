import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  FileText, 
  PenTool, 
  Sparkles, 
  ArrowRight, 
  Hash, 
  Database,
  ExternalLink,
  Copy,
  Check,
  X
} from 'lucide-react';

interface SpotlightResult {
  id: string;
  type: 'paper' | 'note' | 'formula' | 'stylus';
  title: string;
  subtitle: string;
  badge?: string;
  data?: any;
}

interface SpotlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectPaper?: (paper: any) => void;
  onOpenStudio?: (studioKey: string) => void;
}

export const SpotlightModal: React.FC<SpotlightModalProps> = ({
  isOpen,
  onClose,
  onSelectPaper,
  onOpenStudio
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SpotlightResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
      fetchAllItems('');
    }
  }, [isOpen]);

  const fetchAllItems = async (q: string) => {
    try {
      const res = await fetch(`/api/references/all?search=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        const papers = (data.papers || []).slice(0, 10).map((p: any) => ({
          id: p.id || p.doi || p.title,
          type: 'paper' as const,
          title: p.title,
          subtitle: `${(p.authors || []).slice(0, 2).join(', ')} • ${p.year || 'N/A'} • ${p.venue || 'Journal'}`,
          badge: p.has_pdf ? 'PDF Vaulted' : 'Pooled',
          data: p
        }));

        // Default quick actions if query is empty
        const defaultActions: SpotlightResult[] = [
          {
            id: 'act-stylus',
            type: 'stylus',
            title: 'Open Stylus Studio & Notebook',
            subtitle: 'Freehand handwritten math & diagramming with pen dynamics',
            badge: 'Studio'
          },
          {
            id: 'act-latex',
            type: 'formula',
            title: 'Open LaTeX & Formula Studio',
            subtitle: 'Real-time equation editor, TikZ renderer, and formula blocks',
            badge: 'Studio'
          },
          {
            id: 'act-matrix',
            type: 'note',
            title: 'Evidence Matrix Studio',
            subtitle: 'PRISMA cross-study comparative synthesis matrix',
            badge: 'Studio'
          }
        ];

        setResults(q.trim() ? papers : [...defaultActions, ...papers]);
      }
    } catch (e) {
      console.error('Spotlight search error:', e);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        executeSelection(results[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const executeSelection = (item: SpotlightResult) => {
    if (item.id === 'act-stylus') {
      onOpenStudio?.('stylus');
      onClose();
    } else if (item.id === 'act-latex') {
      onOpenStudio?.('latex');
      onClose();
    } else if (item.id === 'act-matrix') {
      onOpenStudio?.('matrix');
      onClose();
    } else if (item.type === 'paper' && item.data) {
      onSelectPaper?.(item.data);
      onClose();
    }
  };

  const copyBibtex = (item: SpotlightResult, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!item.data) return;
    const p = item.data;
    const firstAuthor = p.authors?.[0] ? p.authors[0].split(' ').pop().toLowerCase() : 'paper';
    const citeKey = `${firstAuthor}${p.year || 2026}`;
    const bib = `@article{${citeKey},\n  title={${p.title}},\n  author={${(p.authors || []).join(' and ')}},\n  year={${p.year || ''}},\n  doi={${p.doi || ''}}\n}`;
    navigator.clipboard.writeText(bib);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
          <Search className="w-5 h-5 text-zinc-400 mr-3 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none"
            placeholder="Type to search papers, vaulted PDFs, or navigate studios..."
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              fetchAllItems(e.target.value);
            }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-zinc-400 bg-zinc-800 border border-zinc-700 rounded">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-[380px] overflow-y-auto p-2 divide-y divide-zinc-900">
          {results.length === 0 ? (
            <div className="py-12 text-center text-sm text-zinc-500">
              No matching records found in local vault.
            </div>
          ) : (
            results.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={item.id}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                    isSelected ? 'bg-zinc-800/80 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-900/60'
                  }`}
                  onClick={() => executeSelection(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="flex items-center gap-3 min-w-0 pr-4">
                    <div className="p-2 rounded bg-zinc-900 border border-zinc-800 shrink-0 text-zinc-400">
                      {item.type === 'paper' && <FileText className="w-4 h-4 text-blue-400" />}
                      {item.type === 'stylus' && <PenTool className="w-4 h-4 text-emerald-400" />}
                      {item.type === 'formula' && <Sparkles className="w-4 h-4 text-amber-400" />}
                      {item.type === 'note' && <Database className="w-4 h-4 text-purple-400" />}
                    </div>

                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate text-zinc-100">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                        {item.subtitle}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.badge && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400 font-mono">
                        {item.badge}
                      </span>
                    )}

                    {item.type === 'paper' && (
                      <button
                        title="Copy BibTeX Citation"
                        onClick={e => copyBibtex(item, e)}
                        className="p-1 rounded text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
                      >
                        {copiedId === item.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}

                    <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? 'text-zinc-300' : 'text-zinc-600'}`} />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-900/30 flex items-center justify-between text-[11px] text-zinc-500">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono text-zinc-400">↑↓</kbd> navigate</span>
            <span><kbd className="font-mono text-zinc-400">↵</kbd> select</span>
          </div>
          <span>ResearchLoom Omni-Search</span>
        </div>
      </div>
    </div>
  );
};
