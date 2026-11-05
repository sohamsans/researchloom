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
  ExternalLink,
  PanelLeftOpen,
  PanelLeftClose,
  ArrowLeftRight,
  Cpu
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
  onOpenP2PSync?: () => void;
  onOpenMcp?: () => void;
  lastAutosave?: Date;
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
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
  onOpenP2PSync,
  onOpenMcp,
  lastAutosave,
  onToggleSidebar,
  isSidebarOpen
}) => {
  const { user, offlineProfile, openAuthModal, openKeyModal, saveBYOKKeys } = useAuth();
  const [showUserDropdown, setShowUserDropdown] = React.useState(false);

  const hasConfiguredKeys = user && Object.values(user.configured_keys || {}).some(v => !!v);

  return (
    <header className="h-14 px-2 sm:px-4 md:px-6 flex items-center justify-between border-b border-white/5 z-30 transition-colors bg-[#07080a]/95 backdrop-blur-xl gap-2">
      {/* Left Active Context Title & Sidebar Toggle (Restrained & Minimalist) */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/80 transition cursor-pointer shrink-0"
            title={isSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {isSidebarOpen ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
          </button>
        )}
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <span className="text-xs font-semibold text-zinc-100 capitalize truncate max-w-[130px] sm:max-w-[200px] md:max-w-xs">
            {activeTab === 'research' ? 'Literature Research' :
             activeTab === 'studio' ? 'Writing Studio' :
             activeTab === 'stylus' ? 'Stylus Studio' :
             activeTab === 'flow' ? 'Flow Maps' :
             activeTab === 'formulas' ? 'Formula Blocks' :
             activeTab === 'stats' ? 'Statistics' :
             activeTab === 'sheets' ? 'Data Sheets' :
             activeTab === 'references' ? 'References' :
             activeTab === 'downloads' ? 'Downloads' : activeTab}
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-400 border border-zinc-700/60 hidden 2xl:inline shrink-0">
            Offline Mode
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 hidden 2xl:inline shrink-0">
            {offlineProfile?.app_identity === 'samhita' ? 'Samhita' : 'ResearchLoom'}
          </span>
        </div>
      </div>

      {/* Right Controls: Focus Music Dock, Skills, Tutorial, BYOK, User */}
      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
        <div className="hidden sm:block">
          <MusicFocusBar />
        </div>

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
            className="hidden xl:inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-850 text-xs font-medium text-zinc-300 hover:text-white transition-all shadow-xs"
            title="Continuous Autosave & Snapshot Rollback (Click to restore past work)"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[11px] font-mono text-zinc-400 hidden 2xl:inline">Autosaved</span>
            <History className="w-3.5 h-3.5 text-zinc-400" />
          </button>
        )}

        {/* End-of-Day P2P Sync Pill */}
        {onOpenP2PSync && (
          <button
            type="button"
            onClick={onOpenP2PSync}
            className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800/80 text-xs font-medium text-zinc-300 hover:text-white transition-all shadow-xs cursor-pointer"
            title="End-of-Day P2P Vault Sync (Reconcile Tablet & Desktop over local Wi-Fi)"
          >
            <ArrowLeftRight className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden lg:inline">P2P Sync</span>
          </button>
        )}

        {/* MCP Control Center Pill */}
        {onOpenMcp && (
          <button
            type="button"
            onClick={onOpenMcp}
            className="hidden lg:inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800/80 text-xs font-medium text-zinc-300 hover:text-white transition-all shadow-xs cursor-pointer"
            title="Model Context Protocol (MCP) Server Control & Claude Desktop Export"
          >
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            <span>MCP</span>
          </button>
        )}

        {/* GitHub & Bug Report Link */}
        <a
          href="https://github.com/sohamsans/researchloom/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800/80 text-xs font-medium text-zinc-300 hover:text-white transition-all shadow-xs"
          title="GitHub Repo & Issue Tracker — Report bugs with screenshots!"
        >
          <Github className="w-3.5 h-3.5 text-zinc-400" />
          <span className="hidden 2xl:inline">Report Issue</span>
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
          className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800/70 text-xs font-medium text-zinc-200 shadow-xs transition-all cursor-pointer"
        >
          <Key className="w-3.5 h-3.5 text-zinc-400" />
          <span className="hidden lg:inline">BYOK Keys</span>
          <span className="lg:hidden">Keys</span>
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
