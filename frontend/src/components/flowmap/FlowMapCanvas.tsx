import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Network,
  Plus,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Download,
  Share2,
  Sparkles,
  Layers,
  BookOpen,
  ArrowRight,
  ExternalLink,
  X,
  FileText,
  Search,
  RotateCcw,
  Check,
  GitBranch,
  Quote,
  Folder,
  FolderOpen,
  FolderPlus,
  Compass,
  Move,
  Users,
  Save,
  ChevronDown,
  StickyNote,
  Waypoints,
  AlignLeft,
  Palette
} from 'lucide-react';
import { ReviewPaper, RawPaperMetadata } from '../../types';
import { CollabRoomModal } from './CollabRoomModal';
import { FlowContextMenu } from './FlowContextMenu';
import { PaperPoolSelectorModal } from './PaperPoolSelectorModal';
import { useNativeDialog } from '../../context/NativeDialogContext';

export interface FlowNode {
  id: string;
  type: 'paper' | 'folder' | 'note' | 'frame';
  title: string;
  subtitle?: string;
  year?: number;
  authors?: string[];
  doi?: string;
  pdf_url?: string;
  relevance_score?: number;
  is_vaulted?: boolean;
  x: number;
  y: number;
  width?: number;
  height?: number;
  citationsCount?: number;
  abstract?: string;
  core_problem?: string;
  methodology?: string;
  key_findings?: string;
  // Note specific attributes
  content?: string;
  color?: 'amber' | 'emerald' | 'blue' | 'purple' | 'rose' | 'zinc';
  // Folder specific attributes
  isCollapsed?: boolean;
  childPaperIds?: string[];
  childPapers?: Array<{ id: string; title: string; authors?: string[]; year?: number; doi?: string; pdf_url?: string }>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: 'cites' | 'user_connection' | 'trail' | 'supporting' | 'contrasting' | 'mentioning';
}

export interface SavedCanvas {
  id: string;
  title: string;
  topic: string;
  nodes_json: string;
  edges_json: string;
  viewport_json: string;
  updated_at?: string;
}

interface FlowMapCanvasProps {
  papers: ReviewPaper[];
  candidatePapers?: RawPaperMetadata[];
  onOpenPdf?: (paperId: string, title: string) => void;
  onCitePaper?: (paper: { id: string; title: string; authors: string[]; year?: number; doi?: string }) => void;
}

const NOTE_COLORS: Record<string, { border: string; bg: string; dot: string; title: string }> = {
  amber: {
    border: 'border-amber-500/30 hover:border-amber-400/50',
    bg: 'bg-amber-950/15',
    dot: 'bg-amber-400',
    title: 'text-amber-200'
  },
  emerald: {
    border: 'border-emerald-500/30 hover:border-emerald-400/50',
    bg: 'bg-emerald-950/15',
    dot: 'bg-emerald-400',
    title: 'text-emerald-200'
  },
  blue: {
    border: 'border-sky-500/30 hover:border-sky-400/50',
    bg: 'bg-sky-950/15',
    dot: 'bg-sky-400',
    title: 'text-sky-200'
  },
  purple: {
    border: 'border-purple-500/30 hover:border-purple-400/50',
    bg: 'bg-purple-950/15',
    dot: 'bg-purple-400',
    title: 'text-purple-200'
  },
  rose: {
    border: 'border-rose-500/30 hover:border-rose-400/50',
    bg: 'bg-rose-950/15',
    dot: 'bg-rose-400',
    title: 'text-rose-200'
  },
  zinc: {
    border: 'border-zinc-700 hover:border-zinc-500',
    bg: 'bg-zinc-900/40',
    dot: 'bg-zinc-400',
    title: 'text-zinc-200'
  }
};

