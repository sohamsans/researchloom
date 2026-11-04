import React, { useState, useEffect, useRef } from 'react';
import { Search, BookOpen, Check, X } from 'lucide-react';

interface CitationPickerModalProps {
  isOpen: boolean;
  query: string;
  onClose: () => void;
  onSelectCiteKey: (citeKey: string) => void;
}

export const CitationPickerModal: React.FC<CitationPickerModalProps> = ({
  isOpen,
  query,
  onClose,
  onSelectCiteKey
}) => {
  const [papers, setPapers] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [searchFilter, setSearchFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchFilter(query || '');
      setSelectedIndex(0);
      fetchReferences(query || '');
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, query]);

  const fetchReferences = async (q: string) => {
    try {
      const res = await fetch(`/api/references/all?search=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setPapers(data.papers || []);
      }
    } catch (e) {
      console.error('Failed to load references:', e);
    }
  };

  const getCiteKey = (p: any): string => {
    const author = p.authors?.[0] ? p.authors[0].split(' ').pop().toLowerCase() : 'paper';
    const yr = p.year || 2026;
    const firstWord = (p.title || 'untitled').split(' ')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${author}${yr}${firstWord}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < papers.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : papers.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (papers[selectedIndex]) {
        onSelectCiteKey(getCiteKey(papers[selectedIndex]));
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center px-4 py-3 border-b border-zinc-800 bg-zinc-900/40">
          <BookOpen className="w-4 h-4 text-blue-400 mr-2.5 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            className="w-full bg-transparent text-xs text-zinc-100 placeholder-zinc-500 focus:outline-none"
            placeholder="Search reference by author, title, or year to cite..."
            value={searchFilter}
            onChange={e => {
              setSearchFilter(e.target.value);
              fetchReferences(e.target.value);
            }}
            onKeyDown={handleKeyDown}
          />
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-72 overflow-y-auto p-2 divide-y divide-zinc-900">
          {papers.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              No matching papers found in your vault.
            </div>
          ) : (
            papers.map((p, idx) => {
              const citeKey = getCiteKey(p);
              const isSelected = idx === selectedIndex;
              return (
                <div
                  key={p.id || citeKey}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    isSelected ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-300 hover:bg-zinc-900/60'
                  }`}
                  onClick={() => onSelectCiteKey(citeKey)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-blue-400">
                        @{citeKey}
                      </span>
                      <span className="text-[11px] text-zinc-400 truncate">
                        {(p.authors || []).slice(0, 2).join(', ')} ({p.year || 'N/A'})
                      </span>
                    </div>
                    <div className="text-xs text-zinc-300 truncate mt-0.5">
                      {p.title}
                    </div>
                  </div>

                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800 shrink-0">
                    ↵ Cite
                  </span>
                </div>
              );
            })
          )}
        </div>

        <div className="px-4 py-2 border-t border-zinc-800 bg-zinc-900/30 flex justify-between text-[11px] text-zinc-500">
          <span>Press <kbd className="font-mono text-zinc-400">↵ Enter</kbd> to insert citation</span>
          <span>Inserts format: <code className="text-zinc-400">[@citekey]</code></span>
        </div>
      </div>
    </div>
  );
};
