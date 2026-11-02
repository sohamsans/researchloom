import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  PenTool,
  Eraser,
  Highlighter,
  RotateCcw,
  Download,
  FileText,
  Network,
  Maximize2,
  Trash2,
  Check,
  ChevronDown,
  Shapes,
  Sparkles
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
  tool: 'pen' | 'highlighter';
  color: string;
  size: number;
  points: Point[];
}

export type EraserMode = 'stroke' | 'pixel';

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

  const [activeTool, setActiveTool] = useState<'pen' | 'highlighter' | 'eraser'>('pen');
  const [eraserMode, setEraserMode] = useState<EraserMode>('stroke');
  const [showEraserMenu, setShowEraserMenu] = useState(false);
  const [color, setColor] = useState<string>('#38bdf8');
  const [baseSize, setBaseSize] = useState<number>(3);
  const [autoSnapShapes, setAutoSnapShapes] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [pixelErasePaths, setPixelErasePaths] = useState<Point[][]>([]);
  const [currentStroke, setCurrentStroke] = useState<Stroke | null>(null);
  const [currentPixelEraser, setCurrentPixelEraser] = useState<Point[] | null>(null);

  // Live Stylus Telemetry HUD (Xiaomi Smart Pen, S-Pen, USI)
  const [stylusType, setStylusType] = useState<string>('Stylus');
  const [isStylusActive, setIsStylusActive] = useState(false);
  const [livePressure, setLivePressure] = useState<number>(0);
  const [notification, setNotification] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 2500);
  };

  // Redraw complete canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const allStrokes = currentStroke ? [...strokes, currentStroke] : strokes;

    for (const stroke of allStrokes) {
      if (stroke.points.length < 1) continue;

      ctx.save();
      if (stroke.tool === 'highlighter') {
        ctx.globalAlpha = 0.35;
        ctx.strokeStyle = stroke.color;
        ctx.lineCap = 'square';
        ctx.lineJoin = 'bevel';
      } else {
        ctx.globalAlpha = 1.0;
        ctx.strokeStyle = stroke.color;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }

      ctx.beginPath();
      const first = stroke.points[0];
      ctx.moveTo(first.x, first.y);

      if (stroke.points.length === 1) {
        ctx.arc(first.x, first.y, stroke.size / 2, 0, Math.PI * 2);
        ctx.fillStyle = stroke.color;
        ctx.fill();
      } else if (stroke.points.length === 2) {
        // Direct clean line (e.g. snapped line)
        const pt = stroke.points[1];
        ctx.lineWidth = stroke.size * 1.5;
        ctx.lineTo(pt.x, pt.y);
        ctx.stroke();
      } else {
        // Catmull-Rom spline smoothed multi-point vector rendering
        for (let i = 1; i < stroke.points.length - 1; i++) {
          const pt = stroke.points[i];
          const next = stroke.points[i + 1];

          const dynamicWidth = stroke.tool === 'highlighter'
            ? stroke.size * 4.5
            : stroke.size * (0.35 + (pt.pressure || 0.5) * 1.65);

          ctx.lineWidth = Math.max(1, dynamicWidth);

          const midX = (pt.x + next.x) / 2;
          const midY = (pt.y + next.y) / 2;
          ctx.quadraticCurveTo(pt.x, pt.y, midX, midY);
        }
        const last = stroke.points[stroke.points.length - 1];
        ctx.lineTo(last.x, last.y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Apply Pixel Eraser passes
    const allPixelErase = currentPixelEraser
      ? [...pixelErasePaths, currentPixelEraser]
      : pixelErasePaths;

    for (const path of allPixelErase) {
      if (path.length < 2) continue;
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = baseSize * 7;

      ctx.beginPath();
      ctx.moveTo(path[0].x, path[0].y);
      for (let i = 1; i < path.length; i++) {
        const midX = (path[i - 1].x + path[i].x) / 2;
        const midY = (path[i - 1].y + path[i].y) / 2;
        ctx.quadraticCurveTo(path[i - 1].x, path[i - 1].y, midX, midY);
      }
      ctx.stroke();
      ctx.restore();
    }
  }, [strokes, currentStroke, pixelErasePaths, currentPixelEraser, baseSize]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Handle responsive canvas resizing across any tablet aspect ratio (Xiaomi Pad 7: 3:2, Samsung: 16:10, iPad: 4:3)
  useEffect(() => {
    const handleResize = () => {
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
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [redraw]);

  // Point-to-segment distance for Stroke Eraser
  const distToSegment = (px: number, py: number, x1: number, y1: number, x2: number, y2: number) => {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  };

  // Stroke erasure detection
  const performStrokeEraseAt = (x: number, y: number, radius: number = 18) => {
    setStrokes((prev) => {
      return prev.filter((stroke) => {
        for (let i = 1; i < stroke.points.length; i++) {
          const p1 = stroke.points[i - 1];
          const p2 = stroke.points[i];
          if (distToSegment(x, y, p1.x, p1.y, p2.x, p2.y) <= radius + stroke.size) {
            return false; // delete entire stroke
          }
        }
        return true;
      });
    });
  };

  // Xiaomi Smart Pen / S-Pen / USI Hardware Pointer Events
  const activePointerIdRef = useRef<number | null>(null);

  // Cycle active tools sequentially with hardware stylus button: Pen -> Highlight -> Stroke Eraser -> Pixel Eraser -> Pen
  const cycleStylusTool = useCallback(() => {
    if (activeTool === 'pen') {
      setActiveTool('highlighter');
      showNotification('Stylus Button: Switched to Highlighter');
    } else if (activeTool === 'highlighter') {
      setActiveTool('eraser');
      setEraserMode('stroke');
      showNotification('Stylus Button: Switched to Stroke Eraser');
    } else if (activeTool === 'eraser' && eraserMode === 'stroke') {
      setActiveTool('eraser');
      setEraserMode('pixel');
      showNotification('Stylus Button: Switched to Pixel Eraser');
    } else {
      setActiveTool('pen');
      showNotification('Stylus Button: Switched to Pressure Pen');
    }
  }, [activeTool, eraserMode]);

  // Geometric Shape Recognition Algorithm (Circle, Ellipse, Rectangle, Triangle, Line)
  const detectGeometricShape = (pts: Point[]): Point[] | null => {
    if (pts.length < 8) return null;

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    pts.forEach((p) => {
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    });

    const w = maxX - minX;
    const h = maxY - minY;
    if (w < 15 && h < 15) return null;

    const startP = pts[0];
    const endP = pts[pts.length - 1];
    const closureDist = Math.hypot(endP.x - startP.x, endP.y - startP.y);
    const maxDim = Math.max(w, h);

    // Compute total path perimeter length
    let pathLength = 0;
    for (let i = 1; i < pts.length; i++) {
      pathLength += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }

    // Straight Line Test: Start-to-end direct distance is >= 90% of total drawn stroke
    const directDist = Math.hypot(endP.x - startP.x, endP.y - startP.y);
    if (directDist / (pathLength || 1) >= 0.90 && directDist > 40) {
      return [
        { x: startP.x, y: startP.y, pressure: startP.pressure },
        { x: endP.x, y: endP.y, pressure: endP.pressure }
      ];
    }

    // Closed loop checks
    const isClosed = closureDist < maxDim * 0.32;
    if (!isClosed) return null;

    // Shoelace area
    let polygonArea = 0;
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      polygonArea += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
    }
    polygonArea = Math.abs(polygonArea / 2);

    // Circularity (Isoperimetric Quotient: 4 * PI * Area / Perimeter^2)
    const circularity = (4 * Math.PI * polygonArea) / (pathLength * pathLength || 1);

    // 1. Circle / Ellipse Detection
    if (circularity > 0.70) {
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;
      const rx = w / 2;
      const ry = h / 2;
      const circlePts: Point[] = [];
      const steps = 40;
      for (let i = 0; i <= steps; i++) {
        const theta = (i / steps) * 2 * Math.PI;
        circlePts.push({
          x: cx + rx * Math.cos(theta),
          y: cy + ry * Math.sin(theta),
          pressure: 0.5
        });
      }
      return circlePts;
    }

    // 2. Corner detection for Triangle vs Rectangle
    const step = Math.max(1, Math.floor(pts.length / 24));
    const downsampled: Point[] = [];
    for (let i = 0; i < pts.length; i += step) {
      downsampled.push(pts[i]);
    }

    let cornerCount = 0;
    for (let i = 1; i < downsampled.length - 1; i++) {
      const p1 = downsampled[i - 1];
      const p2 = downsampled[i];
      const p3 = downsampled[i + 1];

      const a1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
      const a2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
      let diff = Math.abs(((a2 - a1) * 180) / Math.PI);
      if (diff > 180) diff = 360 - diff;

      if (diff > 38) {
        cornerCount++;
        i += 2; // skip immediate neighbours
      }
    }

    const bboxArea = w * h;
    const fillRatio = bboxArea > 0 ? polygonArea / bboxArea : 0;

    // 3. Rectangle / Square Detection
    if ((cornerCount >= 3 && cornerCount <= 6) || fillRatio > 0.70) {
      return [
        { x: minX, y: minY, pressure: 0.5 },
        { x: maxX, y: minY, pressure: 0.5 },
        { x: maxX, y: maxY, pressure: 0.5 },
        { x: minX, y: maxY, pressure: 0.5 },
        { x: minX, y: minY, pressure: 0.5 }
      ];
    }

    // 4. Triangle Detection
    if (cornerCount >= 2 && cornerCount <= 4 && fillRatio < 0.65) {
      return [
        { x: (minX + maxX) / 2, y: minY, pressure: 0.5 },
        { x: maxX, y: maxY, pressure: 0.5 },
        { x: minX, y: maxY, pressure: 0.5 },
        { x: (minX + maxX) / 2, y: minY, pressure: 0.5 }
      ];
    }

    return null;
  };
  // Also listen for native Android bridge custom event 'xiaomi_stylus_button' and expose global window.handleStylusButton
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PageDown' || e.key === 'PageUp' || e.code === 'KeyE') {
        e.preventDefault();
        cycleStylusTool();
      }
    };

    const handleCustomStylus = (e: any) => {
      const action = e.detail?.action;
      if (action === 'PageUp' || action === 'PageDown' || action === 'StylusPrimaryPress') {
        cycleStylusTool();
      } else if (action === 'StylusSecondaryPress') {
        setEraserMode((prev) => (prev === 'stroke' ? 'pixel' : 'stroke'));
        showNotification('Xiaomi Smart Pen: Switched Eraser Mode');
      }
    };

    // Attach to window for Android WebView evaluateJavascript bridge
    (window as any).handleStylusButton = (action: string) => {
      if (action === 'PageUp' || action === 'PageDown' || action === 'StylusPrimaryPress') {
        cycleStylusTool();
      } else if (action === 'StylusSecondaryPress') {
        setEraserMode((prev) => (prev === 'stroke' ? 'pixel' : 'stroke'));
        showNotification('Xiaomi Smart Pen: Switched Eraser Mode');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('xiaomi_stylus_button', handleCustomStylus);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('xiaomi_stylus_button', handleCustomStylus);
      delete (window as any).handleStylusButton;
    };
  }, [cycleStylusTool]);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // Palm Rejection: If an active stylus pen is active, reject multi-touch finger inputs
    if (e.pointerType === 'touch' && isStylusActive) {
      return;
    }

    if (e.pointerType === 'pen') {
      setIsStylusActive(true);
      setStylusType('Active Pen');
    }

    // Hardware Side Button Detection across vendor standards:
    // - Xiaomi Smart Pen & S-Pen barrel button: e.button === 2 OR e.buttons & 2
    // - Physical eraser tip: e.button === 5 OR e.buttons & 32
    const isHardwareButtonHeld = e.button === 2 || (e.buttons & 2) !== 0 || e.button === 5 || (e.buttons & 32) !== 0;

    const effectiveTool = isHardwareButtonHeld ? 'eraser' : activeTool;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = e.pressure !== undefined && e.pressure > 0 ? e.pressure : 0.5;

    activePointerIdRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setLivePressure(pressure);

    if (effectiveTool === 'eraser') {
      if (eraserMode === 'stroke') {
        performStrokeEraseAt(x, y);
      } else {
        setCurrentPixelEraser([{ x, y, pressure }]);
      }
    } else {
      setCurrentStroke({
        id: `stroke_${Date.now()}_${Math.random()}`,
        tool: effectiveTool,
        color,
        size: baseSize,
        points: [{ x, y, pressure, tiltX: e.tiltX, tiltY: e.tiltY }]
      });
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (e.pointerType === 'pen') {
      setIsStylusActive(true);
      setLivePressure(e.pressure || 0);
    }

    if (activePointerIdRef.current !== e.pointerId) return;
    if (e.pointerType === 'touch' && isStylusActive) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const pressure = e.pressure !== undefined && e.pressure > 0 ? e.pressure : 0.5;

    const isHardwareButtonHeld = e.button === 2 || (e.buttons & 2) !== 0 || e.button === 5 || (e.buttons & 32) !== 0;
    const effectiveTool = isHardwareButtonHeld ? 'eraser' : activeTool;

    if (effectiveTool === 'eraser') {
      if (eraserMode === 'stroke') {
        performStrokeEraseAt(x, y);
      } else {
        setCurrentPixelEraser((prev) => (prev ? [...prev, { x, y, pressure }] : [{ x, y, pressure }]));
      }
    } else {
      setCurrentStroke((prev) => {
        if (!prev) return null;
        return {
          ...prev,
          points: [...prev.points, { x, y, pressure, tiltX: e.tiltX, tiltY: e.tiltY }]
        };
      });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (activePointerIdRef.current === e.pointerId) {
      activePointerIdRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}

      if (currentStroke && currentStroke.points.length > 0) {
        let finalStroke = currentStroke;

        // If Shape Recognition is active, attempt to snap the stroke to a clean geometric shape
        if (autoSnapShapes && currentStroke.tool === 'pen') {
          const snappedPoints = detectGeometricShape(currentStroke.points);
          if (snappedPoints) {
            finalStroke = {
              ...currentStroke,
              points: snappedPoints
            };
            showNotification('Snapped to Geometric Shape');
          }
        }

        setStrokes((prev) => [...prev, finalStroke]);
      }
      setCurrentStroke(null);

      if (currentPixelEraser && currentPixelEraser.length > 0) {
        setPixelErasePaths((prev) => [...prev, currentPixelEraser]);
      }
      setCurrentPixelEraser(null);
    }
  };

  const clearCanvas = () => {
    setStrokes([]);
    setPixelErasePaths([]);
    setCurrentStroke(null);
    setCurrentPixelEraser(null);
    showNotification('Canvas cleared');
  };

  const undoLastStroke = () => {
    if (pixelErasePaths.length > 0) {
      setPixelErasePaths((prev) => prev.slice(0, -1));
    } else {
      setStrokes((prev) => prev.slice(0, -1));
    }
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
    if (!canvas || (strokes.length === 0 && pixelErasePaths.length === 0)) {
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
      showNotification('Inserted placeholder to Writing Studio');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-[#07080a] text-zinc-200 select-none overflow-hidden relative">
      {/* Responsive Stylus Command Header */}
      <header className="min-h-12 px-2 sm:px-4 md:px-6 bg-zinc-950/90 border-b border-zinc-800 flex flex-wrap items-center justify-between gap-1.5 sm:gap-2 py-1.5 shrink-0 backdrop-blur-md z-20">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-zinc-900 border border-zinc-700/80 flex items-center justify-center text-sky-400 shrink-0">
            <PenTool className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <h1 className="text-xs sm:text-sm font-semibold text-zinc-100 truncate max-w-[120px] sm:max-w-none">Stylus Studio</h1>
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded-full border shrink-0 ${isStylusActive ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                {isStylusActive ? `${stylusType} (${Math.round(livePressure * 100)}%)` : 'Active Pen'}
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 hidden xl:block truncate">Hardware pressure, S-Pen &amp; Xiaomi Smart Pen buttons, palm rejection</p>
          </div>
        </div>

        {/* Responsive Toolbar */}
        <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap ml-auto">
          {/* Tool Selector */}
          <div className="flex items-center gap-0.5 bg-zinc-900 border border-zinc-800 p-0.5 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTool('pen')}
              className={`px-1.5 sm:px-2 py-1 rounded-lg text-xs flex items-center gap-1 transition ${activeTool === 'pen' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}
              title="Pressure Pen (Tip)"
            >
              <PenTool className="w-3.5 h-3.5 text-sky-400" />
              <span className="hidden sm:inline">Pen</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTool('highlighter')}
              className={`px-1.5 sm:px-2 py-1 rounded-lg text-xs flex items-center gap-1 transition ${activeTool === 'highlighter' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}
              title="Highlighter"
            >
              <Highlighter className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Highlight</span>
            </button>

            {/* Eraser with Stroke / Pixel Sub-menu */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  if (activeTool === 'eraser') {
                    setShowEraserMenu(!showEraserMenu);
                  } else {
                    setActiveTool('eraser');
                  }
                }}
                className={`px-1.5 sm:px-2 py-1 rounded-lg text-xs flex items-center gap-1 transition ${activeTool === 'eraser' ? 'bg-zinc-800 text-white font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}
                title="Eraser (Click again for Stroke vs Pixel options or use Pen Button)"
              >
                <Eraser className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">{eraserMode === 'stroke' ? 'Stroke' : 'Pixel'}</span>
                <ChevronDown className="w-3 h-3 text-zinc-500" />
              </button>

              {showEraserMenu && (
                <div className="absolute top-full left-0 mt-1 w-36 bg-zinc-900 border border-zinc-700 rounded-xl shadow-xl p-1 z-30 animate-in fade-in zoom-in-95 duration-100">
                  <button
                    type="button"
                    onClick={() => {
                      setEraserMode('stroke');
                      setActiveTool('eraser');
                      setShowEraserMenu(false);
                      showNotification('Mode: Stroke Eraser (Deletes entire lines)');
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between ${eraserMode === 'stroke' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-300 hover:bg-zinc-800/60'}`}
                  >
                    <span>Stroke Eraser</span>
                    {eraserMode === 'stroke' && <Check className="w-3.5 h-3.5 text-sky-400" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEraserMode('pixel');
                      setActiveTool('eraser');
                      setShowEraserMenu(false);
                      showNotification('Mode: Pixel Eraser (Erases exact touched pixels)');
                    }}
                    className={`w-full text-left px-2 py-1.5 rounded-lg text-xs flex items-center justify-between ${eraserMode === 'pixel' ? 'bg-zinc-800 text-white font-medium' : 'text-zinc-300 hover:bg-zinc-800/60'}`}
                  >
                    <span>Pixel Eraser</span>
                    {eraserMode === 'pixel' && <Check className="w-3.5 h-3.5 text-sky-400" />}
                  </button>
                </div>
              )}
            </div>

            {/* Shape Recognition Auto-Snap Button */}
            <button
              type="button"
              onClick={() => {
                const nextState = !autoSnapShapes;
                setAutoSnapShapes(nextState);
                showNotification(nextState ? 'Auto-Snap Shapes Enabled' : 'Auto-Snap Shapes Disabled');
              }}
              className={`px-1.5 sm:px-2 py-1 rounded-lg text-xs flex items-center gap-1 transition ${autoSnapShapes ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 font-semibold' : 'text-zinc-400 hover:text-zinc-200'}`}
              title="Auto-Snap hand-drawn strokes into clean geometric shapes (circles, squares, triangles, lines)"
            >
              <Shapes className="w-3.5 h-3.5 text-indigo-400" />
              <span className="hidden md:inline">Snap</span>
            </button>
          </div>

          {/* Color Palette */}
          <div className="flex items-center gap-1 px-1.5 py-1 bg-zinc-900 border border-zinc-800 rounded-xl">
            {PALETTE.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setColor(p.value)}
                style={{ backgroundColor: p.value }}
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full border transition ${color === p.value ? 'scale-125 border-white ring-2 ring-sky-500/50' : 'border-transparent opacity-75 hover:opacity-100'}`}
                title={p.label}
              />
            ))}
          </div>

          {/* Size slider */}
          <div className="hidden xl:flex items-center gap-1.5 px-2 py-1 bg-zinc-900 border border-zinc-800 rounded-xl">
            <span className="text-[10px] font-mono text-zinc-400">Size:</span>
            <input
              type="range"
              min="1"
              max="10"
              value={baseSize}
              onChange={(e) => setBaseSize(parseInt(e.target.value, 10))}
              className="w-14 accent-sky-400 cursor-pointer"
            />
          </div>

          {/* Undo & Clear */}
          <button
            type="button"
            onClick={undoLastStroke}
            disabled={strokes.length === 0 && pixelErasePaths.length === 0}
            className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 disabled:opacity-40 transition cursor-pointer"
            title="Undo"
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

          {/* Output Action buttons */}
          <button
            type="button"
            onClick={transmitToFlowMap}
            className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-100 shadow-xs transition cursor-pointer"
            title="Send to Flow Map"
          >
            <Network className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden lg:inline">To Flow Map</span>
          </button>
          <button
            type="button"
            onClick={exportAsImage}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-semibold shadow-xs transition cursor-pointer"
            title="Export PNG"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Export PNG</span>
          </button>
        </div>
      </header>

      {/* Main Vector Drawing Canvas with Full Dynamic Scaling */}
      <div
        ref={containerRef}
        className="flex-1 w-full h-full relative cursor-crosshair overflow-hidden touch-none"
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className="absolute inset-0 w-full h-full touch-none"
        />

        {/* Ambient Grid for math and drawing layout */}
        <div
          className="absolute inset-0 pointer-events-none opacity-10"
          style={{
            backgroundImage: 'radial-gradient(circle, #71717a 1px, transparent 1px)',
            backgroundSize: '24px 24px'
          }}
        />

        {/* Toast Notification */}
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