export const FlowMapCanvas: React.FC<FlowMapCanvasProps> = ({
  papers = [],
  candidatePapers = [],
  onOpenPdf,
  onCitePaper
}) => {
  const { showAlert, showConfirm, showPrompt, showToast } = useNativeDialog();

  // Multi-canvas state
  const [canvases, setCanvases] = useState<SavedCanvas[]>([]);
  const [activeCanvasId, setActiveCanvasId] = useState<string>('default_canvas');
  const [activeCanvasTitle, setActiveCanvasTitle] = useState<string>('Supercavitation Dynamics');
  const [isCanvasDropdownOpen, setIsCanvasDropdownOpen] = useState(false);

  // Graph state
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // User-Driven Custom Trail Builder State
  const [isTrailMode, setIsTrailMode] = useState<boolean>(false);
  const [connectingSourceId, setConnectingSourceId] = useState<string | null>(null);
  const [paperTrailLoading, setPaperTrailLoading] = useState<string | null>(null);

  // Pool selector state
  const [isPoolSelectorOpen, setIsPoolSelectorOpen] = useState(false);

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    targetNode: FlowNode | null;
  }>({
    visible: false,
    x: 0,
    y: 0,
    targetNode: null
  });

  // Navigation gestures: Pan & Zoom
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Node drag state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [nodeDragOffset, setNodeDragOffset] = useState({ x: 0, y: 0 });

  // P2P Collaboration state
  const [isCollabModalOpen, setIsCollabModalOpen] = useState(false);
  const [roomCode] = useState(() => 'LB-' + Math.random().toString(36).substring(2, 8).toUpperCase());
  const [peerConnected, setPeerConnected] = useState(false);
  const [collabMessages, setCollabMessages] = useState<Array<{ sender: string; text: string; time: string }>>([]);

  const containerRef = useRef<HTMLDivElement>(null);

  // Cancel Trail mode on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (connectingSourceId || isTrailMode) {
          setConnectingSourceId(null);
          setIsTrailMode(false);
        }
        if (contextMenu.visible) {
          setContextMenu({ visible: false, x: 0, y: 0, targetNode: null });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [connectingSourceId, isTrailMode, contextMenu.visible]);

  // Fetch saved canvases from backend
  const loadCanvases = useCallback(async () => {
    // 1. Try local storage immediate session first to avoid reset flash
    try {
      const cached = localStorage.getItem('litbuddy_flowmap_active_session');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.nodes && parsed.nodes.length > 0) {
          setNodes(parsed.nodes);
          if (parsed.edges) setEdges(parsed.edges);
          if (parsed.pan) setPan(parsed.pan);
          if (parsed.zoom) setZoom(parsed.zoom);
          if (parsed.activeCanvasTitle) setActiveCanvasTitle(parsed.activeCanvasTitle);
          if (parsed.activeCanvasId) setActiveCanvasId(parsed.activeCanvasId);
        }
      }
    } catch (e) {}

    try {
      const resp = await fetch('/api/flow/canvases');
      if (resp.ok) {
        const data = await resp.json();
        if (Array.isArray(data) && data.length > 0) {
          setCanvases(data);
          const first = data[0];
          setActiveCanvasId(first.id);
          setActiveCanvasTitle(first.title);
          try {
            setNodes(JSON.parse(first.nodes_json || '[]'));
            setEdges(JSON.parse(first.edges_json || '[]'));
            const vp = JSON.parse(first.viewport_json || '{}');
            if (vp.x !== undefined) setPan({ x: vp.x, y: vp.y });
            if (vp.zoom) setZoom(vp.zoom);
            return;
          } catch (e) {}
        }
      }
    } catch (e) {
      console.warn('Failed to load canvases:', e);
    }
    // Fallback: populate from current review / candidate papers cleanly
    initializeFromCurrentSession();
  }, []);

  useEffect(() => {
    loadCanvases();
  }, [loadCanvases]);

  // Persist flow state locally on every change
  useEffect(() => {
    if (nodes.length > 0 || edges.length > 0) {
      try {
        localStorage.setItem(
          'litbuddy_flowmap_active_session',
          JSON.stringify({
            nodes,
            edges,
            pan,
            zoom,
            activeCanvasTitle,
            activeCanvasId
          })
        );
      } catch (e) {}
    }
  }, [nodes, edges, pan, zoom, activeCanvasTitle, activeCanvasId]);

  const initializeFromCurrentSession = useCallback(() => {
    const allItems: any[] = [...papers];
    candidatePapers.forEach((c) => {
      if (!allItems.some((p) => p.title.toLowerCase().trim() === c.title.toLowerCase().trim())) {
        allItems.push(c);
      }
    });

    if (allItems.length === 0) {
      setNodes([]);
      setEdges([]);
      return;
    }

    // Organize items into clean initial columns / grid without random overlapping lines
    const startNodes: FlowNode[] = allItems.slice(0, 16).map((p, idx) => {
      const col = idx % 4;
      const row = Math.floor(idx / 4);
      const authors = Array.isArray(p.authors) ? p.authors : [];
      return {
        id: p.id || `paper_${idx}`,
        type: 'paper',
        title: p.title,
        subtitle: authors.length > 0 ? authors[0] + (authors.length > 1 ? ' et al.' : '') : 'Researcher',
        year: p.year || 2024,
        authors,
        doi: p.doi || p.doi_link,
        pdf_url: p.pdf_url,
        relevance_score: p.relevance_score || 4,
        x: 80 + col * 320,
        y: 80 + row * 200,
        abstract: p.abstract || '',
        core_problem: p.core_problem,
        methodology: p.methodology,
        key_findings: p.key_findings
      };
    });

    setNodes(startNodes);
    setEdges([]); // Clean state: no random wiring! Connections are intentional!
  }, [papers, candidatePapers]);

  // Save current canvas to backend
  const handleSaveCanvas = async () => {
    try {
      const payload = {
        title: activeCanvasTitle,
        nodes_json: JSON.stringify(nodes),
        edges_json: JSON.stringify(edges),
        viewport_json: JSON.stringify({ x: pan.x, y: pan.y, zoom })
      };

      if (activeCanvasId && activeCanvasId !== 'default_canvas') {
        await fetch(`/api/flow/canvases/${activeCanvasId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
      } else {
        const resp = await fetch('/api/flow/canvases', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, topic: activeCanvasTitle })
        });
        if (resp.ok) {
          const created = await resp.json();
          setActiveCanvasId(created.id);
        }
      }
    } catch (e) {
      console.warn('Failed to save canvas:', e);
    }
  };

  const handleCreateNewCanvas = async () => {
    const title = `Topic Canvas ${canvases.length + 1}`;
    try {
      const resp = await fetch('/api/flow/canvases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          topic: title,
          nodes_json: '[]',
          edges_json: '[]',
          viewport_json: '{"x": 0, "y": 0, "zoom": 1}'
        })
      });
      if (resp.ok) {
        const created = await resp.json();
        setCanvases([created, ...canvases]);
        setActiveCanvasId(created.id);
        setActiveCanvasTitle(created.title);
        setNodes([]);
        setEdges([]);
        setPan({ x: 0, y: 0 });
        setZoom(1);
        setIsCanvasDropdownOpen(false);
      }
    } catch (e) {
      console.warn('Error creating canvas:', e);
    }
  };

  const handleSwitchCanvas = (c: SavedCanvas) => {
    setActiveCanvasId(c.id);
    setActiveCanvasTitle(c.title);
    try {
      setNodes(JSON.parse(c.nodes_json || '[]'));
      setEdges(JSON.parse(c.edges_json || '[]'));
      const vp = JSON.parse(c.viewport_json || '{}');
      if (vp.x !== undefined) setPan({ x: vp.x, y: vp.y });
      if (vp.zoom) setZoom(vp.zoom);
    } catch (e) {}
    setIsCanvasDropdownOpen(false);
  };

  const handleDeleteCanvas = async (e: React.MouseEvent, canvasId: string) => {
    e.stopPropagation();
    const confirmed = await showConfirm(
      'Are you sure you want to delete this flow map canvas? This cannot be undone.',
      'Delete Flow Map'
    );
    if (!confirmed) return;

    try {
      const resp = await fetch(`/api/flow/canvases/${canvasId}`, {
        method: 'DELETE'
      });
      if (resp.ok) {
        const remaining = canvases.filter((c) => c.id !== canvasId);
        setCanvases(remaining);

        if (activeCanvasId === canvasId) {
          if (remaining.length > 0) {
            handleSwitchCanvas(remaining[0]);
          } else {
            // No canvases left: reset to clean default session
            setActiveCanvasId('default_canvas');
            setActiveCanvasTitle('Literature Flow Map');
            setNodes([]);
            setEdges([]);
            setPan({ x: 0, y: 0 });
            setZoom(1);
            localStorage.removeItem('litbuddy_flowmap_active_session');
          }
        }
        showToast('Flow map canvas deleted', 'info');
      } else {
        showAlert('Failed to delete canvas from server.', 'Error', 'error');
      }
    } catch (err: any) {
      console.warn('Error deleting canvas:', err);
      showAlert('Network error while deleting canvas.', 'Error', 'error');
    }
  };

  // Trackpad Pinch-to-Zoom & Anchor Zoom Gesture Handler
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Prevent browser zoom if ctrlKey is pressed (trackpad pinch or Ctrl+Scroll wheel)
      if (e.ctrlKey) {
        e.preventDefault();
        // Mouse wheel notches on Windows send deltaY ~100-120; scale down and clamp to max ~0.04 per tick
        const rawDelta = -e.deltaY * 0.0005;
        const clampedDelta = Math.max(-0.04, Math.min(0.04, rawDelta));
        setZoom((prevZoom) => {
          const newZoom = Math.min(Math.max(prevZoom + clampedDelta, 0.25), 2.5);
          return parseFloat(newZoom.toFixed(2));
        });
      }
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Chronological Swimlane Timeline Layout: Snaps papers into horizontal year bands
  const handleTimelineSwimlaneLayout = useCallback(() => {
    if (nodes.length === 0) return;

    // Group papers and nodes by publication year
    const yearGroups: { [year: string]: FlowNode[] } = {};
    const noYearNodes: FlowNode[] = [];

    nodes.forEach((n) => {
      if (n.year) {
        const yStr = String(n.year);
        if (!yearGroups[yStr]) yearGroups[yStr] = [];
        yearGroups[yStr].push(n);
      } else {
        noYearNodes.push(n);
      }
    });

    const sortedYears = Object.keys(yearGroups).sort((a, b) => parseInt(a) - parseInt(b));
    const bandWidth = 360;
    const nodeSpacingY = 180;
    const updated = [...nodes];

    sortedYears.forEach((year, colIdx) => {
      const colX = 120 + colIdx * bandWidth;
      const colNodes = yearGroups[year];
      colNodes.forEach((node, rowIdx) => {
        const target = updated.find((n) => n.id === node.id);
        if (target) {
          target.x = colX;
          target.y = 120 + rowIdx * nodeSpacingY;
        }
      });
    });

    if (noYearNodes.length > 0) {
      const colX = 120 + sortedYears.length * bandWidth;
      noYearNodes.forEach((node, rowIdx) => {
        const target = updated.find((n) => n.id === node.id);
        if (target) {
          target.x = colX;
          target.y = 120 + rowIdx * nodeSpacingY;
        }
      });
    }

    setNodes(updated);
  }, [nodes]);
  // Arranges parent citations, expanded child papers, and mind-map notes into neat topological tiers
  const handleCleanAndOrient = useCallback(() => {
    if (nodes.length === 0) return;

    // Build adjacency list
    const inDegree: { [id: string]: number } = {};
    const adj: { [id: string]: string[] } = {};

    nodes.forEach((n) => {
      inDegree[n.id] = 0;
      adj[n.id] = [];
    });

    edges.forEach((e) => {
      if (adj[e.source]) adj[e.source].push(e.target);
      if (inDegree[e.target] !== undefined) inDegree[e.target]++;
    });

    // Determine topological layers
    const layers: string[][] = [];
    let currentLayer = nodes.filter((n) => inDegree[n.id] === 0).map((n) => n.id);
    const visited = new Set<string>();

    if (currentLayer.length === 0 && nodes.length > 0) {
      currentLayer = [nodes[0].id];
    }

    while (currentLayer.length > 0) {
      layers.push(currentLayer);
      currentLayer.forEach((id) => visited.add(id));

      const nextLayer: string[] = [];
      currentLayer.forEach((id) => {
        (adj[id] || []).forEach((neighbor) => {
          if (!visited.has(neighbor) && !nextLayer.includes(neighbor)) {
            nextLayer.push(neighbor);
          }
        });
      });
      currentLayer = nextLayer;
    }

    // Add unvisited disconnected nodes to the final layer
    const unvisited = nodes.filter((n) => !visited.has(n.id)).map((n) => n.id);
    if (unvisited.length > 0) {
      layers.push(unvisited);
    }

    // Reposition nodes based on computed tiers with row-wrapping to avoid infinite horizontal sprawl
    const MAX_NODES_PER_ROW = 3;
    const colSpacing = 320;
    const cardRowSpacing = 160;
    const updatedNodes = [...nodes];
    let accumulatedY = 80;

    layers.forEach((layerNodes) => {
      const numRowsInLayer = Math.ceil(layerNodes.length / MAX_NODES_PER_ROW);

      layerNodes.forEach((nodeId, idx) => {
        const rowInLayer = Math.floor(idx / MAX_NODES_PER_ROW);
        const colInLayer = idx % MAX_NODES_PER_ROW;
        const countInThisRow = Math.min(MAX_NODES_PER_ROW, layerNodes.length - rowInLayer * MAX_NODES_PER_ROW);
        const rowStartX = Math.max(80, 520 - (countInThisRow * colSpacing) / 2);

        const node = updatedNodes.find((n) => n.id === nodeId);
        if (node) {
          node.x = rowStartX + colInLayer * colSpacing;
          node.y = accumulatedY + rowInLayer * cardRowSpacing;
        }
      });

      accumulatedY += numRowsInLayer * cardRowSpacing + 70;
    });

    setNodes(updatedNodes);
  }, [nodes, edges]);

  // Clean & Orient specifically for an Expanded Folder's Child Papers
  const handleCleanFolderPapers = (folderNode: FlowNode) => {
    if (folderNode.type !== 'folder' || !folderNode.childPaperIds || folderNode.childPaperIds.length === 0) return;

    const childIds = new Set(folderNode.childPaperIds);
    const colSpacing = 310;
    const rowSpacing = 150;
    let childIdx = 0;

    setNodes((prev) =>
      prev.map((n) => {
        if (childIds.has(n.id)) {
          const col = childIdx % 2;
          const row = Math.floor(childIdx / 2);
          childIdx++;
          return {
            ...n,
            x: folderNode.x + 320 + col * colSpacing,
            y: folderNode.y + row * rowSpacing
          };
        }
        return n;
      })
    );
  };

  // User-Driven Trail Connection Handler
  const handleStartOrConnectTrail = (node: FlowNode) => {
    if (!connectingSourceId) {
      // Start a trail chain from this node
      setConnectingSourceId(node.id);
      setIsTrailMode(true);
    } else if (connectingSourceId === node.id) {
      // Clicked same node: deselect
      setConnectingSourceId(null);
    } else {
      // Link previous source to this node
      const newEdge: FlowEdge = {
        id: `edge_trail_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        source: connectingSourceId,
        target: node.id,
        label: 'trail',
        type: 'trail'
      };
      setEdges((prev) => [...prev, newEdge]);
      // Continue trail chain from this target node
      setConnectingSourceId(node.id);
      setIsTrailMode(true);
    }
  };

  // Add a Custom Sticky Note / Mind-Map Card
  const handleAddNote = (x?: number, y?: number, attachToNodeId?: string) => {
    const targetX = x !== undefined ? x : (-pan.x + window.innerWidth / 2 - 140) / zoom;
    const targetY = y !== undefined ? y : (-pan.y + window.innerHeight / 2 - 100) / zoom;

    const newNoteId = `note_${Date.now()}`;
    const newNote: FlowNode = {
      id: newNoteId,
      type: 'note',
      title: 'Mind-Map Note',
      content: '',
      color: 'amber',
      x: targetX,
      y: targetY
    };

    setNodes((prev) => [...prev, newNote]);

    if (attachToNodeId) {
      const newEdge: FlowEdge = {
        id: `edge_note_${Date.now()}`,
        source: attachToNodeId,
        target: newNoteId,
        label: 'note',
        type: 'user_connection'
      };
      setEdges((prev) => [...prev, newEdge]);
    }
  };

  const handleUpdateNodeTitle = (nodeId: string, title: string) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, title } : n)));
  };

  const handleUpdateNodeContent = (nodeId: string, content: string) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, content } : n)));
  };

  const handleUpdateNodeColor = (
    nodeId: string,
    color: 'amber' | 'emerald' | 'blue' | 'purple' | 'rose' | 'zinc'
  ) => {
    setNodes((prev) => prev.map((n) => (n.id === nodeId ? { ...n, color } : n)));
  };

  const handleDeleteEdge = (edgeId: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
  };

  // Paper Trail Citation Parsing (Genuine Academic References)
  const handleTracePaperTrail = async (node: FlowNode) => {
    if (!node.doi) {
      showToast('Paper has no DOI attached for academic citation lookup.', 'warning');
      return;
    }

    setPaperTrailLoading(node.id);
    try {
      const resp = await fetch(`/api/flow/paper-trail?doi=${encodeURIComponent(node.doi)}`);
      if (!resp.ok) throw new Error('Paper trail query failed');
      const data = await resp.json();

      if (data.references && data.references.length > 0) {
        // Group extracted references into a folder hub and expand reference cards cleanly
        const folderId = `folder_refs_${node.id}`;
        const colSpacing = 310;
        const rowSpacing = 150;

        const childNodes: FlowNode[] = data.references.map((cp: any, idx: number) => {
          const col = idx % 2;
          const row = Math.floor(idx / 2);
          return {
            id: cp.id,
            type: 'paper' as const,
            title: cp.title,
            subtitle: cp.authors && cp.authors.length > 0 ? cp.authors[0] + ' et al.' : 'Reference',
            year: cp.year,
            authors: cp.authors,
            doi: cp.doi,
            pdf_url: cp.pdf_url,
            x: node.x + 400 + col * colSpacing,
            y: node.y + (row - 1) * rowSpacing
          };
        });

        const newFolderNode: FlowNode = {
          id: folderId,
          type: 'folder',
          title: `Cited References (${data.references.length})`,
          subtitle: `From: ${node.title.substring(0, 30)}...`,
          x: node.x + 360,
          y: node.y,
          isCollapsed: false,
          childPaperIds: data.references.map((r: any) => r.id),
          childPapers: data.references
        };

        const hubEdge: FlowEdge = {
          id: `edge_${node.id}_${folderId}`,
          source: node.id,
          target: folderId,
          label: 'cites',
          type: 'cites'
        };

        const childEdges: FlowEdge[] = childNodes.map((cn) => ({
          id: `edge_${folderId}_${cn.id}`,
          source: folderId,
          target: cn.id,
          label: 'ref',
          type: 'cites'
        }));

        const existingIds = new Set([folderId, ...childNodes.map((c) => c.id)]);
        const existingEdgeIds = new Set([hubEdge.id, ...childEdges.map((ce) => ce.id)]);

        setNodes((prev) => [
          ...prev.filter((n) => !existingIds.has(n.id)),
          newFolderNode,
          ...childNodes
        ]);
        setEdges((prev) => [
          ...prev.filter((e) => !existingEdgeIds.has(e.id)),
          hubEdge,
          ...childEdges
        ]);
      } else {
        showToast('No open references found for this paper.', 'info');
      }
    } catch (e: any) {
      showAlert(`Could not fetch paper citations: ${e.message}`, 'Citations Error', 'error');
    } finally {
      setPaperTrailLoading(null);
    }
  };

  // Expand / Collapse Folder Node with Clean Multi-Column Orientation
  const handleToggleFolder = (folderNode: FlowNode) => {
    if (folderNode.type !== 'folder') return;
    const isNowCollapsed = !folderNode.isCollapsed;

    if (!isNowCollapsed && folderNode.childPapers) {
      // Expanding: Lay out in clean 2-column grid next to folder
      const colSpacing = 310;
      const rowSpacing = 150;
      const childNodes: FlowNode[] = folderNode.childPapers.map((cp, idx) => {
        const col = idx % 2;
        const row = Math.floor(idx / 2);
        return {
          id: cp.id,
          type: 'paper',
          title: cp.title,
          subtitle: cp.authors && cp.authors.length > 0 ? cp.authors[0] + ' et al.' : 'Reference',
          year: cp.year,
          authors: cp.authors,
          doi: cp.doi,
          pdf_url: cp.pdf_url,
          x: folderNode.x + 320 + col * colSpacing,
          y: folderNode.y + row * rowSpacing
        };
      });

      const childEdges: FlowEdge[] = childNodes.map((cn) => ({
        id: `edge_${folderNode.id}_${cn.id}`,
        source: folderNode.id,
        target: cn.id,
        label: 'ref',
        type: 'cites'
      }));

      setNodes((prev) => [
        ...prev.map((n) => (n.id === folderNode.id ? { ...n, isCollapsed: false } : n)),
        ...childNodes
      ]);
      setEdges((prev) => [...prev, ...childEdges]);
    } else {
      // Collapsing: Remove children from view and retain in folder
      const childIds = new Set(folderNode.childPaperIds || []);
      setNodes((prev) =>
        prev
          .filter((n) => !childIds.has(n.id))
          .map((n) => (n.id === folderNode.id ? { ...n, isCollapsed: true } : n))
      );
      setEdges((prev) =>
        prev.filter((e) => !childIds.has(e.target) && !childIds.has(e.source))
      );
    }
  };

  // Node Dragging Physics and Trail Mode Handling
  const handleNodeMouseDown = (e: React.MouseEvent, node: FlowNode) => {
    e.stopPropagation();

    // If connecting trail mode is active
    if (connectingSourceId) {
      if (connectingSourceId !== node.id) {
        // Create user trail connection
        const newEdge: FlowEdge = {
          id: `edge_trail_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          source: connectingSourceId,
          target: node.id,
          label: 'trail',
          type: 'trail'
        };
        setEdges((prev) => [...prev, newEdge]);
        // Chain to this node!
        setConnectingSourceId(node.id);
      } else {
        setConnectingSourceId(null);
      }
      return;
    }

    if (isTrailMode) {
      // Set as origin of new trail
      setConnectingSourceId(node.id);
      return;
    }

    // Only start dragging — DO NOT open sidebar on single click!
    setDraggingNodeId(node.id);
    setNodeDragOffset({
      x: e.clientX / zoom - node.x,
      y: e.clientY / zoom - node.y
    });
  };

  // Node Double Click Handler: Exclusively opens the side details drawer
  const handleNodeDoubleClick = (e: React.MouseEvent, node: FlowNode) => {
    e.stopPropagation();
    setSelectedNodeId(node.id);
  };

  // Canvas Panning
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (contextMenu.visible) {
      setContextMenu({ visible: false, x: 0, y: 0, targetNode: null });
    }
    // Prevent deselect or pan if clicking inside an interactive element, drawer, toolbar, modal, or form
    const target = e.target as HTMLElement;
    if (target.closest('.antigravity-drawer, .antigravity-glass, button, input, select, textarea, [data-interactive="true"]')) {
      return;
    }
    if (e.button !== 0) return; // Only left click pans
    setIsPanning(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    setSelectedNodeId(null);
  };

  // Canvas Right-Click Handler
  const handleCanvasContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      targetNode: null
    });
  };

  // Node Right-Click Handler
  const handleNodeContextMenu = (e: React.MouseEvent, node: FlowNode) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      targetNode: node
    });
  };

  // Delete node and associated edges
  const handleDeleteNode = (nodeId: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== nodeId));
    setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    if (connectingSourceId === nodeId) setConnectingSourceId(null);
  };

  // Remove citation folder / paper trail
  const handleRemoveTrail = (folderOrPaperId: string) => {
    handleDeleteNode(folderOrPaperId);
  };

  // Open pool selector modal
  const handleInsertPaper = () => {
    setIsPoolSelectorOpen(true);
  };

  const handleSelectPaperFromPool = (selected: {
    id: string;
    title: string;
    subtitle?: string;
    authors?: string[];
    year?: number;
    doi?: string;
    pdf_url?: string;
    abstract?: string;
  }) => {
    const targetX = (-pan.x + window.innerWidth / 2 - 140) / zoom;
    const targetY = (-pan.y + window.innerHeight / 2 - 100) / zoom;

    const newNode: FlowNode = {
      id: selected.id || `pool_paper_${Date.now()}`,
      type: 'paper',
      title: selected.title,
      subtitle: selected.subtitle || (selected.authors && selected.authors.length > 0 ? selected.authors[0] + ' et al.' : 'Research Paper'),
      year: selected.year || new Date().getFullYear(),
      authors: selected.authors || [],
      doi: selected.doi,
      pdf_url: selected.pdf_url,
      x: targetX,
      y: targetY,
      abstract: selected.abstract
    };

    setNodes((prev) => {
      if (prev.some((n) => n.id === newNode.id)) {
        return prev;
      }
      return [...prev, newNode];
    });
  };

  // Create an empty folder node on canvas
  const handleCreateEmptyFolder = async () => {
    const name = await showPrompt('Enter folder name:', 'Citation Cluster', 'Create Cluster Folder', 'e.g. LLM Foundations');
    if (!name || !name.trim()) return;

    const newFolder: FlowNode = {
      id: `folder_${Date.now()}`,
      type: 'folder',
      title: name.trim(),
      subtitle: 'Cluster Group',
      x: (window.innerWidth / 2 - pan.x) / zoom,
      y: (window.innerHeight / 2 - pan.y) / zoom,
      isCollapsed: true,
      childPaperIds: [],
      childPapers: []
    };
    setNodes((prev) => [...prev, newFolder]);
  };

  const dragRafRef = useRef<number | null>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    } else if (draggingNodeId) {
      const clientX = e.clientX;
      const clientY = e.clientY;

      if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current);
      }

      dragRafRef.current = requestAnimationFrame(() => {
        const newX = clientX / zoom - nodeDragOffset.x;
        const newY = clientY / zoom - nodeDragOffset.y;
        setNodes((prev) =>
          prev.map((n) => (n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n))
        );
      });
    }
  };

  const handleMouseUp = () => {
    if (dragRafRef.current) {
      cancelAnimationFrame(dragRafRef.current);
      dragRafRef.current = null;
    }
    setIsPanning(false);
    setDraggingNodeId(null);
  };

  const selectedNode = useMemo(() => {
    return nodes.find((n) => n.id === selectedNodeId) || null;
  }, [nodes, selectedNodeId]);

  return (
    <div
      className="relative w-full h-[calc(100vh-3.5rem)] bg-[#07080a] overflow-hidden select-none"
      onMouseDown={handleCanvasMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={handleCanvasContextMenu}
      ref={containerRef}
    >
      {/* Top Floating Glass Command Bar */}
      <div className="absolute top-4 left-6 right-6 z-30 flex items-center justify-between pointer-events-none">
        {/* Left: Canvas Selector & Actions */}
        <div className="flex items-center gap-2 pointer-events-auto">
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsCanvasDropdownOpen(!isCanvasDropdownOpen)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl antigravity-glass text-xs font-semibold text-zinc-100 hover:border-zinc-600 transition-colors shadow-lg"
            >
              <GitBranch className="w-3.5 h-3.5 text-zinc-400" />
              <span>{activeCanvasTitle}</span>
              <ChevronDown className="w-3 h-3 text-zinc-500" />
            </button>

            {isCanvasDropdownOpen && (
              <div className="absolute left-0 mt-2 w-64 rounded-xl antigravity-glass p-2 text-xs text-zinc-200 z-50 shadow-2xl border border-white/10">
                <div className="text-[10px] uppercase font-bold text-zinc-500 px-2 py-1">Saved Flow Maps</div>
                <div className="max-h-48 overflow-y-auto space-y-1 my-1">
                  {canvases.map((c) => (
                    <div
                      key={c.id}
                      onClick={() => handleSwitchCanvas(c)}
                      className={`w-full px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs transition-colors cursor-pointer group ${
                        c.id === activeCanvasId ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                      }`}
                    >
                      <span className="truncate flex-1 pr-2">{c.title}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        {c.id === activeCanvasId && <Check className="w-3.5 h-3.5 text-emerald-400" />}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCanvas(e, c.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-950/60 text-zinc-500 hover:text-red-400 rounded-md transition"
                          title="Delete this Flow Map"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="border-t border-zinc-800 pt-1.5 flex gap-1">
                  <button
                    type="button"
                    onClick={handleCreateNewCanvas}
                    className="flex-1 flex items-center justify-center gap-1.5 py-1.5 bg-zinc-900 hover:bg-zinc-800 rounded-lg text-zinc-300 font-medium text-[11px]"
                  >
                    <Plus className="w-3 h-3" /> New Canvas
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User-Driven Trail Builder Button */}
          <button
            type="button"
            onClick={() => {
              setIsTrailMode(!isTrailMode);
              if (isTrailMode) setConnectingSourceId(null);
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl antigravity-glass text-xs font-medium transition-all shadow-lg ${
              isTrailMode || connectingSourceId
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 ring-1 ring-emerald-500/30'
                : 'text-zinc-300 hover:text-white'
            }`}
            title="Build custom citation or reasoning trails between papers and notes"
          >
            <Waypoints className={`w-3.5 h-3.5 ${isTrailMode || connectingSourceId ? 'text-emerald-400' : 'text-zinc-400'}`} />
            <span>{isTrailMode || connectingSourceId ? 'Trail Active' : 'Build Trail'}</span>
          </button>

          {/* Add Mind-Map Sticky Note Button */}
          <button
            type="button"
            onClick={() => handleAddNote()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl antigravity-glass text-xs font-medium text-zinc-300 hover:text-amber-300 transition-colors shadow-lg"
            title="Add sticky note or mind-map card to canvas"
          >
            <StickyNote className="w-3.5 h-3.5 text-amber-400" />
            <span>+ Note Card</span>
          </button>

          {/* Clean & Orient Auto-Layout Button */}
          <button
            type="button"
            onClick={handleCleanAndOrient}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl antigravity-glass text-xs font-medium text-zinc-300 hover:text-white transition-colors shadow-lg"
            title="Clean & Orient: Untangle nodes and child papers into balanced tiers"
          >
            <Layers className="w-3.5 h-3.5 text-zinc-400" />
            <span>Clean &amp; Orient</span>
          </button>

          {/* Chronological Timeline Swimlanes Button */}
          <button
            type="button"
            onClick={handleTimelineSwimlaneLayout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl antigravity-glass text-xs font-medium text-zinc-300 hover:text-sky-300 transition-colors shadow-lg"
            title="Timeline View: Snap literature chronologically by publication year"
          >
            <Compass className="w-3.5 h-3.5 text-sky-400" />
            <span>Year Swimlanes</span>
          </button>

          {/* Save Canvas State */}
          <button
            type="button"
            onClick={handleSaveCanvas}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl antigravity-glass text-xs font-medium text-zinc-300 hover:text-white transition-colors shadow-lg"
            title="Save Canvas Layout"
          >
            <Save className="w-3.5 h-3.5 text-zinc-400" />
            <span>Save</span>
          </button>
        </div>

        {/* Right: Collaboration & Controls */}
        <div className="flex items-center gap-2 pointer-events-auto">
          {/* P2P Collaboration Button */}
          <button
            type="button"
            onClick={() => setIsCollabModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl antigravity-glass text-xs font-medium text-zinc-300 hover:text-white transition-colors shadow-lg"
            title="Live Peer-to-Peer Collaboration"
          >
            <Users className="w-3.5 h-3.5 text-zinc-400" />
            <span>Collab</span>
          </button>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 p-1 rounded-xl antigravity-glass shadow-lg">
            <button
              type="button"
              onClick={() => setZoom((z) => Math.max(0.3, z - 0.15))}
              className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="font-mono text-[10px] text-zinc-400 px-1">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => setZoom((z) => Math.min(2.2, z + 0.15))}
              className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => {
                setPan({ x: 0, y: 0 });
                setZoom(1);
              }}
              className="p-1 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Reset View"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Floating Trail Mode Instruction Pill */}
      {(isTrailMode || connectingSourceId) && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-xl antigravity-glass border border-emerald-500/40 text-xs text-zinc-200 flex items-center gap-3 shadow-2xl backdrop-blur-md animate-in fade-in slide-in-from-top-2 duration-200">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-semibold text-emerald-400">Trail Mode:</span>
          <span className="text-zinc-300">
            {connectingSourceId
              ? `Origin set: "${nodes.find((n) => n.id === connectingSourceId)?.title.slice(0, 22)}..." -> Click next node to link step`
              : 'Click any paper or sticky note to start your trail'}
          </span>
          <button
            type="button"
            onClick={() => {
              setConnectingSourceId(null);
              setIsTrailMode(false);
            }}
            className="ml-2 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[11px] text-zinc-200 font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      )}

      {/* SVG Canvas Layer for Smooth Bezier Connectors */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      >
        <defs>
          <marker
            id="arrowhead-white"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="rgba(255, 255, 255, 0.4)" />
          </marker>
          <marker
            id="arrowhead-emerald"
            markerWidth="8"
            markerHeight="6"
            refX="7"
            refY="3"
            orient="auto"
          >
            <polygon points="0 0, 8 3, 0 6" fill="#34d399" />
          </marker>
        </defs>

        {edges.map((edge) => {
          const sourceNode = nodes.find((n) => n.id === edge.source);
          const targetNode = nodes.find((n) => n.id === edge.target);
          if (!sourceNode || !targetNode) return null;

          const startX = sourceNode.x + 280;
          const startY = sourceNode.y + (sourceNode.type === 'note' ? 45 : 60);
          const endX = targetNode.x;
          const endY = targetNode.y + (targetNode.type === 'note' ? 45 : 60);

          const dx = Math.abs(endX - startX) * 0.5;
          const path = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;
          const midX = (startX + endX) / 2;
          const midY = (startY + endY) / 2;

          const isTrail = edge.type === 'trail';
          const isSupporting = edge.type === 'supporting';
          const isContrasting = edge.type === 'contrasting';

          const strokeColor = isTrail
            ? 'rgba(52, 211, 153, 0.75)'
            : isSupporting
            ? 'rgba(34, 197, 94, 0.85)' // Emerald 500
            : isContrasting
            ? 'rgba(239, 68, 68, 0.85)' // Red 500
            : edge.type === 'cites'
            ? 'rgba(255, 255, 255, 0.25)'
            : 'rgba(56, 189, 248, 0.65)';
          const strokeDash = edge.type === 'cites' ? '4 4' : undefined;
          const marker = isTrail || isSupporting ? 'url(#arrowhead-emerald)' : 'url(#arrowhead-white)';

          return (
            <g key={edge.id} className="group">
              <path
                d={path}
                fill="none"
                stroke={strokeColor}
                strokeWidth={isTrail ? '2' : '1.5'}
                strokeDasharray={strokeDash}
                markerEnd={marker}
              />
              {/* Midpoint interactive badge to inspect or remove edge */}
              <g
                transform={`translate(${midX}, ${midY})`}
                className="cursor-pointer opacity-30 hover:opacity-100 transition-opacity pointer-events-auto"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteEdge(edge.id);
                }}
              >
                <rect
                  x="-18"
                  y="-10"
                  width="36"
                  height="20"
                  rx="6"
                  fill="#0c0d10"
                  stroke={isTrail ? '#10b981' : '#3f3f46'}
                  strokeWidth="1"
                />
                <text
                  x="0"
                  y="3"
                  textAnchor="middle"
                  fill="#d4d4d8"
                  fontSize="9"
                  fontFamily="monospace"
                >
                  {isTrail ? 'TRAIL' : '×'}
                </text>
              </g>
            </g>
          );
        })}
      </svg>

      {/* Interactive Flow Nodes Container */}
      <div
        className="absolute inset-0 z-20 pointer-events-auto"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      >
        {nodes.map((node) => {
          const isSelected = node.id === selectedNodeId;
          const isConnectingThis = connectingSourceId === node.id;

          // Note / Mind-Map Card
          if (node.type === 'note') {
            const colorTheme = NOTE_COLORS[node.color || 'amber'] || NOTE_COLORS.amber;

            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleNodeMouseDown(e, node)}
                onDoubleClick={(e) => handleNodeDoubleClick(e, node)}
                onContextMenu={(e) => handleNodeContextMenu(e, node)}
                className={`absolute w-72 rounded-2xl antigravity-card p-3.5 cursor-grab active:cursor-grabbing ${colorTheme.border} ${colorTheme.bg} ${
                  draggingNodeId === node.id ? '' : 'transition-all'
                } ${
                  isSelected ? 'ring-2 ring-zinc-400' : ''
                } ${
                  isConnectingThis ? 'ring-2 ring-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.35)]' : ''
                }`}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`
                }}
              >
                {/* Note Header */}
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800/80">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${colorTheme.dot}`} />
                    <input
                      type="text"
                      value={node.title}
                      onChange={(e) => handleUpdateNodeTitle(node.id, e.target.value)}
                      onMouseDown={(e) => e.stopPropagation()}
                      placeholder="Note Title..."
                      className={`bg-transparent text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-zinc-600 rounded px-1 py-0.5 w-32 truncate ${colorTheme.title}`}
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Color palette pills */}
                    <div className="flex items-center gap-0.5">
                      {(['amber', 'emerald', 'blue', 'purple', 'rose', 'zinc'] as const).map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleUpdateNodeColor(node.id, c);
                          }}
                          className={`w-2.5 h-2.5 rounded-full transition-transform ${NOTE_COLORS[c].dot} ${
                            node.color === c ? 'scale-125 ring-1 ring-white/60' : 'opacity-40 hover:opacity-100'
                          }`}
                          title={`${c} note`}
                        />
                      ))}
                    </div>

                    {/* Trail connector button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartOrConnectTrail(node);
                      }}
                      className={`p-1 rounded-md transition-colors ${
                        isConnectingThis
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }`}
                      title="Link trail step"
                    >
                      <Waypoints className="w-3.5 h-3.5" />
                    </button>

                    {/* Delete note */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteNode(node.id);
                      }}
                      className="p-1 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-md transition-colors"
                      title="Delete note"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Note Multiline Body Textarea */}
                <div className="mt-2" onMouseDown={(e) => e.stopPropagation()}>
                  <textarea
                    value={node.content || ''}
                    onChange={(e) => handleUpdateNodeContent(node.id, e.target.value)}
                    placeholder="Write synthesis note, hypothesis, or methodology remark..."
                    rows={3}
                    className="w-full bg-zinc-950/60 rounded-lg p-2 text-xs text-zinc-200 placeholder-zinc-600 border border-zinc-800/80 focus:outline-none focus:border-zinc-600 resize-y min-h-[64px]"
                  />
                </div>
              </div>
            );
          }

          // Citation Folder Node
          if (node.type === 'folder') {
            return (
              <div
                key={node.id}
                onMouseDown={(e) => handleNodeMouseDown(e, node)}
                onDoubleClick={(e) => handleNodeDoubleClick(e, node)}
                onContextMenu={(e) => handleNodeContextMenu(e, node)}
                className={`absolute w-80 rounded-2xl antigravity-glass p-3.5 cursor-grab active:cursor-grabbing ${
                  draggingNodeId === node.id ? '' : 'transition-all'
                } ${
                  isSelected ? 'ring-2 ring-zinc-400' : 'hover:border-zinc-600'
                } ${
                  isConnectingThis ? 'ring-2 ring-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.35)]' : ''
                }`}
                style={{
                  left: `${node.x}px`,
                  top: `${node.y}px`
                }}
              >
                <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                      {node.isCollapsed ? <Folder className="w-4 h-4 text-zinc-300" /> : <FolderOpen className="w-4 h-4 text-emerald-400" />}
                    </div>
                    <div>
                      <div className="font-semibold text-xs text-zinc-200">{node.title}</div>
                      <div className="text-[10px] text-zinc-500 truncate max-w-[130px]">{node.subtitle}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Orient Expanded Folder Papers Button */}
                    {!node.isCollapsed && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCleanFolderPapers(node);
                        }}
                        className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-[10px] font-medium rounded-lg text-sky-300 transition-colors flex items-center gap-1"
                        title="Clean & Orient child papers into neat columns"
                      >
                        <AlignLeft className="w-3 h-3 text-sky-400" />
                        <span>Orient</span>
                      </button>
                    )}

                    {/* Trail Connector Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartOrConnectTrail(node);
                      }}
                      className={`p-1 rounded-md transition-colors ${
                        isConnectingThis ? 'bg-emerald-500/20 text-emerald-300' : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                      }`}
                      title="Link trail step"
                    >
                      <Waypoints className="w-3.5 h-3.5" />
                    </button>

                    {/* Expand / Collapse Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleFolder(node);
                      }}
                      className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 text-[10px] font-medium rounded-lg text-zinc-200 transition-colors"
                    >
                      {node.isCollapsed ? 'Expand' : 'Collapse'}
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          // Paper Node
          return (
            <div
              key={node.id}
              onMouseDown={(e) => handleNodeMouseDown(e, node)}
              onDoubleClick={(e) => handleNodeDoubleClick(e, node)}
              onContextMenu={(e) => handleNodeContextMenu(e, node)}
              className={`absolute w-72 rounded-xl antigravity-card p-3 cursor-grab active:cursor-grabbing ${
                draggingNodeId === node.id ? '' : 'transition-all'
              } ${
                isSelected ? 'ring-2 ring-zinc-400' : ''
              } ${
                isConnectingThis ? 'ring-2 ring-emerald-400 shadow-[0_0_15px_rgba(52,211,153,0.35)]' : ''
              }`}
              style={{
                left: `${node.x}px`,
                top: `${node.y}px`
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                  {node.year || '2024'}
                </span>
                
                <div className="flex items-center gap-1">
                  {/* Trail connector button */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartOrConnectTrail(node);
                    }}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] transition-colors ${
                      isConnectingThis
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-emerald-300'
                    }`}
                    title="Link step in trail"
                  >
                    <Waypoints className="w-3 h-3" />
                    <span>Trail</span>
                  </button>

                  {/* Parse Cited Paper Trail */}
                  {node.doi && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTracePaperTrail(node);
                      }}
                      disabled={paperTrailLoading === node.id}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400 hover:text-white transition-colors"
                      title="Parse and display cited references"
                    >
                      <Compass className={`w-3 h-3 ${paperTrailLoading === node.id ? 'animate-spin' : ''}`} />
                      <span>Cites</span>
                    </button>
                  )}
                </div>
              </div>

              <h4 className="mt-1.5 font-medium text-xs text-zinc-100 line-clamp-2 leading-snug">
                {node.title}
              </h4>

              <div className="mt-1 flex items-center justify-between text-[11px] text-zinc-500">
                <span className="truncate max-w-[180px]">{node.subtitle}</span>
                {node.pdf_url && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenPdf?.(node.id, node.title);
                    }}
                    className="text-zinc-400 hover:text-zinc-200"
                    title="Read Paper PDF"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Side Details Drawer for Selected Paper */}
      {selectedNode && (
        <div
          className="antigravity-drawer absolute right-6 top-20 bottom-6 w-96 rounded-2xl antigravity-glass p-5 z-40 shadow-2xl flex flex-col justify-between overflow-y-auto border border-white/10 animate-in slide-in-from-right duration-200"
          onMouseDown={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <div>
            <div className="flex items-start justify-between pb-3 border-b border-zinc-800">
              <div>
                <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-zinc-900 text-zinc-400 border border-zinc-800">
                  {selectedNode.year || '2024'}
                </span>
                <h3 className="mt-2 text-sm font-semibold text-zinc-100 leading-snug">
                  {selectedNode.title}
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  {selectedNode.authors?.join(', ') || selectedNode.subtitle}
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedNodeId(null);
                }}
                className="text-zinc-400 hover:text-zinc-200 p-1 rounded-lg hover:bg-zinc-800 transition-colors"
                title="Close Drawer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedNode.type === 'note' && (
              <div className="mt-4">
                <h5 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Note Content</h5>
                <p className="mt-1 text-xs text-zinc-300 leading-relaxed whitespace-pre-wrap">
                  {selectedNode.content || '(Empty Note)'}
                </p>
              </div>
            )}

            {selectedNode.abstract && (
              <div className="mt-4">
                <h5 className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">Abstract</h5>
                <p className="mt-1 text-xs text-zinc-300 leading-relaxed max-h-48 overflow-y-auto">
                  {selectedNode.abstract}
                </p>
              </div>
            )}

            {selectedNode.key_findings && (
              <div className="mt-4 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800">
                <h5 className="text-[11px] font-semibold text-zinc-300">Key Synthesis Findings</h5>
                <p className="mt-1 text-xs text-zinc-400 leading-relaxed">
                  {selectedNode.key_findings}
                </p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-zinc-800 space-y-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleStartOrConnectTrail(selectedNode);
              }}
              className={`w-full py-2.5 px-3 rounded-xl border font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-md ${
                connectingSourceId === selectedNode.id
                  ? 'bg-emerald-500/30 border-emerald-400 text-emerald-200 ring-1 ring-emerald-400'
                  : 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/40 text-emerald-300'
              }`}
            >
              <Waypoints className="w-3.5 h-3.5" />
              <span>
                {connectingSourceId === selectedNode.id
                  ? 'Active Trail Origin (Click next node to link)'
                  : 'Link Step in Trail'}
              </span>
            </button>

            {selectedNode.doi && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleTracePaperTrail(selectedNode);
                }}
                disabled={paperTrailLoading === selectedNode.id}
                className="w-full py-2.5 px-3 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors shadow-md disabled:opacity-50"
              >
                <Compass className={`w-3.5 h-3.5 ${paperTrailLoading === selectedNode.id ? 'animate-spin' : ''}`} />
                <span>
                  {paperTrailLoading === selectedNode.id
                    ? 'Extracting Citation Trail...'
                    : 'Extract Cited Paper Trail'}
                </span>
              </button>
            )}

            {onCitePaper && selectedNode.type === 'paper' && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onCitePaper({
                    id: selectedNode.id,
                    title: selectedNode.title,
                    authors: selectedNode.authors || [],
                    year: selectedNode.year,
                    doi: selectedNode.doi
                  });
                }}
                className="w-full py-2.5 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 hover:border-zinc-500 text-zinc-200 font-medium text-xs flex items-center justify-center gap-2 transition-colors shadow-md"
              >
                <Quote className="w-3.5 h-3.5 text-zinc-300" />
                <span>Cite in Writing Studio</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Collaboration Modal */}
      <CollabRoomModal
        isOpen={isCollabModalOpen}
        onClose={() => setIsCollabModalOpen(false)}
        roomCode={roomCode}
        onJoinRoom={(code) => {
          setPeerConnected(true);
          setCollabMessages((prev) => [
            ...prev,
            { sender: 'System', text: `Connected to peer room ${code}`, time: 'Just now' }
          ]);
        }}
        peerConnected={peerConnected}
        messages={collabMessages}
        onSendMessage={(text) => {
          setCollabMessages((prev) => [
            ...prev,
            { sender: 'You', text, time: 'Just now' }
          ]);
        }}
      />

      {/* Right-Click Glass Context Menu */}
      {contextMenu.visible && (
        <FlowContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          targetNode={contextMenu.targetNode}
          onClose={() => setContextMenu({ visible: false, x: 0, y: 0, targetNode: null })}
          onDeleteNode={handleDeleteNode}
          onRemoveTrail={handleRemoveTrail}
          onCreateFolder={handleCreateEmptyFolder}
          onInsertPaper={handleInsertPaper}
          onAddNote={(x, y, attachToNodeId) => {
            const canvasX = x !== undefined ? (x - pan.x) / zoom : undefined;
            const canvasY = y !== undefined ? (y - pan.y) / zoom : undefined;
            handleAddNote(canvasX, canvasY, attachToNodeId);
          }}
          onStartTrail={handleStartOrConnectTrail}
          onCleanFolderPapers={handleCleanFolderPapers}
          onExtractTrail={handleTracePaperTrail}
          onOpenPdf={onOpenPdf}
          onCitePaper={(n) => {
            onCitePaper?.({
              id: n.id,
              title: n.title,
              authors: n.authors || [],
              year: n.year,
              doi: n.doi
            });
          }}
          onCleanAndOrient={handleCleanAndOrient}
        />
      )}

      {/* Paper Pool & Custom Paper Selector Modal */}
      <PaperPoolSelectorModal
        isOpen={isPoolSelectorOpen}
        onClose={() => setIsPoolSelectorOpen(false)}
        synthesizedPapers={papers}
        candidatePool={candidatePapers}
        onSelectPaper={handleSelectPaperFromPool}
      />
    </div>
  );
};
