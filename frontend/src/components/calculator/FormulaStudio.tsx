import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Calculator,
  Plus,
  Trash2,
  Copy,
  Sparkles,
  Link2,
  Unlink,
  Check,
  RotateCcw,
  BookOpen,
  ArrowRight,
  Sliders,
  Send,
  Code2,
  X,
  FileCode,
  Layers,
  ChevronDown
} from 'lucide-react';
import katex from 'katex';
import { useNativeDialog } from '../../context/NativeDialogContext';

export interface FormulaVariable {
  id: string;
  symbol: string;
  name: string;
  value: number;
  defaultValue: number;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  sourceFormulaId?: string; // Bound to another block's output
}

export interface FormulaBlock {
  id: string;
  name: string;
  latex: string;
  expression: string;
  variables: FormulaVariable[];
  outputSymbol: string;
  outputUnit: string;
  outputValue: number;
  color: 'emerald' | 'sky' | 'amber' | 'purple' | 'rose' | 'zinc';
  description?: string;
}

const PRESET_FORMULAS: Omit<FormulaBlock, 'id' | 'outputValue'>[] = [
  {
    name: 'Supercavitation Cavitation Number',
    latex: '\\sigma = \\frac{p_\\infty - p_c}{\\frac{1}{2} \\rho v^2}',
    expression: '(p_inf - p_c) / (0.5 * rho * Math.pow(v, 2))',
    variables: [
      { id: 'p_inf', symbol: 'p_\\infty', name: 'Ambient Pressure', value: 101325, defaultValue: 101325, unit: 'Pa', min: 10000, max: 400000, step: 1000 },
      { id: 'p_c', symbol: 'p_c', name: 'Cavity Vapor Pressure', value: 2338, defaultValue: 2338, unit: 'Pa', min: 500, max: 20000, step: 100 },
      { id: 'rho', symbol: '\\rho', name: 'Fluid Density', value: 998, defaultValue: 998, unit: 'kg/m³', min: 500, max: 1500, step: 1 },
      { id: 'v', symbol: 'v', name: 'Flow Velocity', value: 75, defaultValue: 75, unit: 'm/s', min: 5, max: 250, step: 1 }
    ],
    outputSymbol: '\\sigma',
    outputUnit: 'dimensionless',
    color: 'emerald',
    description: 'Governs supercavity inception and closure regime behind a high-speed underwater projectile.'
  },
  {
    name: 'Aerodynamic Drag Resistance',
    latex: 'F_d = \\frac{1}{2} \\rho v^2 C_d A',
    expression: '0.5 * rho * Math.pow(v, 2) * cd * area',
    variables: [
      { id: 'rho', symbol: '\\rho', name: 'Fluid Density', value: 1.225, defaultValue: 1.225, unit: 'kg/m³', min: 0.1, max: 1000, step: 0.1 },
      { id: 'v', symbol: 'v', name: 'Velocity', value: 45, defaultValue: 45, unit: 'm/s', min: 1, max: 200, step: 1 },
      { id: 'cd', symbol: 'C_d', name: 'Drag Coefficient', value: 0.38, defaultValue: 0.38, unit: 'dimensionless', min: 0.05, max: 2.0, step: 0.01 },
      { id: 'area', symbol: 'A', name: 'Cross-Section Area', value: 2.4, defaultValue: 2.4, unit: 'm²', min: 0.1, max: 15, step: 0.1 }
    ],
    outputSymbol: 'F_d',
    outputUnit: 'N',
    color: 'sky',
    description: 'Calculates the hydrodynamic or aerodynamic drag force resisting vehicle motion in fluid.'
  },
  {
    name: 'Reynolds Number',
    latex: 'Re = \\frac{\\rho v L}{\\mu}',
    expression: '(rho * v * length) / mu',
    variables: [
      { id: 'rho', symbol: '\\rho', name: 'Density', value: 998, defaultValue: 998, unit: 'kg/m³', min: 1, max: 1500, step: 1 },
      { id: 'v', symbol: 'v', name: 'Velocity', value: 15, defaultValue: 15, unit: 'm/s', min: 0.1, max: 100, step: 0.5 },
      { id: 'length', symbol: 'L', name: 'Characteristic Length', value: 0.8, defaultValue: 0.8, unit: 'm', min: 0.05, max: 5.0, step: 0.05 },
      { id: 'mu', symbol: '\\mu', name: 'Dynamic Viscosity', value: 0.001002, defaultValue: 0.001002, unit: 'Pa·s', min: 0.0001, max: 0.01, step: 0.0001 }
    ],
    outputSymbol: 'Re',
    outputUnit: 'dimensionless',
    color: 'purple',
    description: 'Dimensionless ratio of inertial to viscous forces indicating laminar vs turbulent boundary layer.'
  },
  {
    name: 'Rayleigh Bubble Wall Expansion',
    latex: '\\dot{R} = \\sqrt{\\frac{2}{3 \\rho} \\left( p_B - p_\\infty \\right)}',
    expression: 'Math.sqrt(Math.max(0, (2 / (3 * rho)) * (pb - p_inf)))',
    variables: [
      { id: 'rho', symbol: '\\rho', name: 'Liquid Density', value: 998, defaultValue: 998, unit: 'kg/m³', min: 500, max: 1500, step: 1 },
      { id: 'pb', symbol: 'p_B', name: 'Internal Bubble Pressure', value: 180000, defaultValue: 180000, unit: 'Pa', min: 1000, max: 1000000, step: 2000 },
      { id: 'p_inf', symbol: 'p_\\infty', name: 'External Ambient Field', value: 101325, defaultValue: 101325, unit: 'Pa', min: 1000, max: 500000, step: 1000 }
    ],
    outputSymbol: '\\dot{R}',
    outputUnit: 'm/s',
    color: 'amber',
    description: 'Inertial expansion rate of a cavitation bubble interface driven by positive pressure disparity.'
  }
];

