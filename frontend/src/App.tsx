import React, { useState, useEffect } from 'react';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { GeminiInputBar } from './components/GeminiInputBar';
import { GeminiThinking } from './components/GeminiThinking';
import { CandidatePreviewTable } from './components/CandidatePreviewTable';
import { LiteratureTable } from './components/LiteratureTable';
import { PaperDetailModal } from './components/PaperDetailModal';
import { AssistantChatDrawer } from './components/AssistantChatDrawer';
import { ExportBar } from './components/ExportBar';
import { OfflineProfileModal } from './components/OfflineProfileModal';
import { RollbackHistoryModal, RestoreSnapshot } from './components/RollbackHistoryModal';
import { OnboardingKeyModal } from './components/OnboardingKeyModal';
import { SourcesSidebar } from './components/SourcesSidebar';
import { PaperChatArea } from './components/PaperChatArea';
import { MasterReferenceManager } from './components/MasterReferenceManager';
import { DownloadManagerView } from './components/DownloadManagerView';
import { WritingStudio } from './components/writer/WritingStudio';
import { StylusStudio } from './components/stylus/StylusStudio';
import { FlowMapCanvas } from './components/flowmap/FlowMapCanvas';
import { DataSheetStudio } from './components/DataSheetStudio';
import { EvidenceMatrixStudio } from './components/matrix/EvidenceMatrixStudio';
import { PRISMAFlowDiagram } from './components/screening/PRISMAFlowDiagram';
import { SkillSynthesizerModal } from './components/SkillSynthesizerModal';
import { TabletBridgeModal } from './components/TabletBridgeModal';
import { PdfViewerModal } from './components/PdfViewerModal';
import { OnboardingTourModal } from './components/OnboardingTourModal';
import { CookieBanner } from './components/CookieBanner';
import { LegalModal } from './components/LegalModal';
import { TopographicBackground } from './components/TopographicBackground';
import { fetchHealthStatus, discoverPapers, runSelectedPipeline, runReviewPipeline, bulkDownloadPapers } from './services/api';
import { FormulaStudio } from './components/calculator/FormulaStudio';
import { StatisticsStudio } from './components/statistics/StatisticsStudio';
import { SynthesisObjectiveModal } from './components/SynthesisObjectiveModal';
import { SpotlightModal } from './components/SpotlightModal';
import { UpdateModal } from './components/UpdateModal';
import {
  HealthStatus,
  PipelineResponse,
  PipelineStage,
  ReviewPaper,
  RawPaperMetadata,
  SearchRequest,
  VaultPaperItem,
  SavedSearchItem
} from './types';
import { MainTabType } from './components/Sidebar';
import { AlertCircle, BookOpen, MessageSquare, Table } from 'lucide-react';
import { useNativeDialog } from './context/NativeDialogContext';

