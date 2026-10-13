import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  MessageSquare,
  PenTool,
  Network,
  Calculator,
  TrendingUp,
  Table,
  Bookmark,
  Download,
  Settings,
  Sparkles,
  ChevronRight,
  Trash2,
  BookOpen,
  FolderPlus,
  Folder,
  Layers,
  HelpCircle,
  History,
  Github
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { SavedSearchItem } from '../types';
import { LitBuddyLogo } from './LitBuddyLogo';

export type MainTabType = 'research' | 'references' | 'downloads' | 'studio' | 'flow' | 'sheets' | 'formulas' | 'stats';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  onNewReview: () => void;
  onSelectTopic: (topic: string) => void;
  activeTab: MainTabType;
  onTabChange: (tab: MainTabType) => void;
  onOpenSkills?: () => void;
  onOpenTutorial?: () => void;
  onOpenRollback?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  onToggle,
  onNewReview,
  onSelectTopic,
  activeTab,
  onTabChange,
  onOpenSkills,
  onOpenTutorial,
  onOpenRollback
}) => {
  const { offlineProfile, openAuthModal, openKeyModal } = useAuth();
  const [recentSearches, setRecentSearches] = useState<SavedSearchItem[]>([]);
  const [searchFilter, setSearchFilter] = useState('');
  const [sidebarMode, setSidebarMode] = useState<'chat' | 'spark'>('chat');

  const refreshSearches = useCallback(() => {
    // Helper to deduplicate list of searches by normalized topic or query hash
    const deduplicateList = (items: SavedSearchItem[]): SavedSearchItem[] => {
      const seen = new Set<string>();
      const result: SavedSearchItem[] = [];
      for (const item of items) {
        if (!item || !item.topic) continue;
        const norm = item.topic.toLowerCase().trim();
        const hashKey = item.query_hash ? `hash:${item.query_hash}` : null;
        const topicKey = `topic:${norm}`;
        if (!seen.has(topicKey) && (!hashKey || !seen.has(hashKey))) {
          seen.add(topicKey);
          if (hashKey) seen.add(hashKey);
          result.push(item);
        }
      }
      return result;
    };

    // 1. Fetch from backend DiscoveryCache
    api.getSavedSearches().then((backendSearches) => {
      // 2. Also merge any local recent searches from localStorage
      try {
        const localListRaw = localStorage.getItem('researchloom_local_searches');
        const localList: SavedSearchItem[] = localListRaw ? JSON.parse(localListRaw) : [];
        const combined = deduplicateList([...localList, ...(backendSearches || [])]);
        setRecentSearches(combined);
      } catch {
        setRecentSearches(deduplicateList(backendSearches || []));
      }
    }).catch(() => {
      try {
        const localListRaw = localStorage.getItem('researchloom_local_searches');
        if (localListRaw) setRecentSearches(deduplicateList(JSON.parse(localListRaw)));
      } catch {}
    });
  }, []);

  useEffect(() => {
    refreshSearches();
    const handleUpdate = () => refreshSearches();
    window.addEventListener('researchloom_search_saved', handleUpdate);
    return () => window.removeEventListener('researchloom_search_saved', handleUpdate);
  }, [refreshSearches]);

  const handleDeleteSearch = async (e: React.MouseEvent, item: SavedSearchItem) => {
    e.stopPropagation();
    // 1. Instantly remove from local component state for zero UI latency
    setRecentSearches((prev) => prev.filter((s) => s.query_hash !== item.query_hash && s.topic.toLowerCase().trim() !== item.topic.toLowerCase().trim()));

    // 2. Clear corresponding localStorage review cache & local search history
    try {
      const cleanTopic = item.topic.toLowerCase().trim();
      localStorage.removeItem(`litbuddy_saved_review_${item.query_hash}`);
      localStorage.removeItem(`litbuddy_saved_review_${cleanTopic}`);

      const localListRaw = localStorage.getItem('researchloom_local_searches');
      if (localListRaw) {
        const localList: SavedSearchItem[] = JSON.parse(localListRaw);
        const updated = localList.filter((s) => s.query_hash !== item.query_hash && s.topic.toLowerCase().trim() !== cleanTopic);
        localStorage.setItem('researchloom_local_searches', JSON.stringify(updated));
      }

      // Remove any matching review keys
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('litbuddy_saved_review_') && k.toLowerCase().includes(cleanTopic)) {
          localStorage.removeItem(k);
        }
      }
    } catch {}

    // 3. Delete from backend DB
    try {
      await api.deleteSavedSearch(item.query_hash, item.topic);
    } catch (err) {
      console.error('Failed to remove review history from backend:', err);
    }
  };

  const filteredSearches = useMemo(() => {
    const seen = new Set<string>();
    const unique: SavedSearchItem[] = [];
    for (const s of recentSearches) {
      const key = s.topic.toLowerCase().trim();
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(s);
      }
    }
    if (!searchFilter.trim()) return unique;
    return unique.filter((s) => s.topic.toLowerCase().includes(searchFilter.toLowerCase()));
  }, [recentSearches, searchFilter]);

  const navItems: Array<{ id: MainTabType; label: string; icon: React.FC<{ className?: string }> }> = [
    { id: 'research', label: 'Research', icon: MessageSquare },
    { id: 'studio', label: 'Writing Studio', icon: PenTool },
    { id: 'flow', label: 'Flow Maps', icon: Network },
    { id: 'formulas', label: 'Formula Blocks', icon: Calculator },
    { id: 'stats', label: 'Statistics', icon: TrendingUp },
    { id: 'sheets', label: 'Data Sheets', icon: Table },
    { id: 'references', label: 'Reference Manager', icon: Bookmark },
    { id: 'downloads', label: 'Downloads', icon: Download }
  ];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex flex-col transition-all duration-300 ease-in-out border-r bg-[#121316] border-white/5 select-none ${
        isOpen ? 'w-64' : 'w-16'
      }`}
    >
      {/* 1. Header: Gemini-style Brand Title + Toggle Button */}
      <div className={`h-14 flex items-center ${isOpen ? 'px-4 justify-between' : 'justify-center px-2'}`}>
        {isOpen ? (
          <>
            <div className="flex items-center gap-2.5 min-w-0">
              <LitBuddyLogo className="w-6 h-6 shrink-0" />
              <span className="font-semibold text-sm tracking-tight text-zinc-100 flex items-center gap-1.5 truncate">
                {offlineProfile?.app_identity === 'samhita' ? 'Samhita' : 'ResearchLoom'}
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  {offlineProfile?.app_identity === 'samhita' ? 'संहिता' : 'AI'}
                </span>
              </span>
            </div>
            <button
              type="button"
              onClick={onToggle}
              className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition-colors cursor-pointer shrink-0"
              title="Collapse sidebar"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={onToggle}
            className="w-10 h-10 rounded-xl hover:bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 flex items-center justify-center transition-colors cursor-pointer"
            title="Expand sidebar"
          >
            <LitBuddyLogo className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* 2. Gemini Capsule Switcher: Chat / Spark Studio (When expanded) */}
      {isOpen ? (
        <div className="px-3 pt-1 pb-2">
          <div className="flex items-center p-1 rounded-2xl bg-[#1b1d22] border border-white/5 text-xs">
            <button
              type="button"
              onClick={() => {
                setSidebarMode('chat');
                onTabChange('research');
              }}
              className={`flex-1 py-1.5 rounded-xl font-medium transition-all text-center cursor-pointer ${
                sidebarMode === 'chat'
                  ? 'bg-[#282a30] text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Chat
            </button>
            <button
              type="button"
              onClick={() => {
                setSidebarMode('spark');
                onTabChange('studio');
              }}
              className={`flex-1 py-1.5 rounded-xl font-medium transition-all text-center flex items-center justify-center gap-1.5 cursor-pointer ${
                sidebarMode === 'spark'
                  ? 'bg-[#282a30] text-zinc-100 shadow-xs'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <span>Studio</span>
              <span className="text-[9px] uppercase tracking-wider px-1 py-0.2 rounded bg-amber-500/15 text-amber-300 font-semibold border border-amber-500/30">
                PRO
              </span>
            </button>
          </div>
        </div>
      ) : null}

      {/* 3. Primary Action: New Review Button */}
      <div className="px-3 pb-2 pt-1">
        {isOpen ? (
          <button
            type="button"
            onClick={() => {
              onTabChange('research');
              onNewReview();
            }}
            className="w-full py-2 px-3 rounded-2xl flex items-center gap-2.5 text-xs font-semibold transition-all bg-[#1e2025] hover:bg-[#282a30] border border-white/5 text-zinc-100 shadow-xs cursor-pointer group"
          >
            <Plus className="w-4 h-4 text-sky-400 group-hover:rotate-90 transition-transform duration-200 shrink-0" />
            <span className="truncate">New review</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              onTabChange('research');
              onNewReview();
            }}
            className="w-10 h-10 mx-auto rounded-2xl bg-[#1e2025] hover:bg-[#282a30] border border-white/5 flex items-center justify-center text-sky-400 hover:text-white transition shadow-xs cursor-pointer"
            title="Start new literature review"
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 4. Gemini Navigation Items (Research, Studio, Flow Maps, Formulas, etc.) */}
      <div className="px-2 py-1 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return isOpen ? (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-2xl text-xs font-medium transition-all text-left cursor-pointer ${
                isActive
                  ? 'bg-[#282a30] text-zinc-100 font-semibold shadow-xs border border-white/5'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1a1b20]'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-sky-400' : 'text-zinc-400'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          ) : (
            <button
              key={item.id}
              type="button"
              onClick={() => onTabChange(item.id)}
              className={`w-10 h-10 mx-auto rounded-2xl flex items-center justify-center transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#282a30] text-sky-400 font-semibold shadow-xs border border-white/5'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#1a1b20]'
              }`}
              title={item.label}
            >
              <Icon className="w-4 h-4" />
            </button>
          );
        })}
      </div>

      {/* 5. Search Bar (When expanded) */}
      {isOpen && (
        <div className="px-3 pt-3 pb-1">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search chats & reviews..."
              className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-zinc-950/60 border border-white/5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-hidden focus:border-zinc-700"
            />
          </div>
        </div>
      )}

      {/* 6. Gemini "Notebooks" / Recent Reviews Stream */}
      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-3 min-h-0 scrollbar-thin scrollbar-thumb-zinc-800">
        {isOpen ? (
          <div>
            <div className="px-3 pb-1 text-[11px] font-semibold tracking-wider text-zinc-500 flex items-center justify-between">
              <span>Notebooks</span>
              <span className="text-[10px] text-zinc-600 font-mono">{filteredSearches.length}</span>
            </div>

            <div className="space-y-0.5">
              {filteredSearches.length === 0 ? (
                <div className="px-3 py-3 text-xs text-zinc-500 italic">
                  {searchFilter ? 'No matching notebooks' : 'No saved research topics yet'}
                </div>
              ) : (
                filteredSearches.map((item) => (
                  <div
                    key={item.query_hash}
                    onClick={() => {
                      onTabChange('research');
                      onSelectTopic(item.topic);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-xs text-zinc-400 hover:text-zinc-200 hover:bg-[#1a1b20] transition-colors flex items-center justify-between group cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-1">
                      <BookOpen className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 shrink-0" />
                      <span className="truncate">{item.topic}</span>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSearch(e, item)}
                      className="p-1 rounded-lg text-zinc-500 hover:text-rose-400 hover:bg-zinc-800/80 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                      title="Remove notebook"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* 7. Bottom Tools & Profile Footer */}
      <div className="p-2 border-t border-white/5 bg-[#0f1013] space-y-1">
        {isOpen ? (
          <>
            {/* Quick Utility Shortcuts */}
            <div className="flex items-center justify-between px-2 py-1 text-xs text-zinc-400">
              {onOpenSkills && (
                <button
                  type="button"
                  onClick={onOpenSkills}
                  className="flex items-center gap-1 hover:text-zinc-200 transition-colors cursor-pointer"
                  title="AI Skills & Agents"
                >
                  <Sparkles className="w-3.5 h-3.5 text-sky-400" />
                  <span className="text-[11px]">Skills</span>
                </button>
              )}
              {onOpenRollback && (
                <button
                  type="button"
                  onClick={onOpenRollback}
                  className="flex items-center gap-1 hover:text-zinc-200 transition-colors cursor-pointer"
                  title="Rollback History"
                >
                  <History className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-[11px]">History</span>
                </button>
              )}
              {onOpenTutorial && (
                <button
                  type="button"
                  onClick={onOpenTutorial}
                  className="flex items-center gap-1 hover:text-zinc-200 transition-colors cursor-pointer"
                  title="Tutorial Tour"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="text-[11px]">Tour</span>
                </button>
              )}
              <a
                href="https://github.com/sohamsans/researchloom/issues"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-zinc-400 hover:text-sky-300 transition-colors cursor-pointer"
                title="GitHub Repo & Issues — Submit bugs with screenshots"
              >
                <Github className="w-3.5 h-3.5 text-zinc-400" />
                <span className="text-[11px]">GitHub</span>
              </a>
            </div>

            {/* Profile Bar */}
            <div className="flex items-center justify-between p-2 rounded-2xl bg-[#17181c] border border-white/5">
              <div
                onClick={openAuthModal}
                className="flex items-center gap-2.5 min-w-0 cursor-pointer flex-1"
                title="Edit Offline Researcher Profile"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-xs">
                  {(offlineProfile?.name || 'R').charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 truncate">
                  <p className="text-xs font-medium text-zinc-200 truncate">
                    {offlineProfile?.name || 'Researcher'}
                  </p>
                  <p className="text-[10px] text-zinc-500 truncate font-mono">
                    @{offlineProfile?.username || 'researcher'}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={openKeyModal}
                className="p-1.5 rounded-xl text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition-colors cursor-pointer shrink-0"
                title="API Keys & BYOK Settings"
              >
                <Settings className="w-4 h-4" />
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 py-1">
            <button
              type="button"
              onClick={openAuthModal}
              className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-500 text-white font-bold text-xs flex items-center justify-center cursor-pointer shadow-xs hover:opacity-90 transition"
              title={`Researcher: ${offlineProfile?.name || 'Local'} (@${offlineProfile?.username || 'researcher'})`}
            >
              {(offlineProfile?.name || 'R').charAt(0).toUpperCase()}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};

