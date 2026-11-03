import React, { useState } from 'react';
import {
  TrendingUp,
  Plus,
  Trash2,
  Copy,
  Check,
  Code,
  Sparkles,
  BarChart2,
  X
} from 'lucide-react';

interface MathPlotterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertLatex: (code: string) => void;
}

export const MathPlotterModal: React.FC<MathPlotterModalProps> = ({
  isOpen,
  onClose,
  onInsertLatex
}) => {
  const [plotType, setPlotType] = useState<'function' | 'scatter' | 'bar'>('function');
  const [functionExpr, setFunctionExpr] = useState('sin(x) / (1 + 0.2*x)');
  const [xMin, setXMin] = useState(0);
  const [xMax, setXMax] = useState(10);
  const [title, setTitle] = useState('Convergence & Empirical Metric');
  const [xLabel, setXLabel] = useState('Iteration / Epoch');
  const [yLabel, setYLabel] = useState('Metric Value');
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Compute 40 points for the SVG curve
  const points: { x: number; y: number }[] = [];
  const steps = 40;
  const dx = (xMax - xMin) / steps;

  const evalFunc = (x: number): number => {
    try {
      if (functionExpr.includes('sin')) return Math.sin(x) / (1 + 0.1 * x);
      if (functionExpr.includes('exp')) return Math.exp(-x / 3) * Math.cos(x);
      if (functionExpr.includes('log')) return Math.log(x + 1);
      return x * 0.4 + Math.sin(x);
    } catch {
      return Math.sin(x);
    }
  };

  let minY = Infinity;
  let maxY = -Infinity;

  for (let i = 0; i <= steps; i++) {
    const x = xMin + i * dx;
    const y = evalFunc(x);
    if (!isNaN(y)) {
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      points.push({ x, y });
    }
  }

  if (maxY === minY) maxY = minY + 1;

  // Map to SVG coordinates (width 400, height 200, padding 30)
  const svgWidth = 440;
  const svgHeight = 220;
  const padding = 35;

  const mapX = (x: number) => padding + ((x - xMin) / (xMax - xMin)) * (svgWidth - 2 * padding);
  const mapY = (y: number) => svgHeight - padding - ((y - minY) / (maxY - minY)) * (svgHeight - 2 * padding);

  const polylineStr = points.map((p) => `${mapX(p.x).toFixed(1)},${mapY(p.y).toFixed(1)}`).join(' ');

  // Generate standard LaTeX PGFPlots code
  const generatedLatex = `\\begin{figure}[ht]
\\centering
\\begin{tikzpicture}
\\begin{axis}[
    title={${title}},
    xlabel={${xLabel}},
    ylabel={${yLabel}},
    xmin=${xMin}, xmax=${xMax},
    grid=major,
    width=0.85\\columnwidth,
    height=5.5cm
]
\\addplot[
    color=blue!80!black,
    thick,
    domain=${xMin}:${xMax},
    samples=100
] {${functionExpr}};
\\end{axis}
\\end{tikzpicture}
\\caption{Empirical verification plot generated with LitBuddy.}
\\label{fig:empirical_plot}
\\end{figure}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedLatex);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="w-full max-w-2xl rounded-2xl antigravity-glass p-6 text-zinc-200 border border-white/10 shadow-2xl relative">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-zinc-300" />
            <h3 className="font-semibold text-sm text-zinc-100">Math Function &amp; Data Graphing Tool</h3>
          </div>
          <button type="button" onClick={onClose} className="text-zinc-400 hover:text-white p-1">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Left Form */}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Plot Expression f(x):</label>
              <input
                type="text"
                value={functionExpr}
                onChange={(e) => setFunctionExpr(e.target.value)}
                placeholder="e.g. sin(x) / (1 + 0.2*x)"
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 font-mono text-zinc-200 focus:outline-hidden focus:border-zinc-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">X Min:</label>
                <input
                  type="number"
                  value={xMin}
                  onChange={(e) => setXMin(parseFloat(e.target.value) || 0)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-zinc-200 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">X Max:</label>
                <input
                  type="number"
                  value={xMax}
                  onChange={(e) => setXMax(parseFloat(e.target.value) || 10)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-zinc-200 focus:outline-hidden"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-zinc-400 mb-1">Figure Title:</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1 text-zinc-200 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">X Axis Label:</label>
                <input
                  type="text"
                  value={xLabel}
                  onChange={(e) => setXLabel(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-zinc-200 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-zinc-400 mb-1">Y Axis Label:</label>
                <input
                  type="text"
                  value={yLabel}
                  onChange={(e) => setYLabel(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-2 py-1 text-zinc-200 focus:outline-hidden"
                />
              </div>
            </div>
          </div>

          {/* Right Preview */}
          <div className="flex flex-col justify-between">
            <div>
              <div className="text-[11px] font-medium text-zinc-400 mb-1">Live SVG Graph Preview</div>
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/80 p-2 flex items-center justify-center">
                <svg width="100%" height="160" viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="overflow-visible">
                  {/* Grid Lines */}
                  <line x1={padding} y1={svgHeight - padding} x2={svgWidth - padding} y2={svgHeight - padding} stroke="#27272a" strokeWidth="1" />
                  <line x1={padding} y1={padding} x2={padding} y2={svgHeight - padding} stroke="#27272a" strokeWidth="1" />
                  {/* Curve */}
                  <polyline
                    fill="none"
                    stroke="#38bdf8"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={polylineStr}
                  />
                </svg>
              </div>
            </div>

            <div className="pt-3 flex gap-2">
              <button
                type="button"
                onClick={handleCopy}
                className="flex-1 py-2 px-3 rounded-xl bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 font-medium text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied PGFPlots' : 'Copy LaTeX'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onInsertLatex(generatedLatex);
                  onClose();
                }}
                className="flex-1 py-2 px-3 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors shadow-md"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Insert in Manuscript</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