const MainLayout: React.FC = () => {
  const { showAlert, showConfirm, showToast } = useNativeDialog();
  const [health, setHealth] = useState<HealthStatus | null>(null);
  // Auto-collapse sidebar by default on tablet / mobile screens so workspaces have full width
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    return typeof window !== 'undefined' ? window.innerWidth >= 1280 : false;
  });

  // Dynamically adapt layout to tablet orientation and screen size changes (e.g. Xiaomi Pad 7 3:2 rotation)
  useEffect(() => {
    const handleViewportChange = () => {
      if (window.innerWidth < 1280) {
        setIsSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleViewportChange);
    window.addEventListener('orientationchange', handleViewportChange);
    return () => {
      window.removeEventListener('resize', handleViewportChange);
      window.removeEventListener('orientationchange', handleViewportChange);
    };
  }, []);
  const [isSourcesSidebarOpen, setIsSourcesSidebarOpen] = useState(false);
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [stage, setStage] = useState<PipelineStage>('idle');
  const [viewMode, setViewMode] = useState<'matrix' | 'chat'>('matrix');
  const [mainTab, setMainTab] = useState<MainTabType>('research');

  // Modals
  const [isSkillModalOpen, setIsSkillModalOpen] = useState(false);
  const [isTabletModalOpen, setIsTabletModalOpen] = useState(false);
  const [isObjectiveModalOpen, setIsObjectiveModalOpen] = useState(false);

  // PDF Viewer Modal
  const [viewerVaultId, setViewerVaultId] = useState<string | null>(null);
  const [viewerTitle, setViewerTitle] = useState('');
  const [viewerPage, setViewerPage] = useState<number | null>(null);
  const [viewerSentence, setViewerSentence] = useState<string | null>(null);
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  // Onboarding Tutorial Tour
  const [isTourOpen, setIsTourOpen] = useState(false);

  // Legal Modal
  const [legalModalType, setLegalModalType] = useState<'terms' | 'privacy' | null>(null);

  // Search state & Pagination
  // Persist session ID to localStorage so refreshes don't create a new sidebar entry per search
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    try {
      const stored = localStorage.getItem('rl_active_session_id');
      if (stored) return stored;
    } catch {}
    const id = `session_${Date.now()}`;
    try { localStorage.setItem('rl_active_session_id', id); } catch {}
    return id;
  });
  const [currentTopic, setCurrentTopic] = useState('');
  const [searchOffset, setSearchOffset] = useState(0);
  const [discoveredPapers, setDiscoveredPapers] = useState<RawPaperMetadata[]>([]);
  const [queryHistory, setQueryHistory] = useState<string[]>([]);
  const [selectedPaperIds, setSelectedPaperIds] = useState<Set<string>>(new Set());
  const [reviewResults, setReviewResults] = useState<PipelineResponse | null>(null);
  const [selectedReviewPaper, setSelectedReviewPaper] = useState<ReviewPaper | null>(null);
  const [activeCitationIndex, setActiveCitationIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastRequestParams, setLastRequestParams] = useState<any>(null);

  // Cross-View Citation & Formula Insertion State
  const [pendingCitationPaper, setPendingCitationPaper] = useState<{
    id: string;
    title: string;
    authors?: string[];
    year?: number;
    doi?: string;
  } | null>(null);
  const [pendingFormulaSnippet, setPendingFormulaSnippet] = useState<string | null>(null);
  const [isSpotlightOpen, setIsSpotlightOpen] = useState(false);
  const [isUpdateOpen, setIsUpdateOpen] = useState(false);

  const { activeProvider, activeModel, runtimeKeys, offlineProfile } = useAuth();

  // Dynamic window/document title matching user persona
  useEffect(() => {
    const brand = offlineProfile?.app_identity === 'samhita'
      ? 'Samhita (संहिता) — Vedic Research Matrix'
      : 'ResearchLoom (Samhita) — Autonomous Academic Synthesis';
    document.title = brand;
  }, [offlineProfile?.app_identity]);

  useEffect(() => {
    fetchHealthStatus()
      .then(setHealth)
      .catch((err) => console.warn('Health check warning:', err));

    if (!localStorage.getItem('litbuddy_tour_completed')) {
      setIsTourOpen(true);
    }

    // Restore active review session across page refreshes
    try {
      const saved = localStorage.getItem('litbuddy_active_session');
      if (saved) {
        const data = JSON.parse(saved);
        if (data.sessionId) setActiveSessionId(data.sessionId);
        if (data.currentTopic) setCurrentTopic(data.currentTopic);
        if (data.searchOffset) setSearchOffset(data.searchOffset);
        if (data.discoveredPapers) setDiscoveredPapers(data.discoveredPapers);
        if (data.queryHistory) setQueryHistory(data.queryHistory);
        else if (data.currentTopic) setQueryHistory([data.currentTopic]);
        if (data.selectedPaperIds) setSelectedPaperIds(new Set(data.selectedPaperIds));
        if (data.reviewResults) {
          setReviewResults(data.reviewResults);
          setStage('completed');
          setIsSourcesSidebarOpen(true);
        }
        if (data.viewMode) setViewMode(data.viewMode);
        if (data.mainTab) setMainTab(data.mainTab);
      }
    } catch (e) {
      console.warn('Failed to restore active session:', e);
    }

    // Global Spotlight Keyboard Listener (Ctrl+K or Cmd+K)
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSpotlightOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Rollback Modal State & Last Autosave Timestamp
  const [isRollbackOpen, setIsRollbackOpen] = useState(false);
  const [lastAutosaveTime, setLastAutosaveTime] = useState<Date>(new Date());

  // Function to create a snapshot
  const takeSnapshot = (label: string = 'Autosave Snapshot') => {
    try {
      const now = new Date();
      let flowMapData = null;
      let formulasData = null;
      let dataSheetsData = null;

      try {
        const flowCached = localStorage.getItem('litbuddy_flowmap_active_session');
        if (flowCached) flowMapData = JSON.parse(flowCached);
      } catch {}

      try {
        const formulaCached = localStorage.getItem('litbuddy_formula_blocks');
        if (formulaCached) formulasData = JSON.parse(formulaCached);
      } catch {}

      try {
        const sheetsCached = localStorage.getItem('litbuddy_datasheet_active_project');
        if (sheetsCached) dataSheetsData = JSON.parse(sheetsCached);
      } catch {}

      const newSnapshot: RestoreSnapshot = {
        id: `snap_${Date.now()}`,
        timestamp: now.toISOString(),
        label,
        summary: currentTopic
          ? `Topic: "${currentTopic}" (${discoveredPapers.length} papers in pool)`
          : `Active session with ${discoveredPapers.length} papers`,
        data: {
          flowMap: flowMapData,
          formulas: formulasData,
          dataSheets: dataSheetsData,
          researchSession: {
            currentTopic,
            searchOffset,
            discoveredPapers,
            selectedPaperIds: Array.from(selectedPaperIds),
            reviewResults,
            viewMode,
            mainTab
          }
        }
      };

      const existingRaw = localStorage.getItem('litbuddy_restore_snapshots');
      const existing: RestoreSnapshot[] = existingRaw ? JSON.parse(existingRaw) : [];
      // Keep up to 25 rolling snapshots
      const updated = [newSnapshot, ...existing.slice(0, 24)];
      localStorage.setItem('litbuddy_restore_snapshots', JSON.stringify(updated));
      setLastAutosaveTime(now);
    } catch (e) {
      console.warn('Failed to take autosave snapshot:', e);
    }
  };

  // Safe Exit Guard: Warn user before leaving if unsaved changes exist + final snapshot
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      takeSnapshot('Safe Exit Snapshot');
      if (currentTopic || discoveredPapers.length > 0) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentTopic, discoveredPapers, reviewResults, mainTab]);

  // Periodic 30-Second Continuous Autosave
  useEffect(() => {
    const interval = setInterval(() => {
      takeSnapshot('Continuous 30s Autosave');
    }, 30000);
    return () => clearInterval(interval);
  }, [currentTopic, discoveredPapers, reviewResults, mainTab]);

  // Restore from past snapshot
  const handleRollbackSnapshot = (snapshot: RestoreSnapshot) => {
    try {
      if (snapshot.data.researchSession) {
        const rs = snapshot.data.researchSession;
        if (rs.currentTopic !== undefined) setCurrentTopic(rs.currentTopic);
        if (rs.searchOffset !== undefined) setSearchOffset(rs.searchOffset);
        if (rs.discoveredPapers) setDiscoveredPapers(rs.discoveredPapers);
        if (rs.selectedPaperIds) setSelectedPaperIds(new Set(rs.selectedPaperIds));
        if (rs.reviewResults) setReviewResults(rs.reviewResults);
        if (rs.viewMode) setViewMode(rs.viewMode);
        if (rs.mainTab) setMainTab(rs.mainTab);
      }
      if (snapshot.data.flowMap) {
        localStorage.setItem('litbuddy_flowmap_active_session', JSON.stringify(snapshot.data.flowMap));
      }
      if (snapshot.data.formulas) {
        localStorage.setItem('litbuddy_formula_blocks', JSON.stringify(snapshot.data.formulas));
      }
      if (snapshot.data.dataSheets) {
        localStorage.setItem('litbuddy_datasheet_active_project', JSON.stringify(snapshot.data.dataSheets));
      }
      showToast(`Restored snapshot from ${new Date(snapshot.timestamp).toLocaleTimeString()}`, 'success');
    } catch (err: any) {
      showAlert(`Rollback failed: ${err.message}`, 'Restore Error', 'error');
    }
  };

  // Helper to register or update search history under active session without chat fragmentation
  const recordSearchHistory = (topic: string, count: number, compositeTitle?: string) => {
    try {
      const displayTopic = compositeTitle || topic.trim();
      const sessionKey = activeSessionId;
      const newItem: SavedSearchItem = {
        query_hash: sessionKey,
        topic: displayTopic,
        total_count: count,
        created_at: new Date().toISOString(),
        access_count: 1
      };

      const localListRaw = localStorage.getItem('researchloom_local_searches');
      const localList: SavedSearchItem[] = localListRaw ? JSON.parse(localListRaw) : [];
      // Update entry with matching sessionKey, or prepend new one
      const filtered = localList.filter((s) => s.query_hash !== sessionKey && s.topic.toLowerCase().trim() !== displayTopic.toLowerCase().trim());
      const updated = [newItem, ...filtered].slice(0, 30);
      localStorage.setItem('researchloom_local_searches', JSON.stringify(updated));

      // Dispatch window event so Sidebar updates immediately without full reload
      window.dispatchEvent(new CustomEvent('researchloom_search_saved'));
    } catch (err) {
      console.warn('Could not record search history:', err);
    }
  };

  const handleSearch = async (
    params: {
      topic: string;
      maxResults: number;
      yearMin?: number;
      yearMax?: number;
      noYearConstraint: boolean;
      relevanceThreshold: number;
      mode: 'discover' | 'autonomous';
    },
    isAppend: boolean = false
  ) => {
    setError(null);
    setCurrentTopic(params.topic);
    setLastRequestParams(params);

    const isSameTopic = params.topic.toLowerCase().trim() === currentTopic.toLowerCase().trim();
    const newOffset = isAppend || isSameTopic ? searchOffset + params.maxResults : 0;
    if (!isAppend && !isSameTopic) {
      setSearchOffset(0);
    } else {
      setSearchOffset(newOffset);
    }

    // Collect DOIs to exclude from previous searches
    const existingDois = [
      ...discoveredPapers.map((p) => p.doi || p.id),
      ...(reviewResults ? reviewResults.papers.map((p) => (p as any).doi || p.id) : [])
    ].filter(Boolean);

    const request: SearchRequest = {
      topic: params.topic,
      max_results: params.maxResults,
      offset: newOffset,
      exclude_dois: existingDois,
      year_min: params.yearMin,
      year_max: params.yearMax,
      no_year_constraint: params.noYearConstraint,
      relevance_threshold: params.relevanceThreshold,
      model_provider: activeProvider,
      model_name: activeModel,
      groq_api_key: runtimeKeys.groq,
      gemini_api_key: runtimeKeys.gemini,
      openrouter_api_key: runtimeKeys.openrouter,
      deepseek_api_key: runtimeKeys.deepseek,
      nvidia_api_key: runtimeKeys.nvidia,
      custom_api_key: runtimeKeys.custom,
      custom_base_url: runtimeKeys.custom_base_url
    };

    if (params.mode === 'discover') {
      // Step 1: Candidate Pool Discovery (Iterative Multi-Query Candidate Pooling)
      setStage('discovering');
      if (!isAppend) setReviewResults(null);
      try {
        const response = await discoverPapers(request);

        // Deduplicate papers by normalized DOI or normalized title
        const deduplicatePapers = (list: RawPaperMetadata[]): RawPaperMetadata[] => {
          const seen = new Set<string>();
          const deduped: RawPaperMetadata[] = [];
          for (const p of list) {
            const doiKey = p.doi ? `doi:${p.doi.toLowerCase().trim()}` : null;
            const normTitle = p.title.toLowerCase().replace(/[^a-z0-9]/g, '');
            const titleKey = normTitle.length > 5 ? `title:${normTitle.slice(0, 80)}` : `id:${p.id}`;
            const key = doiKey || titleKey;
            if (!seen.has(key)) {
              seen.add(key);
              deduped.push(p);
            }
          }
          return deduped;
        };

        const currentQuery = params.topic.trim();
        const updatedQueries = queryHistory.includes(currentQuery)
          ? queryHistory
          : [...queryHistory, currentQuery];
        setQueryHistory(updatedQueries);

        let combinedPapers: RawPaperMetadata[] = [];
        if (isAppend || discoveredPapers.length > 0) {
          combinedPapers = deduplicatePapers([...discoveredPapers, ...response.papers]);
        } else {
          combinedPapers = deduplicatePapers(response.papers);
        }

        setDiscoveredPapers(combinedPapers);
        setSelectedPaperIds(new Set(combinedPapers.map((p) => p.id)));
        setStage('idle');

        // Immediately persist to search history and active session
        const compositeTitle = updatedQueries.length > 0 ? updatedQueries.join(' + ') : params.topic;
        recordSearchHistory(params.topic, combinedPapers.length, compositeTitle);
        try {
          const norm = params.topic.toLowerCase().trim();
          localStorage.setItem(`litbuddy_saved_discovery_${norm}`, JSON.stringify({
            topic: params.topic,
            papers: combinedPapers,
            queries: updatedQueries
          }));
          localStorage.setItem('litbuddy_active_session', JSON.stringify({
            sessionId: activeSessionId,
            currentTopic: params.topic,
            searchOffset: newOffset,
            discoveredPapers: combinedPapers,
            queryHistory: updatedQueries,
            selectedPaperIds: combinedPapers.map((p) => p.id),
            reviewResults: null,
            viewMode: 'matrix',
            mainTab: 'research'
          }));
        } catch {}
      } catch (err: any) {
        setStage('error');
        setError(err.message || 'Discovery failed.');
      }
    } else {
      // Direct Autonomous Full Synthesis
      if (!isAppend) setDiscoveredPapers([]);
      setStage('discovering');
      try {
        const triageTimer = setTimeout(() => setStage('triaging'), 1200);
        const extractTimer = setTimeout(() => setStage('extracting'), 3200);

        const response = await runReviewPipeline(request);

        clearTimeout(triageTimer);
        clearTimeout(extractTimer);

        setReviewResults(response);
        setStage('completed');
        setViewMode('chat');
        setIsSourcesSidebarOpen(true);

        // Immediately persist to search history and local review cache
        recordSearchHistory(response.topic, response.total_selected || response.papers.length, response.topic);
        try {
          const norm = response.topic.toLowerCase().trim();
          localStorage.setItem(`litbuddy_saved_review_${norm}`, JSON.stringify(response));
          localStorage.setItem('litbuddy_active_session', JSON.stringify({
            currentTopic: response.topic,
            searchOffset: newOffset,
            discoveredPapers: [],
            selectedPaperIds: [],
            reviewResults: response,
            viewMode: 'chat',
            mainTab: 'research'
          }));
        } catch {}
      } catch (err: any) {
        setStage('error');
        setError(err.message || 'Pipeline execution failed.');
      }
    }
  };

  const handleProceedToSynthesis = async (researchGoal?: string) => {
    if (!lastRequestParams || selectedPaperIds.size === 0) return;

    setIsObjectiveModalOpen(false);
    setError(null);
    setStage('triaging');

    const selectedList = discoveredPapers.filter((p) => selectedPaperIds.has(p.id));

    try {
      const extractTimer = setTimeout(() => setStage('extracting'), 2500);

      // Unify composite topic so synthesis encompasses all pooled keywords
      const compositeTopic = queryHistory.length > 0
        ? Array.from(new Set(queryHistory)).join('; ')
        : (lastRequestParams.topic || currentTopic);

      const response = await runSelectedPipeline({
        topic: compositeTopic,
        research_goal: researchGoal,
        selected_papers: selectedList,
        relevance_threshold: lastRequestParams.relevanceThreshold || 4,
        max_synthesis_count: undefined, // Dynamic: determined by topic relevance & redundancy, not an arbitrary hard cap
        model_provider: activeProvider,
        model_name: activeModel,
        groq_api_key: runtimeKeys.groq,
        gemini_api_key: runtimeKeys.gemini,
        openrouter_api_key: runtimeKeys.openrouter,
        deepseek_api_key: runtimeKeys.deepseek,
        nvidia_api_key: runtimeKeys.nvidia,
        custom_api_key: runtimeKeys.custom,
        custom_base_url: runtimeKeys.custom_base_url
      });

      clearTimeout(extractTimer);
      setReviewResults(response);
      setStage('completed');
      setViewMode('chat');
      setIsSourcesSidebarOpen(true);

      // Immediately save synthesized review and session
      try {
        const norm = response.topic.toLowerCase().trim();
        localStorage.setItem(`litbuddy_saved_review_${norm}`, JSON.stringify(response));
        localStorage.setItem('litbuddy_active_session', JSON.stringify({
          sessionId: activeSessionId,
          currentTopic: response.topic,
          searchOffset,
          discoveredPapers,
          queryHistory,
          selectedPaperIds: Array.from(selectedPaperIds),
          reviewResults: response,
          viewMode: 'chat',
          mainTab: 'research'
        }));

        // Update single notebook entry for this active session
        recordSearchHistory(response.topic, response.total_selected || response.papers.length, compositeTopic);
      } catch {}
    } catch (err: any) {
      setStage('error');
      setError(err.message || 'Synthesis failed.');
    }
  };

  const handleBulkDownload = async (papersToDownload: (RawPaperMetadata | ReviewPaper)[]) => {
    try {
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
      showToast('Bulk ZIP archive generated and downloaded', 'success');
    } catch (err: any) {
      showAlert(err.message || 'Failed to generate bulk ZIP archive', 'Download Error', 'error');
    }
  };

  const resetToNewReview = () => {
    const newId = `session_${Date.now()}`;
    try { localStorage.setItem('rl_active_session_id', newId); } catch {}
    setActiveSessionId(newId);
    setCurrentTopic('');
    setDiscoveredPapers([]);
    setQueryHistory([]);
    setSelectedPaperIds(new Set());
    setReviewResults(null);
    setError(null);
    setStage('idle');
    setViewMode('matrix');
    try {
      localStorage.removeItem('litbuddy_active_session');
    } catch {}
  };

  const handleRemovePooledQuery = (qToRemove: string) => {
    const updated = queryHistory.filter((q) => q.toLowerCase().trim() !== qToRemove.toLowerCase().trim());
    setQueryHistory(updated);
  };

  const handleClearPool = async () => {
    const confirmed = await showConfirm(
      'Are you sure you want to reset the current candidate paper pool? This will clear all discovered papers from the active screening list.',
      'Reset Paper Pool'
    );
    if (confirmed) {
      setDiscoveredPapers([]);
      setSelectedPaperIds(new Set());
      setQueryHistory([]);
      showToast('Candidate paper pool reset', 'info');
    }
  };

  return (
    <div className="min-h-screen flex bg-[#07080a] antigravity-bg text-[#ededed] overflow-hidden relative">
      {/* Subtle Topographic Parallax Canvas */}
      <TopographicBackground />

      {/* 1. Left Sidebar: Gemini Navigation & Chat History */}
      <Sidebar
        isOpen={isSidebarOpen}
        onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
        onNewReview={resetToNewReview}
        activeTab={mainTab}
        onTabChange={setMainTab}
        onOpenSkills={() => setIsSkillModalOpen(true)}
        onOpenTutorial={() => setIsTourOpen(true)}
        onOpenRollback={() => setIsRollbackOpen(true)}
        onOpenUpdate={() => setIsUpdateOpen(true)}
        onSelectTopic={(topic) => {
          setCurrentTopic(topic);
          const norm = topic.toLowerCase().trim();
          try {
            const cached = localStorage.getItem(`litbuddy_saved_review_${norm}`);
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed && parsed.papers && parsed.papers.length > 0) {
                setReviewResults(parsed);
                setStage('completed');
                setViewMode('chat');
                setIsSourcesSidebarOpen(true);
                setQueryHistory([topic]);
                return;
              }
            }
          } catch {}
          try {
            const discCached = localStorage.getItem(`litbuddy_saved_discovery_${norm}`);
            if (discCached) {
              const parsed = JSON.parse(discCached);
              if (parsed && parsed.papers && parsed.papers.length > 0) {
                setDiscoveredPapers(parsed.papers);
                setSelectedPaperIds(new Set(parsed.papers.map((p: any) => p.id)));
                if (parsed.queries && Array.isArray(parsed.queries)) {
                  setQueryHistory(parsed.queries);
                } else {
                  setQueryHistory([topic]);
                }
                setReviewResults(null);
                setStage('idle');
                setViewMode('matrix');
                return;
              }
            }
          } catch {}
          setQueryHistory([topic]);
          handleSearch({
            topic,
            maxResults: 50,
            noYearConstraint: true,
            relevanceThreshold: 4,
            mode: 'discover'
          });
        }}
      />

      {/* 2. Center Workspace Area */}
      <div
        className={`flex-1 flex flex-col transition-all duration-300 min-w-0 ${
          isSidebarOpen ? 'ml-64' : 'ml-0 md:ml-16'
        } ${isSourcesSidebarOpen ? 'mr-80 md:mr-96' : ''}`}
      >
        <Header
          health={health}
          onOpenAssistant={() => setIsAssistantOpen(true)}
          activeTab={mainTab}
          onTabChange={setMainTab}
          onOpenTutorial={() => setIsTourOpen(true)}
          onOpenSkills={() => setIsSkillModalOpen(true)}
          onOpenTabletBridge={() => setIsTabletModalOpen(true)}
          onOpenRollback={() => setIsRollbackOpen(true)}
          lastAutosave={lastAutosaveTime}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          isSidebarOpen={isSidebarOpen}
        />

        {/* Persistent Tab Containers: never unmount to preserve flowmaps, formulas, and studio state */}
        <div className={mainTab === 'references' ? 'flex-1 flex flex-col min-h-0' : 'hidden'}>
          <MasterReferenceManager
            onOpenPdf={(vaultId, title) => {
              setViewerVaultId(vaultId);
              setViewerTitle(title);
              setIsViewerOpen(true);
            }}
            onChatAboutPaper={(paper) => {
              setCurrentTopic(paper.title);
              setViewMode('chat');
              setMainTab('research');
            }}
            onCitePaper={(paper) => {
              setPendingCitationPaper({
                id: paper.id,
                title: paper.title,
                authors: paper.authors,
                year: paper.year,
                doi: paper.doi
              });
              setMainTab('studio');
            }}
          />
        </div>

        <div className={mainTab === 'downloads' ? 'flex-1 flex flex-col min-h-0' : 'hidden'}>
          <DownloadManagerView
            onOpenPdf={(vaultId, title) => {
              setViewerVaultId(vaultId);
              setViewerTitle(title);
              setIsViewerOpen(true);
            }}
          />
        </div>

        <div className={mainTab === 'studio' ? 'flex-1 flex flex-col min-h-0' : 'hidden'}>
          <WritingStudio
            papers={reviewResults?.papers || []}
            candidatePapers={discoveredPapers || []}
            currentTopic={currentTopic}
            incomingCitation={pendingCitationPaper}
            incomingFormulaSnippet={pendingFormulaSnippet}
            onClearIncomingCitation={() => setPendingCitationPaper(null)}
            onClearIncomingFormula={() => setPendingFormulaSnippet(null)}
          />
        </div>

        <div className={mainTab === 'stylus' ? 'flex-1 flex flex-col min-h-0' : 'hidden'}>
          <StylusStudio
            onInsertToStudio={(note) => {
              setPendingFormulaSnippet(note);
              setMainTab('studio');
            }}
            onInsertToFlowMap={(imgUrl) => {
              setMainTab('flow');
            }}
          />
        </div>

        <div className={mainTab === 'flow' ? 'flex-1 flex flex-col min-h-0' : 'hidden'}>
          <FlowMapCanvas
            papers={reviewResults?.papers || []}
            candidatePapers={discoveredPapers || []}
            onOpenPdf={(vaultId, title) => {
              setViewerVaultId(vaultId);
              setViewerTitle(title);
              setIsViewerOpen(true);
            }}
            onCitePaper={(paper) => {
              setPendingCitationPaper(paper);
              setMainTab('studio');
            }}
          />
        </div>

        <div className={mainTab === 'formulas' ? 'flex-1 flex flex-col min-h-0' : 'hidden'}>
          <FormulaStudio
            onInsertToLatex={(snippet) => {
              setPendingFormulaSnippet(snippet);
              setMainTab('studio');
            }}
          />
        </div>

        <div className={mainTab === 'stats' ? 'flex-1 flex flex-col min-h-0' : 'hidden'}>
          <StatisticsStudio />
        </div>

        <div className={mainTab === 'screening' ? 'flex-1 flex flex-col min-h-0' : 'hidden'}>
          <PRISMAFlowDiagram
            papers={discoveredPapers}
            onOpenPdf={(paperId, title) => {
              setViewerVaultId(paperId);
              setViewerTitle(title);
              setIsViewerOpen(true);
            }}
          />
        </div>

        <div className={mainTab === 'matrix' ? 'flex-1 flex flex-col min-h-0' : 'hidden'}>
          <EvidenceMatrixStudio
            papers={reviewResults ? reviewResults.papers : []}
            candidatePapers={discoveredPapers}
            onOpenPdfWithHighlight={(paperId, title, page, sentence) => {
              setViewerVaultId(paperId);
              setViewerTitle(title);
              setViewerPage(page || null);
              setViewerSentence(sentence || null);
              setIsViewerOpen(true);
            }}
          />
        </div>

        <div className={mainTab === 'sheets' ? 'flex-1 flex flex-col min-h-0' : 'hidden'}>
          <DataSheetStudio />
        </div>

        <div className={mainTab === 'research' ? 'flex-1 flex flex-col min-h-0' : 'hidden'}>
          {/* View Toggle Bar (Only shown once papers exist) */}
          {(reviewResults && reviewResults.papers.length > 0) && (
            <div className="px-6 py-2 border-b border-[#3c4043]/50 flex items-center justify-between bg-[#1e1f20]/40 backdrop-blur-xs">
              <div className="flex items-center gap-1 bg-[#171718] p-1 rounded-xl border border-[#3c4043]">
                <button
                  type="button"
                  onClick={() => setViewMode('chat')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    viewMode === 'chat'
                      ? 'bg-[#8ab4f8] text-[#131314]'
                      : 'text-[#9aa0a6] hover:text-[#e3e3e3]'
                  }`}
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Grounded Chat (KaTeX)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewMode('matrix')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    viewMode === 'matrix'
                      ? 'bg-[#8ab4f8] text-[#131314]'
                      : 'text-[#9aa0a6] hover:text-[#e3e3e3]'
                  }`}
                >
                  <Table className="w-3.5 h-3.5" />
                  <span>Review Matrix</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsSourcesSidebarOpen(!isSourcesSidebarOpen)}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-[#282a2c] hover:bg-[#3c4043] border border-[#3c4043] text-xs font-medium text-[#8ab4f8] transition-colors"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>{isSourcesSidebarOpen ? 'Hide Sources' : 'Open Sources & Citations'}</span>
              </button>
            </div>
          )}

          {/* Dynamic Center Stage: Chat or Matrix or Discovery */}
          {viewMode === 'chat' && reviewResults && reviewResults.papers.length > 0 ? (
            <PaperChatArea
              key={currentTopic}
              topic={currentTopic}
              synthesizedPapers={reviewResults.papers}
              candidatePool={discoveredPapers}
              onOpenSources={() => setIsSourcesSidebarOpen(true)}
              onSelectCitation={(idx) => {
                setActiveCitationIndex(idx);
                const target = reviewResults.papers[idx - 1];
                if (target) setSelectedReviewPaper(target);
              }}
              onSearchQuery={(q) => {
                const cleanQ = q.replace(/(state of the art benchmarks|comparative analysis|comparative benchmarks)/gi, '').trim() || q;
                handleSearch({
                  topic: cleanQ,
                  maxResults: 25,
                  noYearConstraint: true,
                  relevanceThreshold: 4,
                  mode: 'discover'
                }, true);
              }}
            />
          ) : (
            <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-8 py-6 flex flex-col overflow-y-auto">
              {/* Hero Section & Gemini Capsule Input */}
              {(!reviewResults && discoveredPapers.length === 0 && stage === 'idle') && (
                <div className="flex-1 flex flex-col justify-center items-center my-auto min-h-[50vh]">
                  <GeminiInputBar
                    onSearch={handleSearch}
                    isLoading={false}
                    initialTopic={currentTopic}
                    onOpenAssistant={() => setIsAssistantOpen(true)}
                  />
                </div>
              )}

              {/* Compact Top Search Bar */}
              {(discoveredPapers.length > 0 || reviewResults || stage !== 'idle') && (
                <div className="mb-6">
                  <GeminiInputBar
                    onSearch={handleSearch}
                    isLoading={stage === 'discovering' || stage === 'triaging' || stage === 'extracting'}
                    initialTopic={currentTopic}
                    onOpenAssistant={() => setIsAssistantOpen(true)}
                  />
                </div>
              )}

              {/* Gemini Minimal Thinking Dropdown */}
              <GeminiThinking stage={stage} />

              {/* Error Notice */}
              {error && (
                <div className="bg-[#f28b82]/10 border border-[#f28b82]/30 rounded-2xl p-4 my-4 flex items-start gap-3 text-[#f28b82] text-xs animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Review Pipeline Notice</p>
                    <p>{error}</p>
                  </div>
                </div>
              )}

              {/* Step 1: Candidate Preview Table */}
              {discoveredPapers.length > 0 && !reviewResults && (
                <div className="animate-fadeIn">
                  <CandidatePreviewTable
                    papers={discoveredPapers}
                    selectedIds={selectedPaperIds}
                    onToggleSelect={(id) => {
                      setSelectedPaperIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(id)) next.delete(id);
                        else next.add(id);
                        return next;
                      });
                    }}
                    onSelectAll={() => setSelectedPaperIds(new Set(discoveredPapers.map((p) => p.id)))}
                    onDeselectAll={() => setSelectedPaperIds(new Set())}
                    onProceedToSynthesis={() => setIsObjectiveModalOpen(true)}
                    onBulkDownload={handleBulkDownload}
                    isProcessing={stage === 'triaging' || stage === 'extracting'}
                    pooledQueries={queryHistory}
                    onRemoveQuery={handleRemovePooledQuery}
                    onClearPool={handleClearPool}
                  />
                </div>
              )}

              {/* Step 2: Final Synthesized Review Matrix */}
              {reviewResults && reviewResults.papers.length > 0 && (
                <div className="animate-fadeIn">
                  <ExportBar papers={reviewResults.papers} topic={currentTopic} />
                  <LiteratureTable
                    papers={reviewResults.papers}
                    onSelectPaper={(paper) => setSelectedReviewPaper(paper)}
                  />
                </div>
              )}

              {/* Empty State */}
              {reviewResults && reviewResults.papers.length === 0 && stage === 'completed' && (
                <div className="rounded-2xl bg-[#1e1f20] border border-[#3c4043] p-12 text-center text-[#9aa0a6] animate-fadeIn my-auto">
                  <BookOpen className="w-10 h-10 mx-auto text-[#9aa0a6] mb-3" />
                  <h4 className="text-sm font-semibold text-[#e3e3e3] mb-1">No Relevant Papers Found</h4>
                  <p className="text-xs max-w-sm mx-auto">
                    Try broadening your query, lowering the minimum relevance threshold, or selecting a wider publication window.
                  </p>
                </div>
              )}
            </main>
          )}
        </div>
      </div>

      {/* 3. Right Sidebar: NotebookLM Sources, Pool & Reference Manager */}
      <SourcesSidebar
        isOpen={isSourcesSidebarOpen}
        onClose={() => setIsSourcesSidebarOpen(false)}
        synthesizedPapers={reviewResults ? reviewResults.papers : []}
        candidatePool={discoveredPapers}
        activeCitationIndex={activeCitationIndex}
        onOpenPdf={(vaultId, title) => {
          setViewerVaultId(vaultId);
          setViewerTitle(title);
          setIsViewerOpen(true);
        }}
        onSelectPaper={(p) => {
          if ('core_problem' in p) {
            setSelectedReviewPaper(p as ReviewPaper);
          }
        }}
        onSearchMore={(q) => {
          handleSearch({
            topic: q,
            maxResults: 25,
            noYearConstraint: true,
            relevanceThreshold: 4,
            mode: 'discover'
          }, true);
        }}
        onBulkDownload={handleBulkDownload}
      />

      {/* Modals & Slide-outs */}
      <PaperDetailModal
        paper={selectedReviewPaper}
        onClose={() => setSelectedReviewPaper(null)}
        onCitePaper={(paper) => {
          setPendingCitationPaper(paper);
          setMainTab('studio');
        }}
      />

      <AssistantChatDrawer
        isOpen={isAssistantOpen}
        onClose={() => setIsAssistantOpen(false)}
        onApplyQuery={(query) => {
          setCurrentTopic(query);
          handleSearch({
            topic: query,
            maxResults: 50,
            noYearConstraint: true,
            relevanceThreshold: 4,
            mode: 'discover'
          });
        }}
      />

      <CookieBanner
        onOpenPrivacy={() => setLegalModalType('privacy')}
        onOpenTerms={() => setLegalModalType('terms')}
      />

      <LegalModal
        isOpen={legalModalType !== null}
        type={legalModalType || 'terms'}
        onClose={() => setLegalModalType(null)}
      />

      <PdfViewerModal
        isOpen={isViewerOpen}
        vaultId={viewerVaultId}
        title={viewerTitle}
        targetPage={viewerPage}
        highlightSentence={viewerSentence}
        onClose={() => {
          setIsViewerOpen(false);
          setViewerVaultId(null);
          setViewerPage(null);
          setViewerSentence(null);
        }}
      />

      <OnboardingTourModal
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
      />

      {/* AI Skills & Agents Modal */}
      <SkillSynthesizerModal
        isOpen={isSkillModalOpen}
        onClose={() => setIsSkillModalOpen(false)}
        onApplySkill={(skill) => {
          setIsAssistantOpen(true);
        }}
      />

      {/* Wireless Tablet Stylus Pairing Modal */}
      <TabletBridgeModal
        isOpen={isTabletModalOpen}
        onClose={() => setIsTabletModalOpen(false)}
      />

      {/* Global Spotlight Omni-Search Modal */}
      <SpotlightModal
        isOpen={isSpotlightOpen}
        onClose={() => setIsSpotlightOpen(false)}
        onOpenStudio={(studioKey) => {
          if (studioKey === 'stylus') setMainTab('stylus');
          else if (studioKey === 'latex') setMainTab('formulas');
          else if (studioKey === 'matrix') setMainTab('matrix');
        }}
        onSelectPaper={(paper) => {
          setSelectedReviewPaper({
            id: paper.id,
            title: paper.title,
            authors: paper.authors || [],
            year: paper.year,
            venue: paper.venue,
            relevance_score: 95,
            triage_rationale: 'Imported via ResearchLoom Omni-Search.',
            core_problem: paper.abstract || 'Literature synthesis',
            methodology: 'Literature Analysis',
            key_findings: 'Direct vault extraction.',
            research_gaps: '',
            critical_remarks: '',
            doi_link: paper.doi ? `https://doi.org/${paper.doi}` : '',
            pdf_downloaded: Boolean(paper.has_pdf),
            source: 'vault'
          });
        }}
      />

      {/* Offline Researcher Profile Modal */}
      <OfflineProfileModal />

      {/* Rollback & Continuous Snapshot Modal */}
      <RollbackHistoryModal
        isOpen={isRollbackOpen}
        onClose={() => setIsRollbackOpen(false)}
        onRollback={handleRollbackSnapshot}
        onTakeManualSnapshot={() => takeSnapshot('Manual Researcher Snapshot')}
      />

      {/* Guided Research Objective Modal */}
      <SynthesisObjectiveModal
        isOpen={isObjectiveModalOpen}
        onClose={() => setIsObjectiveModalOpen(false)}
        onProceed={(goal) => handleProceedToSynthesis(goal)}
        pooledQueries={queryHistory}
        candidateCount={selectedPaperIds.size}
        currentTopic={currentTopic}
      />

      {/* Software Auto-Updater Modal */}
      <UpdateModal
        isOpen={isUpdateOpen}
        onClose={() => setIsUpdateOpen(false)}
      />

      <OnboardingKeyModal />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <MainLayout />
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