const THEME_STYLES: Record<string, { border: string; bg: string; badge: string; text: string }> = {
  emerald: {
    border: 'border-emerald-500/30 hover:border-emerald-400/50',
    bg: 'bg-emerald-950/15',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    text: 'text-emerald-400'
  },
  sky: {
    border: 'border-sky-500/30 hover:border-sky-400/50',
    bg: 'bg-sky-950/15',
    badge: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
    text: 'text-sky-400'
  },
  amber: {
    border: 'border-amber-500/30 hover:border-amber-400/50',
    bg: 'bg-amber-950/15',
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    text: 'text-amber-400'
  },
  purple: {
    border: 'border-purple-500/30 hover:border-purple-400/50',
    bg: 'bg-purple-950/15',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    text: 'text-purple-400'
  },
  rose: {
    border: 'border-rose-500/30 hover:border-rose-400/50',
    bg: 'bg-rose-950/15',
    badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    text: 'text-rose-400'
  },
  zinc: {
    border: 'border-zinc-700 hover:border-zinc-500',
    bg: 'bg-zinc-900/40',
    badge: 'bg-zinc-800 text-zinc-300 border-zinc-700',
    text: 'text-zinc-300'
  }
};

interface FormulaStudioProps {
  onInsertToLatex?: (latexSnippet: string) => void;
}

