import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  PenTool,
  Eraser,
  Highlighter,
  RotateCcw,
  Download,
  FileText,
  Network,
  Palette,
  Maximize2,
  Trash2,
  Check,
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';

interface Point {
  x: number;
  y: number;
  pressure: number;
  tiltX?: number;
  tiltY?: number;
}

interface Stroke {
  id: string;
  tool: 'pen' | 'highlighter' | 'eraser';
  color: string;
  size: number;
  points: Point[];
}

interface StylusStudioProps {
  onInsertToStudio?: (formulaLatexOrNote: string) => void;
  onInsertToFlowMap?: (drawingDataUrl: string) => void;
}

const PALETTE = [
  { id: 'white', value: '#ffffff', label: 'White' },
  { id: 'sky', value: '#38bdf8', label: 'Sky Blue' },
  { id: 'emerald', value: '#34d399', label: 'Emerald' },
  { id: 'amber', value: '#fbbf24', label: 'Amber' },
  { id: 'rose', value: '#f43f5e', label: 'Rose' },
  { id: 'purple', value: '#c084fc', label: 'Purple' }
];

export const StylusStudio: React.FC<StylusStudioProps> = ({
  onInsertToStudio,
  onInsertToFlowMap
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [tool, setTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [color, setColor] = useState<string>('#38bdf8');
  const [baseSize, setBaseSize] = useState<number>(3);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);

  // Live Stylus Telemetry HUD
  const [isStylusActive, setIsStylusActive] = useState(false);
  const [livePressure, setLivePressure] = useState<number>(0);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2500);
  };

  // Render canvas strokes
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;

    for (const stroke of allStrokes) {
      if (stroke.points.length < 2) continue;

      ctx.save();
      if (stroke.tool === 'highlighter') {
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = stroke.color;
        ctx.lineCap = 'square';
        ctx.lineJoin = 'bevel';
      } else if (stroke.tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      } else {
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = stroke.color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }

      ctx.beginPath();
      const first = stroke.points[0];
      ctx.moveTo(first.x, first.y);

      for (let i = 1; i < stroke.points.length; i++) {
        const pt = stroke.points[i];
        const prev = stroke.points[i - 1];

        // Hardware pressure curve modulation
        const dynamicWidth = stroke.tool === 'highlighter'
          ? stroke.size * 5
          : stroke.size * (0.35 + (pt.pressure || 0.5) * 1.65);

        ctx.lineWidth = Math.max(1, dynamicWidth);

        // Quadratic curve smoothing for smooth active pen strokes
        const midX = (prev.x + pt.x) / 2;
        const midY = (prev.y + pt.y) / 2;
        ctx.quadraticCurveTo(prev.x, prev.y, midX, midY);
      }

      ctx.stroke();
      ctx.restore();
    }
  }, [strokes, currentStroke]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Resize canvas to match display DPI
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = container.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
    }
    redraw();
  }, [redraw]);

  // W3C Pointer Events Level 3 with Strict Palm Rejection
  const activePointerIdRef = useRef<number | null>(null);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Palm rejection: If pen is present, reject finger touch
    if (e.pointerType === 'touch' && isStylusActive) {
      return;
    }

    if (e.pointerType === 'pen') {
      setIsStylusActive(true);
    }

    // Hardware S-Pen side button pressed -> Toggle eraser automatically
    let activeTool = tool;
    if (e.buttons === 32 || e.button === 5) {
      activeTool = 'eraser';
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = e.pressure !== undefined && e.pressure > 0 ? e.pressure : 0.5;

    activePointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);

    setLivePressure(pressure);

    setCurrentStroke({
      id: `stroke_${Date.now()}_${Math.random()}`,
      tool: activeTool,
      color,
      size: baseSize,
      points: [{ x, y, pressure, tiltX: e.tiltX, tiltY: e.tiltY }]
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'pen') {
      setIsStylusActive(true);
      setLivePressure(e.pressure || 0);
    }

    if (!currentStroke || activePointerIdRef.current !== e.pointerId) return;

    // Palm rejection for touch while pen stroke is active
    if (e.pointerType === 'touch' && isStylusActive) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = e.pressure !== undefined && e.pressure > 0 ? e.pressure : 0.5;

    setCurrentStroke((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        points: [...prev.points, { x, y, pressure, tiltX: e.tiltX, tiltY: e.tiltY }]
      };
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current === e.pointerId) {
      activePointerIdRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}

      if (currentStroke && currentStroke.points.length > 1) {
        setStrokes((prev) => [...prev, currentStroke]);
      }
      setCurrentStroke(null);
    }
  };

  const clearCanvas = () => {
    setStrokes([]);
    setCurrentStroke(null);
    showNotification('Canvas cleared');
  };

  const undoLastStroke = () => {
    setStrokes((prev) => prev.slice(0, -1));
  };

  const exportAsImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `researchloom_notes_${Date.now()}.png`;
    a.click();
    showNotification('Exported sketch as PNG');
  };

  const transmitToFlowMap = () => {
    const canvas = canvasRef.current;
    if (!canvas || strokes.length === 0) {
      showNotification('Draw a diagram or formula first!');
      return;
    }
    const url = canvas.toDataURL('image/png');
    if (onInsertToFlowMap) {
      onInsertToFlowMap(url);
      showNotification('Inserted diagram into Flow Map');
    }
  };

  const transmitToStudio = () => {
    if (onInsertToStudio) {
      onInsertToStudio('> [Handwritten Note & Figure]: Annotated via Active Stylus');
      showNotification('Inserted citation placeholder to Writing Studio');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-[#07080a] text-zinc-200 select-none overflow-hidden relative">
      {/* Top Floating Stylus Command Header */}
      <header className="h-14 px-4 sm:px-6 bg-zinc-950/80 border-b border-zinc-800 flex items-center justify-between shrink-0 backdrop-blur-md z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-700/80 flex items-center justify-center text-sky-400">
            <PenTool className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-semibold text-zinc-100">Stylus Studio &amp; Mathematical Scratchpad</h1>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${isStylusActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                {isStylusActive ? `S-Pen Connected (${Math.round(livePressure * 100)}% Pressure)` : 'Active Stylus Ready'}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400">Hardware pressure dynamics, palm rejection, and mathematical sketching</p>
          </div>
        </div>

        {/* Tool selector, colors, and actions */}
        <div className="flex items-center gap-2">
          {/* Tool buttons */}
          <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setTool('pen')}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition ${tool === 'pen' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}
              title="Fine-tip Pressure Pen"
            >
              <PenTool className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Pen</span>
            </button>
            <button
              type="button"
              onClick={() => setTool('highlighter')}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition ${tool === 'highlighter' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}
              title="Translucent Highlighter"
            >
              <Highlighter className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Highlight</span>
            </button>
            <button
              type="button"
              onClick={() => setTool('eraser')}
              className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition ${tool === 'eraser' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}
              title="Precision Eraser"
            >
              <Eraser className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Eraser</span>
            </button>
          </div>

          {/* Palette */}
          <div className="hidden md:flex items-center gap-1.5 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-xl">
            {PALETTE.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setColor(p.value)}
                style={{ backgroundColor: p.value }}
                className={`w-4 h-4 rounded-full border transition ${color === p.value ? 'scale-125 border-white ring-2 ring-sky-500/50' : 'border-transparent opacity-75 hover:opacity-100'}`}
                title={p.label}
              />
            ))}
          </div>

          {/* Stroke size selector */}
          <div className="hidden lg:flex items-center gap-2 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-xl">
            <span className="text-[10px] font-mono text-zinc-400">Size:</span>
            <input
              type="range"
              min="1"
              max="10"
              value={baseSize}
              onChange={(e) => setBaseSize(parseInt(e.target.value, 10))}
              className="w-16 accent-sky-400 cursor-pointer"
            />
          </div>

          {/* Canvas Actions */}
          <button
            type="button"
            onClick={undoLastStroke}
            disabled={strokes.length === 0}
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 disabled:opacity-40 transition cursor-pointer"
            title="Undo Last Stroke"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={clearCanvas}
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 transition cursor-pointer"
            title="Clear Scratchpad"
          >
            <Trash2 className="w-3.5 h-3.5 text-rose-400" />
          </button>

          {/* Integration buttons */}
          <button
            type="button"
            onClick={transmitToFlowMap}
            className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-100 shadow-xs transition cursor-pointer"
            title="Add handwritten diagram directly to Interactive Flow Maps"
          >
            <Network className="w-3.5 h-3.5 text-sky-400" />
            <span>To Flow Map</span>
          </button>
          <button
            type="button"
            onClick={exportAsImage}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold shadow-xs transition cursor-pointer"
            title="Export drawing as high-res PNG image"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export PNG</span>
          </button>
        </div>
      </header>

      {/* Main Vector Drawing Canvas with Palm Rejection */}
      <div ref={containerRef} className="flex-1 w-full h-full relative cursor-crosshair overflow-hidden touch-none">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute inset-0 w-full h-full touch-none"
        />

        {/* Ambient Grid overlay for neat mathematical writing */}
        <div
          className="absolute inset-0 pointer-events-none opacity-15"
          style={{
            backgroundImage: 'radial-gradient(circle, #71717a 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        />

        {/* Status Toast Notification */}
        {notification && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-zinc-900/95 border border-zinc-700 text-xs font-medium text-white shadow-2xl backdrop-blur-md animate-in fade-in zoom-in-95 duration-150 z-30 flex items-center gap-2">
            <Check className="w-3.5 h-3.5 text-emerald-400" />
            <span>{notification}</span>
          </div>
        )}
      </div>
    </div>
  );
};
