import React from 'react';
import {
  Key,
  ShieldCheck,
  User as UserIcon,
  LogOut,
  ChevronDown,
  MessageSquare,
  Bookmark,
  Download,
  HelpCircle,
  PenTool,
  Network,
  Table,
  Calculator,
  TrendingUp,
  Tablet,
  Sparkles,
  History,
  RotateCcw,
  Github,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { HealthStatus } from '../types';
import { MusicFocusBar } from './music/MusicFocusBar';
import { ModelSwitcherPill } from './ModelSwitcherPill';

import { MainTabType } from './Sidebar';

interface HeaderProps {
  health: HealthStatus | null;
  onOpenAssistant: () => void;
  activeTab?: MainTabType;
  onTabChange?: (tab: MainTabType) => void;
  onOpenTutorial?: () => void;
  onOpenSkills?: () => void;
  onOpenTabletBridge?: () => void;
  onOpenRollback?: () => void;
  lastAutosave?: Date;
}

export const Header: React.FC<HeaderProps> = ({
  health,
  onOpenAssistant,
  activeTab = 'research',
  onTabChange,
  onOpenTutorial,
  onOpenSkills,
  onOpenTabletBridge,
  onOpenRollback,
  lastAutosave
}) => {
  const { user, offlineProfile, openAuthModal, openKeyModal, saveBYOKKeys } = useAuth();
  const [showUserDropdown, setShowUserDropdown] = React.useState(false);

  const hasConfiguredKeys = user && Object.values(user.configured_keys || {}).some(v => !!v);

  return (
    <header className="h-14 px-4 sm:px-6 flex items-center justify-between border-b border-white/5 z-30 transition-colors bg-[#07080a]/95 backdrop-blur-xl">
      {/* Left Active Context Title (Restrained & Minimalist) */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-zinc-100 capitalize">
            {activeTab === 'research' ? 'Literature Research' :
             activeTab === 'studio' ? 'Writing & LaTeX Studio' :
             activeTab === 'stylus' ? 'Stylus Studio & Scratchpad' :
             activeTab === 'flow' ? 'Interactive Flow Maps' :
             activeTab === 'formulas' ? 'Scientific Formula Blocks' :
             activeTab === 'stats' ? 'Statistical Computing' :
             activeTab === 'sheets' ? 'Project Data Sheets' :
             activeTab === 'references' ? 'Master Reference Manager' :
             activeTab === 'downloads' ? 'Local Vault Downloads' : activeTab}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60 hidden sm:inline">
            Offline Mode
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 hidden md:inline">
            {offlineProfile?.app_identity === 'samhita' ? 'Samhita' : 'ResearchLoom'}
          </span>
        </div>
      </div>

      {/* Right Controls: Focus Music Dock, Skills, Tutorial, BYOK, User */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        <MusicFocusBar />

        {/* AI Skills Synthesizer Button */}
        {onOpenSkills && (
          <button
            type="button"
            onClick={onOpenSkills}
            className="hidden 2xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800/70 text-xs font-medium text-zinc-300 hover:text-white transition-all shadow-xs"
            title="AI Skills & Autonomous Workflows"
          >
            <Sparkles className="w-3.5 h-3.5 text-zinc-400" />
            <span>AI Skills</span>
          </button>
        )}
        {onOpenTutorial && (
          <button
            type="button"
            onClick={onOpenTutorial}
            className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800/70 text-xs font-medium text-zinc-300 hover:text-white transition-all shadow-xs"
            title="Interactive Walkthrough & Tutorials"
          >
            <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />
            <span>Tutorial</span>
          </button>
        )}

        {/* Continuous Autosave & Rollback Pill */}
        {onOpenRollback && (
          <button
            type="button"
            onClick={onOpenRollback}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-xs font-medium text-zinc-300 hover:text-white transition-all shadow-xs"
            title="Continuous Autosave & Snapshot Rollback (Click to restore past work)"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-mono text-zinc-400 hidden md:inline">Autosaved</span>
            <History className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        )}

        {/* GitHub & Bug Report Link */}
        <a
          href="https://github.com/sohamsans/researchloom/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800/80 text-xs font-medium text-zinc-300 hover:text-white transition-all shadow-xs"
          title="GitHub Repo & Issue Tracker — Report bugs with screenshots!"
        >
          <Github className="w-3.5 h-3.5 text-zinc-400" />
          <span className="hidden xl:inline">Report Issue</span>
          <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-sky-500/20 text-sky-300 border border-sky-500/30">
            Beta
          </span>
        </a>

        {/* Universal Model & Provider Switcher */}
        <ModelSwitcherPill />

        {/* Disciplined BYOK Key Button */}
        <button
          type="button"
          onClick={openKeyModal}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800/70 text-xs font-medium text-zinc-200 shadow-xs transition-all cursor-pointer"
        >
          <Key className="w-3.5 h-3.5 text-zinc-400" />
          <span className="hidden sm:inline">BYOK Keys</span>
          <span className="sm:hidden">Keys</span>
          {hasConfiguredKeys && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" title="Keys encrypted" />
          )}
        </button>

        {/* Fun Offline Researcher Profile Avatar Button */}
        <button
          type="button"
          onClick={openAuthModal}
          className="flex items-center gap-1.5 px-2 py-1 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800/80 transition-all text-xs"
          title={`Researcher: ${offlineProfile?.name || 'Local'} (@${offlineProfile?.username || 'researcher'})`}
        >
          <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 text-white font-bold text-[10px] flex items-center justify-center shadow-xs">
            {(offlineProfile?.name || 'R').charAt(0).toUpperCase()}
          </div>
          <span className="hidden lg:inline font-mono text-zinc-300 text-[11px]">
            @{offlineProfile?.username || 'researcher'}
          </span>
        </button>
      </div>
    </header>
  );
};