export const FormulaStudio: React.FC<FormulaStudioProps> = ({ onInsertToLatex }) => {
  const { showAlert } = useNativeDialog();
  const [blocks, setBlocks] = useState<FormulaBlock[]>(() => {
    try {
      const saved = localStorage.getItem('litbuddy_formula_blocks');
      if (saved) return JSON.parse(saved);
    } catch {}
    return PRESET_FORMULAS.slice(0, 2).map((p, idx) => ({
      ...p,
      id: `block_${Date.now()}_${idx}`,
      outputValue: 0
    }));
  });

  // AI Modal State
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Formula Pool / Library Browser Modal State
  const [isPoolModalOpen, setIsPoolModalOpen] = useState(false);
  const [formulaPoolSearch, setFormulaPoolSearch] = useState('');

  // Safe AST Math Evaluator (Sandbox without raw eval)
  const evaluateExpression = useCallback((expr: string, scope: Record<string, number>): number => {
    try {
      // Whitelisted Math symbols & variables
      const cleanExpr = expr.replace(/\^/g, '**');
      // Create safe execution scope
      const keys = Object.keys(scope);
      const values = Object.values(scope);
      const func = new Function(...keys, 'Math', `try { return Number(${cleanExpr}); } catch(e) { return NaN; }`);
      const res = func(...values, Math);
      if (typeof res === 'number' && !isNaN(res) && isFinite(res)) {
        return res;
      }
      return 0;
    } catch (e) {
      return 0;
    }
  }, []);

  // Topologically recompute all blocks whenever variables or links change
  useEffect(() => {
    setBlocks((prevBlocks) => {
      let changed = false;
      const updated = prevBlocks.map((b) => ({ ...b, variables: b.variables.map((v) => ({ ...v })) }));

      // Evaluate in topological passes (up to 4 passes for chained blocks)
      for (let pass = 0; pass < 3; pass++) {
        const outputMap: Record<string, number> = {};
        updated.forEach((b) => {
          outputMap[b.id] = b.outputValue;
        });

        updated.forEach((block) => {
          // Sync any bound variables to their source formula output
          const scope: Record<string, number> = {};
          block.variables.forEach((v) => {
            if (v.sourceFormulaId && outputMap[v.sourceFormulaId] !== undefined) {
              const srcVal = outputMap[v.sourceFormulaId];
              if (v.value !== srcVal) {
                v.value = srcVal;
                changed = true;
              }
            }
            scope[v.id] = v.value;
          });

          const newVal = evaluateExpression(block.expression, scope);
          if (Math.abs(block.outputValue - newVal) > 1e-9) {
            block.outputValue = newVal;
            changed = true;
          }
        });
      }

      if (changed) {
        try {
          localStorage.setItem('litbuddy_formula_blocks', JSON.stringify(updated));
        } catch {}
        return updated;
      }
      return prevBlocks;
    });
  }, [evaluateExpression]);

  // Update a single variable value
  const handleVariableChange = (blockId: string, varId: string, val: number) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        const newVars = b.variables.map((v) => (v.id === varId ? { ...v, value: val } : v));
        const scope: Record<string, number> = {};
        newVars.forEach((v) => (scope[v.id] = v.value));
        const newOut = evaluateExpression(b.expression, scope);
        return { ...b, variables: newVars, outputValue: newOut };
      })
    );
  };

  // Bind/Unbind a variable to another formula block
  const handleToggleBinding = (blockId: string, varId: string, sourceId?: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        return {
          ...b,
          variables: b.variables.map((v) =>
            v.id === varId ? { ...v, sourceFormulaId: sourceId || undefined } : v
          )
        };
      })
    );
  };

  // Add a preset formula
  const handleAddPreset = (presetIndex: number) => {
    const preset = PRESET_FORMULAS[presetIndex];
    const newBlock: FormulaBlock = {
      ...preset,
      id: `block_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      outputValue: 0
    };
    setBlocks((prev) => [...prev, newBlock]);
  };

  // Delete block
  const handleDeleteBlock = (blockId: string) => {
    setBlocks((prev) => prev.filter((b) => b.id !== blockId));
  };

  // Reset block variables to default
  const handleResetBlock = (blockId: string) => {
    setBlocks((prev) =>
      prev.map((b) => {
        if (b.id !== blockId) return b;
        return {
          ...b,
          variables: b.variables.map((v) => ({ ...v, value: v.defaultValue, sourceFormulaId: undefined }))
        };
      })
    );
  };

  // AI Formula Synthesizer
  const handleAiSynthesize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPrompt.trim()) return;

    setIsAiLoading(true);
    try {
      const resp = await fetch('/api/calc/ai-synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt.trim(), provider: 'groq' })
      });

      if (resp.ok) {
        const data = await resp.json();
        const newBlock: FormulaBlock = {
          id: `ai_${Date.now()}`,
          name: data.name,
          latex: data.latex,
          expression: data.expression,
          variables: data.variables.map((v: any) => ({
            ...v,
            value: v.defaultValue
          })),
          outputSymbol: data.outputSymbol || 'y',
          outputUnit: data.outputUnit || 'dimensionless',
          outputValue: 0,
          color: 'sky',
          description: data.description
        };
        setBlocks((prev) => [...prev, newBlock]);
        setIsAiModalOpen(false);
        setAiPrompt('');
      } else {
        showAlert('Could not synthesize formula from prompt. Please try another query.', 'Formula Synthesis', 'warning');
      }
    } catch (err: any) {
      showAlert(`Synthesis error: ${err.message}`, 'Synthesis Error', 'error');
    } finally {
      setIsAiLoading(false);
    }
  };

  // Copy KaTeX / LaTeX Snippet
  const handleCopyLatex = (block: FormulaBlock) => {
    const varSubs = block.variables
      .map((v) => `${v.name} (${v.symbol}) = ${v.value} \\text{ ${v.unit || ''}}`)
      .join(', ');
    const snippet = `\\begin{equation}\n  ${block.latex}\n\\end{equation}\n% Where: ${varSubs}\n% Computed ${block.outputSymbol} = ${block.outputValue.toFixed(4)} ${block.outputUnit}`;
    navigator.clipboard.writeText(snippet);
    setCopiedId(block.id);
    setTimeout(() => setCopiedId(null), 2000);
    if (onInsertToLatex) onInsertToLatex(snippet);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-[#07080a] text-zinc-100 overflow-y-auto">
      {/* Top Header Command Bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 bg-[#07080a]/90 backdrop-blur-md border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-emerald-400">
            <Calculator className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              Scientific Formula Studio
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Composable Blocks
              </span>
            </h2>
            <p className="text-xs text-zinc-400">
              Interactive multi-variable analytical models. Chain outputs across formulas or synthesize with AI.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Ask AI to Build Formula */}
          <button
            type="button"
            onClick={() => setIsAiModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-semibold transition-all shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5 text-sky-400" />
            <span>Ask AI to Build Formula</span>
          </button>

          {/* Browse Full Formula Pool Button */}
          <button
            type="button"
            onClick={() => setIsPoolModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl antigravity-glass text-xs font-medium text-emerald-300 hover:text-white transition-colors border border-emerald-500/20 hover:border-emerald-500/40"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            <span>Formula Pool</span>
          </button>

          {/* Add Preset Dropdown */}
          <div className="relative group">
            <button
              type="button"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl antigravity-glass text-xs font-medium text-zinc-300 hover:text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Presets</span>
              <ChevronDown className="w-3 h-3 text-zinc-500" />
            </button>
            <div className="absolute right-0 mt-1 w-64 rounded-xl antigravity-glass p-1.5 text-xs text-zinc-200 hidden group-hover:block z-50 shadow-2xl border border-white/10 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-2 py-1 text-[10px] font-bold uppercase text-zinc-500">Preset Analytical Models</div>
              {PRESET_FORMULAS.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAddPreset(idx)}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-800 text-zinc-300 hover:text-white transition-colors flex items-center justify-between"
                >
                  <span className="truncate">{p.name}</span>
                  <Plus className="w-3 h-3 text-zinc-500" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Blocks Grid */}
      <div className="p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-6">
        {blocks.map((block) => {
          const theme = THEME_STYLES[block.color || 'emerald'] || THEME_STYLES.emerald;
          let renderedLatex = '';
          try {
            renderedLatex = katex.renderToString(block.latex, { displayMode: true, throwOnError: false });
          } catch {
            renderedLatex = block.latex;
          }

          // Format output value
          const formattedOutput =
            Math.abs(block.outputValue) < 0.001 || Math.abs(block.outputValue) >= 1e5
              ? block.outputValue.toExponential(3)
              : block.outputValue.toFixed(4);

          return (
            <div
              key={block.id}
              className={`rounded-2xl antigravity-card p-5 border ${theme.border} ${theme.bg} shadow-xl flex flex-col justify-between transition-all`}
            >
              <div>
                {/* Header: Title + Output Badge + Actions */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b border-zinc-800/80">
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-100 leading-snug">{block.name}</h3>
                    {block.description && (
                      <p className="text-[11px] text-zinc-400 mt-0.5 line-clamp-1">{block.description}</p>
                    )}
                  </div>

                  {/* Calculated Output Pill */}
                  <div className="flex items-center gap-1.5">
                    <div className={`px-2.5 py-1 rounded-xl border text-xs font-mono font-bold flex items-center gap-1.5 ${theme.badge}`}>
                      <span className="opacity-70">{block.outputSymbol} =</span>
                      <span>{formattedOutput}</span>
                      <span className="text-[10px] font-sans font-normal opacity-80">{block.outputUnit}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleResetBlock(block.id)}
                      className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                      title="Reset variables to default"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteBlock(block.id)}
                      className="p-1.5 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
                      title="Delete formula block"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* KaTeX Centered Formula Display */}
                <div
                  className="my-3 py-2 px-3 rounded-xl bg-zinc-950/80 border border-zinc-800/80 overflow-x-auto text-center"
                  dangerouslySetInnerHTML={{ __html: renderedLatex }}
                />

                {/* Interactive Variables Sliders & Binding Selectors */}
                <div className="space-y-3 mt-3">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                    Input Parameters &amp; Function Chaining
                  </div>

                  {block.variables.map((variable) => {
                    const isBound = Boolean(variable.sourceFormulaId);
                    const sourceBlock = blocks.find((b) => b.id === variable.sourceFormulaId);

                    return (
                      <div
                        key={variable.id}
                        className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-zinc-300 font-semibold">{variable.symbol}:</span>
                            <span className="text-zinc-400 text-[11px] truncate max-w-[130px]">{variable.name}</span>
                          </div>

                          {/* Function Chain Selector Dropdown */}
                          <div className="flex items-center gap-1.5">
                            {blocks.filter((b) => b.id !== block.id).length > 0 && (
                              <select
                                value={variable.sourceFormulaId || ''}
                                onChange={(e) => handleToggleBinding(block.id, variable.id, e.target.value)}
                                className={`text-[10px] px-1.5 py-0.5 rounded border focus:outline-none ${
                                  isBound
                                    ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 font-semibold'
                                    : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                                }`}
                              >
                                <option value="">Manual Input</option>
                                {blocks
                                  .filter((b) => b.id !== block.id)
                                  .map((other) => (
                                    <option key={other.id} value={other.id}>
                                      Chain ← {other.name} ({other.outputSymbol})
                                    </option>
                                  ))}
                              </select>
                            )}

                            {/* Direct Numeric Input */}
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                value={variable.value}
                                disabled={isBound}
                                onChange={(e) =>
                                  handleVariableChange(block.id, variable.id, parseFloat(e.target.value) || 0)
                                }
                                className={`w-20 px-1.5 py-0.5 rounded text-right font-mono text-xs border ${
                                  isBound
                                    ? 'bg-zinc-900 text-emerald-400 border-zinc-800 cursor-not-allowed'
                                    : 'bg-zinc-950 text-zinc-100 border-zinc-800 focus:border-zinc-600'
                                }`}
                              />
                              <span className="text-[10px] text-zinc-500 min-w-[28px]">{variable.unit}</span>
                            </div>
                          </div>
                        </div>

                        {/* Interactive Range Slider */}
                        {!isBound && (
                          <div className="flex items-center gap-2 pt-0.5">
                            <input
                              type="range"
                              min={variable.min !== undefined ? variable.min : 0}
                              max={variable.max !== undefined ? variable.max : variable.defaultValue * 3}
                              step={variable.step || 1}
                              value={variable.value}
                              onChange={(e) =>
                                handleVariableChange(block.id, variable.id, parseFloat(e.target.value))
                              }
                              className="w-full accent-emerald-400 h-1 bg-zinc-800 rounded-lg cursor-pointer"
                            />
                          </div>
                        )}

                        {isBound && sourceBlock && (
                          <div className="text-[10px] text-emerald-400 flex items-center gap-1">
                            <Link2 className="w-3 h-3" />
                            <span>
                              Dynamically synced with <strong>{sourceBlock.name}</strong> ({sourceBlock.outputSymbol} = {sourceBlock.outputValue.toFixed(4)})
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Card Footer: Export & LaTeX Insert */}
              <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => handleCopyLatex(block)}
                  className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition-colors"
                >
                  {copiedId === block.id ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-emerald-400 font-medium">Copied LaTeX!</span>
                    </>
                  ) : (
                    <>
                      <Code2 className="w-3.5 h-3.5" />
                      <span>Copy LaTeX Equation</span>
                    </>
                  )}
                </button>

                {onInsertToLatex && (
                  <button
                    type="button"
                    onClick={() => handleCopyLatex(block)}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 text-[11px] font-medium text-zinc-300 hover:text-white transition-colors border border-zinc-800"
                  >
                    <span>Insert to Paper</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* AI Formula Synthesizer Modal */}
      {isAiModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg rounded-2xl antigravity-card p-6 shadow-2xl border border-white/10 bg-[#0d0e12] space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-semibold text-zinc-100">Ask AI to Build Formula Block</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAiModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Describe any scientific, physics, or mathematical formula in natural language. LitBuddy will parse the variables, construct the executable block, and mount live slider controls.
            </p>

            <form onSubmit={handleAiSynthesize} className="space-y-3">
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="e.g. Formula for cavitation bubble collapse temperature, or Navier-Stokes wall shear stress, or Drag coefficient with angle of attack..."
                rows={3}
                className="w-full bg-zinc-950 rounded-xl p-3 text-xs text-zinc-200 placeholder-zinc-600 border border-zinc-800 focus:outline-none focus:border-sky-500"
              />

              {/* Sample Suggestions */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Cavitation bubble wall velocity',
                  'Drag coefficient with cavitation number',
                  'Bernoulli dynamic pressure equation',
                  'Reynolds number laminar turbulent boundary'
                ].map((sugg, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setAiPrompt(sugg)}
                    className="text-[10px] px-2 py-0.5 rounded-full bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 border border-zinc-800 transition-colors"
                  >
                    {sugg}
                  </button>
                ))}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAiModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAiLoading || !aiPrompt.trim()}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 text-xs font-semibold transition-colors disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
                  <span>{isAiLoading ? 'Synthesizing...' : 'Build Block'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scrollable Formula Pool Browser Modal */}
      {isPoolModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-2xl rounded-2xl antigravity-card p-6 shadow-2xl border border-white/10 bg-[#0d0e12] flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-semibold text-zinc-100">Analytical Formula Pool</h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {PRESET_FORMULAS.length} Models
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsPoolModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="py-3">
              <input
                type="text"
                value={formulaPoolSearch}
                onChange={(e) => setFormulaPoolSearch(e.target.value)}
                placeholder="Search formulas by name, symbol, or physics property..."
                className="w-full bg-zinc-950 rounded-xl px-3.5 py-2 text-xs text-zinc-200 placeholder-zinc-600 border border-zinc-800 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
              {PRESET_FORMULAS.filter((p) =>
                p.name.toLowerCase().includes(formulaPoolSearch.toLowerCase()) ||
                (p.description && p.description.toLowerCase().includes(formulaPoolSearch.toLowerCase())) ||
                p.outputSymbol.toLowerCase().includes(formulaPoolSearch.toLowerCase())
              ).map((preset, idx) => {
                let renderedFormula = '';
                try {
                  renderedFormula = katex.renderToString(preset.latex, { throwOnError: false });
                } catch {
                  renderedFormula = preset.latex;
                }

                return (
                  <div
                    key={idx}
                    className="p-3.5 rounded-xl bg-zinc-900/60 border border-zinc-800/80 hover:border-emerald-500/40 transition-all flex items-center justify-between gap-4 group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-zinc-200">{preset.name}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-400">
                          {preset.outputUnit}
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 line-clamp-1 mb-2">{preset.description}</p>
                      <div
                        className="text-xs text-emerald-400 font-mono overflow-x-auto"
                        dangerouslySetInnerHTML={{ __html: renderedFormula }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        handleAddPreset(idx);
                        setIsPoolModalOpen(false);
                      }}
                      className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Block</span>
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-zinc-800 flex justify-end">
              <button
                type="button"
                onClick={() => setIsPoolModalOpen(false)}
                className="px-4 py-1.5 rounded-xl text-xs font-medium text-zinc-400 hover:text-white"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
