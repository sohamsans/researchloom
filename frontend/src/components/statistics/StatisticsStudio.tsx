import React, { useState, useMemo } from 'react';
import {
  BarChart2,
  TrendingUp,
  Activity,
  Layers,
  Copy,
  Check,
  FileCode,
  Download,
  Plus,
  Trash2,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Info,
  CheckCircle2,
  XCircle,
  Sliders
} from 'lucide-react';
import katex from 'katex';
import { useNativeDialog } from '../../context/NativeDialogContext';

type AnalysisTab = 't-test' | 'anova' | 'smoothing' | 'regression';

export const StatisticsStudio: React.FC = () => {
  const { showAlert, showToast } = useNativeDialog();
  const [activeTab, setActiveTab] = useState<AnalysisTab>('t-test');
  const [copiedTikz, setCopiedTikz] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ----------------- State: t-Test -----------------
  const [groupAInput, setGroupAInput] = useState('14.2, 15.1, 14.8, 16.0, 15.5, 14.9, 15.8, 16.2');
  const [groupBInput, setGroupBInput] = useState('12.1, 12.8, 13.0, 11.9, 12.5, 13.2, 12.7, 12.4');
  const [isPaired, setIsPaired] = useState(false);
  const [isEqualVar, setIsEqualVar] = useState(false);
  const [tTestResult, setTTestResult] = useState<any>(null);

  // ----------------- State: ANOVA -----------------
  const [anovaGroups, setAnovaGroups] = useState<Array<{ id: string; name: string; raw: string }>>([
    { id: 'g1', name: 'Baseline Control', raw: '24.2, 25.1, 23.8, 24.9, 25.4, 24.5' },
    { id: 'g2', name: 'Treatment Alpha', raw: '28.4, 29.1, 27.9, 30.2, 29.5, 28.8' },
    { id: 'g3', name: 'Treatment Beta', raw: '33.1, 34.0, 32.8, 33.5, 34.8, 33.9' }
  ]);
  const [anovaResult, setAnovaResult] = useState<any>(null);

  // ----------------- State: Smoothing & Regression -----------------
  const [rawXInput, setRawXInput] = useState('1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15');
  const [rawYInput, setRawYInput] = useState('2.4, 3.8, 5.1, 7.2, 8.9, 12.1, 15.3, 18.0, 22.4, 27.1, 31.8, 37.2, 43.1, 49.5, 56.2');
  const [smoothMethod, setSmoothMethod] = useState<'savgol' | 'moving_avg'>('savgol');
  const [windowSize, setWindowSize] = useState(5);
  const [polyOrder, setPolyOrder] = useState(2);
  const [smoothResult, setSmoothResult] = useState<any>(null);
  const [regressionDegree, setRegressionDegree] = useState(1);
  const [regressionResult, setRegressionResult] = useState<any>(null);

  // Parse comma or newline separated numbers
  const parseNumbers = (text: string): number[] => {
    return text
      .split(/[\s,;\n\t]+/)
      .map((s) => parseFloat(s.trim()))
      .filter((n) => !isNaN(n) && isFinite(n));
  };

  // Run t-Test
  const handleRunTTest = async () => {
    const a = parseNumbers(groupAInput);
    const b = parseNumbers(groupBInput);
    if (a.length < 2 || b.length < 2) {
      showAlert('Each group must have at least 2 numbers.', 'Input Validation', 'warning');
      return;
    }
    setIsLoading(true);
    try {
      const resp = await fetch('/api/stats/t-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          group_a: a,
          group_b: b,
          paired: isPaired,
          equal_var: isEqualVar
        })
      });
      if (resp.ok) {
        setTTestResult(await resp.json());
        showToast('t-Test computation complete', 'success');
      } else {
        const err = await resp.json();
        showAlert(`t-Test calculation error: ${err.detail || 'Failed'}`, 'Calculation Error', 'error');
      }
    } catch (e: any) {
      showAlert(`Network error: ${e.message}`, 'Network Error', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Run ANOVA
  const handleRunAnova = async () => {
    const groupsPayload: Record<string, number[]> = {};
    anovaGroups.forEach((g) => {
      const vals = parseNumbers(g.raw);
      if (vals.length >= 2) groupsPayload[g.name] = vals;
    });

    if (Object.keys(groupsPayload).length < 2) {
      showAlert('ANOVA requires at least 2 valid groups with >= 2 numbers each.', 'Input Validation', 'warning');
      return;
    }

    setIsLoading(true);
    try {
      const resp = await fetch('/api/stats/anova', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groups: groupsPayload })
      });
      if (resp.ok) {
        setAnovaResult(await resp.json());
        showToast('ANOVA computation complete', 'success');
      } else {
        const err = await resp.json();
        showAlert(`ANOVA calculation error: ${err.detail || 'Failed'}`, 'Calculation Error', 'error');
      }
    } catch (e: any) {
      showAlert(`Network error: ${e.message}`, 'Network Error', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Run Smoothing
  const handleRunSmoothing = async () => {
    const x = parseNumbers(rawXInput);
    const y = parseNumbers(rawYInput);
    if (x.length !== y.length || x.length < 4) {
      showAlert('X and Y arrays must have identical length and at least 4 points.', 'Input Validation', 'warning');
      return;
    }
    setIsLoading(true);
    try {
      const resp = await fetch('/api/stats/smoothing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          x,
          y,
          method: smoothMethod,
          window_size: windowSize,
          poly_order: polyOrder
        })
      });
      if (resp.ok) {
        setSmoothResult(await resp.json());
        showToast('Curve smoothing complete', 'success');
      }
    } catch (e: any) {
      showAlert(`Smoothing error: ${e.message}`, 'Calculation Error', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Run Regression
  const handleRunRegression = async () => {
    const x = parseNumbers(rawXInput);
    const y = parseNumbers(rawYInput);
    if (x.length !== y.length || x.length < 3) {
      showAlert('X and Y arrays must have identical length and at least 3 points.', 'Input Validation', 'warning');
      return;
    }
    setIsLoading(true);
    try {
      const resp = await fetch('/api/stats/regression', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          x,
          y,
          poly_degree: regressionDegree
        })
      });
      if (resp.ok) {
        setRegressionResult(await resp.json());
        showToast('Regression model fitted successfully', 'success');
      }
    } catch (e: any) {
      showAlert(`Regression error: ${e.message}`, 'Fitting Error', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  // Generate LaTeX TikZ / PGFPlots Code
  const generatedTikzCode = useMemo(() => {
    if (activeTab === 'regression' && regressionResult) {
      const points = regressionResult.x
        .map((xVal: number, i: number) => `(${xVal}, ${regressionResult.raw_y[i]})`)
        .join(' ');
      const fitPoints = regressionResult.x
        .map((xVal: number, i: number) => `(${xVal}, ${regressionResult.fitted_y[i]})`)
        .join(' ');

      return `\\begin{tikzpicture}
\\begin{axis}[
    title={${regressionResult.poly_degree === 1 ? 'Linear Regression' : 'Polynomial Fit'}: $R^2 = ${regressionResult.r_squared}$},
    xlabel={Independent Variable ($x$)},
    ylabel={Response ($y$)},
    grid=major,
    width=9cm, height=6.5cm
]
\\addplot[only marks, mark=*, mark size=2pt, color=blue] coordinates {
    ${points}
};
\\addplot[thick, color=red] coordinates {
    ${fitPoints}
};
\\legend{Observed Data, Fit (${regressionResult.formula_latex.replace(/\\/g, '\\\\')})}
\\end{axis}
\\end{tikzpicture}`;
    }

    if (activeTab === 'smoothing' && smoothResult) {
      const rawPoints = smoothResult.x
        .map((xVal: number, i: number) => `(${xVal}, ${smoothResult.raw_y[i]})`)
        .join(' ');
      const smoothPoints = smoothResult.x
        .map((xVal: number, i: number) => `(${xVal}, ${smoothResult.smoothed_y[i]})`)
        .join(' ');

      return `\\begin{tikzpicture}
\\begin{axis}[
    title={Savitzky-Golay Signal Smoothing: $R^2 = ${smoothResult.r_squared}$},
    xlabel={$x$}, ylabel={$y$},
    grid=major,
    width=9cm, height=6.5cm
]
\\addplot[only marks, mark=o, color=gray] coordinates { ${rawPoints} };
\\addplot[thick, color=teal] coordinates { ${smoothPoints} };
\\legend{Raw Signal, Smoothed ($w=${smoothResult.window_size}$)}
\\end{axis}
\\end{tikzpicture}`;
    }

    if (activeTab === 't-test' && tTestResult) {
      return `% LaTeX Statistical Synthesis:
% ${tTestResult.test_type}
% t(${tTestResult.df}) = ${tTestResult.statistic}, p = ${tTestResult.p_value < 0.001 ? '< 0.001' : tTestResult.p_value.toFixed(4)}, Cohen's d = ${tTestResult.cohens_d}
% Group A: Mean = ${tTestResult.mean_a} (SD = ${tTestResult.std_a})
% Group B: Mean = ${tTestResult.mean_b} (SD = ${tTestResult.std_b})
% 95% CI of Difference: [${tTestResult.ci_lower}, ${tTestResult.ci_upper}]`;
    }

    return '% Run a statistical test or regression model above to generate TikZ code.';
  }, [activeTab, regressionResult, smoothResult, tTestResult]);

  const handleCopyTikz = () => {
    navigator.clipboard.writeText(generatedTikzCode);
    setCopiedTikz(true);
    setTimeout(() => setCopiedTikz(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)] bg-[#07080a] text-zinc-100 overflow-y-auto">
      {/* Top Header Command Bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between px-6 py-3.5 bg-[#07080a]/90 backdrop-blur-md border-b border-zinc-800/80">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 text-sky-400">
            <TrendingUp className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              Scientific Statistics &amp; Plotting
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20">
                SciPy + TikZ
              </span>
            </h2>
            <p className="text-xs text-zinc-400">
              Hypothesis tests, ANOVA, Savitzky-Golay signal smoothing, and regression modeling with 1-click LaTeX TikZ export.
            </p>
          </div>
        </div>

        {/* Sub-tab navigation */}
        <div className="flex items-center gap-1 p-1 bg-zinc-900/80 border border-zinc-800 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab('t-test')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 't-test' ? 'bg-zinc-800 text-white font-semibold shadow-xs' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Two-Sample t-Test
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('anova')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'anova' ? 'bg-zinc-800 text-white font-semibold shadow-xs' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            One-Way ANOVA
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('regression')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'regression' ? 'bg-zinc-800 text-white font-semibold shadow-xs' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Curve Regression
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('smoothing')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              activeTab === 'smoothing' ? 'bg-zinc-800 text-white font-semibold shadow-xs' : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            Signal Smoothing
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Data Input & Configuration (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* TAB 1: Two-Sample t-Test */}
          {activeTab === 't-test' && (
            <div className="rounded-2xl antigravity-card p-5 border border-zinc-800/80 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                  <span>Student's / Welch's Two-Sample t-Test</span>
                </h3>
                <div className="flex items-center gap-3 text-xs text-zinc-400">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPaired}
                      onChange={(e) => setIsPaired(e.target.checked)}
                      className="rounded bg-zinc-800 border-zinc-700 text-sky-500 focus:ring-0"
                    />
                    <span>Paired Samples</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isEqualVar}
                      onChange={(e) => setIsEqualVar(e.target.checked)}
                      className="rounded bg-zinc-800 border-zinc-700 text-sky-500 focus:ring-0"
                    />
                    <span>Equal Variance</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-zinc-300 block mb-1">Group A Observations</label>
                  <textarea
                    value={groupAInput}
                    onChange={(e) => setGroupAInput(e.target.value)}
                    rows={4}
                    className="w-full bg-zinc-950 rounded-xl p-2.5 font-mono text-xs text-zinc-200 border border-zinc-800 focus:outline-none focus:border-sky-500"
                    placeholder="Enter numbers separated by commas or spaces..."
                  />
                  <div className="text-[10px] text-zinc-500 mt-1">
                    Count: {parseNumbers(groupAInput).length} values
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-300 block mb-1">Group B Observations</label>
                  <textarea
                    value={groupBInput}
                    onChange={(e) => setGroupBInput(e.target.value)}
                    rows={4}
                    className="w-full bg-zinc-950 rounded-xl p-2.5 font-mono text-xs text-zinc-200 border border-zinc-800 focus:outline-none focus:border-sky-500"
                    placeholder="Enter numbers separated by commas or spaces..."
                  />
                  <div className="text-[10px] text-zinc-500 mt-1">
                    Count: {parseNumbers(groupBInput).length} values
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={handleRunTTest}
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Activity className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Calculate Two-Sample t-Test</span>
              </button>
            </div>
          )}

          {/* TAB 2: One-Way ANOVA */}
          {activeTab === 'anova' && (
            <div className="rounded-2xl antigravity-card p-5 border border-zinc-800/80 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-100">One-Way Analysis of Variance (ANOVA)</h3>
                <button
                  type="button"
                  onClick={() =>
                    setAnovaGroups((prev) => [
                      ...prev,
                      { id: `g_${Date.now()}`, name: `Group ${prev.length + 1}`, raw: '20.0, 21.5, 22.1, 20.8' }
                    ])
                  }
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium transition-colors"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Group</span>
                </button>
              </div>

              <div className="space-y-3">
                {anovaGroups.map((g, idx) => (
                  <div key={g.id} className="p-3 rounded-xl bg-zinc-950/70 border border-zinc-800/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <input
                        type="text"
                        value={g.name}
                        onChange={(e) =>
                          setAnovaGroups((prev) =>
                            prev.map((item) => (item.id === g.id ? { ...item, name: e.target.value } : item))
                          )
                        }
                        className="bg-transparent font-medium text-xs text-zinc-200 border-none focus:outline-none focus:ring-0 p-0"
                      />
                      {anovaGroups.length > 2 && (
                        <button
                          type="button"
                          onClick={() => setAnovaGroups((prev) => prev.filter((item) => item.id !== g.id))}
                          className="text-zinc-500 hover:text-red-400 p-1"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                    <textarea
                      value={g.raw}
                      onChange={(e) =>
                        setAnovaGroups((prev) =>
                          prev.map((item) => (item.id === g.id ? { ...item, raw: e.target.value } : item))
                        )
                      }
                      rows={2}
                      className="w-full bg-zinc-900/60 rounded-lg p-2 font-mono text-xs text-zinc-300 border border-zinc-800 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleRunAnova}
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Activity className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Compute ANOVA &amp; Post-Hoc Tukey HSD</span>
              </button>
            </div>
          )}

          {/* TAB 3: Curve Regression & TAB 4: Smoothing */}
          {(activeTab === 'regression' || activeTab === 'smoothing') && (
            <div className="rounded-2xl antigravity-card p-5 border border-zinc-800/80 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <h3 className="text-sm font-semibold text-zinc-100">
                  {activeTab === 'regression' ? 'Curve Fitting & Regression Model' : 'Savitzky-Golay Signal Smoothing'}
                </h3>
                {activeTab === 'regression' ? (
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <span>Degree:</span>
                    {[1, 2, 3].map((deg) => (
                      <button
                        key={deg}
                        type="button"
                        onClick={() => setRegressionDegree(deg)}
                        className={`px-2 py-0.5 rounded ${
                          regressionDegree === deg ? 'bg-sky-500 text-zinc-950 font-bold' : 'bg-zinc-800 text-zinc-400'
                        }`}
                      >
                        {deg === 1 ? 'Linear (1)' : deg === 2 ? 'Quad (2)' : 'Cubic (3)'}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <span>Window:</span>
                    <input
                      type="number"
                      min={3}
                      max={25}
                      step={2}
                      value={windowSize}
                      onChange={(e) => setWindowSize(parseInt(e.target.value) || 5)}
                      className="w-12 bg-zinc-900 border border-zinc-800 rounded px-1 text-center font-mono"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-zinc-300 block mb-1">X Coordinates / Time Series</label>
                  <textarea
                    value={rawXInput}
                    onChange={(e) => setRawXInput(e.target.value)}
                    rows={4}
                    className="w-full bg-zinc-950 rounded-xl p-2.5 font-mono text-xs text-zinc-200 border border-zinc-800 focus:outline-none focus:border-sky-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-zinc-300 block mb-1">Y Response / Raw Measurements</label>
                  <textarea
                    value={rawYInput}
                    onChange={(e) => setRawYInput(e.target.value)}
                    rows={4}
                    className="w-full bg-zinc-950 rounded-xl p-2.5 font-mono text-xs text-zinc-200 border border-zinc-800 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={activeTab === 'regression' ? handleRunRegression : handleRunSmoothing}
                disabled={isLoading}
                className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
              >
                <Activity className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{activeTab === 'regression' ? 'Fit Regression Model' : 'Apply Savitzky-Golay Smoothing'}</span>
              </button>
            </div>
          )}

          {/* Export to LaTeX TikZ / PGFPlots Box */}
          <div className="rounded-2xl antigravity-card p-5 border border-zinc-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-emerald-400" />
                <h4 className="text-xs font-semibold text-zinc-200">1-Click LaTeX TikZ / PGFPlots Export</h4>
              </div>
              <button
                type="button"
                onClick={handleCopyTikz}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-xs font-medium text-zinc-200 transition-colors"
              >
                {copiedTikz ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-zinc-400" />}
                <span>{copiedTikz ? 'Copied TikZ!' : 'Copy Code'}</span>
              </button>
            </div>
            <pre className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 text-[11px] font-mono text-zinc-400 max-h-40 overflow-y-auto whitespace-pre">
              {generatedTikzCode}
            </pre>
          </div>
        </div>

        {/* Right Column: Statistical Results & Analytical Verdict (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Result Card: t-Test */}
          {activeTab === 't-test' && tTestResult && (
            <div className="rounded-2xl antigravity-card p-5 border border-sky-500/30 bg-sky-950/10 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <span className="text-xs font-semibold text-sky-400">{tTestResult.test_type}</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                    tTestResult.is_significant
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  {tTestResult.is_significant ? 'Significant (p < 0.05)' : 'Not Significant'}
                </span>
              </div>

              {/* Statistical Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 uppercase">t-Statistic</div>
                  <div className="font-mono text-sm font-semibold text-zinc-100">{tTestResult.statistic}</div>
                  <div className="text-[10px] text-zinc-500 font-mono">df = {tTestResult.df}</div>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 uppercase">Two-Tailed p-Value</div>
                  <div className="font-mono text-sm font-semibold text-zinc-100">
                    {tTestResult.p_value < 0.001 ? '< 0.001' : tTestResult.p_value.toFixed(4)}
                  </div>
                  <div className="text-[10px] text-zinc-500">α = 0.05</div>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 uppercase">Cohen's d (Effect Size)</div>
                  <div className="font-mono text-sm font-semibold text-zinc-100">{tTestResult.cohens_d}</div>
                  <div className="text-[10px] text-zinc-500">
                    {Math.abs(tTestResult.cohens_d) >= 0.8
                      ? 'Large effect'
                      : Math.abs(tTestResult.cohens_d) >= 0.5
                      ? 'Moderate effect'
                      : 'Small effect'}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 uppercase">95% CI of Difference</div>
                  <div className="font-mono text-xs font-semibold text-zinc-100">
                    [{tTestResult.ci_lower}, {tTestResult.ci_upper}]
                  </div>
                  <div className="text-[10px] text-zinc-500">Δ = {tTestResult.mean_diff}</div>
                </div>
              </div>

              {/* Plain English Verdict */}
              <div className="p-3 rounded-xl bg-zinc-950/80 border border-zinc-800 text-xs text-zinc-300 leading-relaxed">
                <strong>Synthesis Verdict:</strong> {tTestResult.verdict}
              </div>
            </div>
          )}

          {/* Result Card: ANOVA */}
          {activeTab === 'anova' && anovaResult && (
            <div className="rounded-2xl antigravity-card p-5 border border-purple-500/30 bg-purple-950/10 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <span className="text-xs font-semibold text-purple-400">One-Way ANOVA Output</span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
                    anovaResult.is_significant
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700'
                  }`}
                >
                  {anovaResult.is_significant ? 'Significant (p < 0.05)' : 'Not Significant'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 uppercase">F-Ratio</div>
                  <div className="font-mono text-sm font-semibold text-zinc-100">{anovaResult.f_statistic}</div>
                  <div className="text-[10px] text-zinc-500 font-mono">
                    F({anovaResult.df_between}, {anovaResult.df_within})
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 uppercase">ANOVA p-Value</div>
                  <div className="font-mono text-sm font-semibold text-zinc-100">
                    {anovaResult.p_value < 0.001 ? '< 0.001' : anovaResult.p_value.toFixed(4)}
                  </div>
                  <div className="text-[10px] text-zinc-500">Between groups</div>
                </div>
              </div>

              {/* Post-Hoc Tukey HSD Table */}
              {anovaResult.post_hoc_tukey && anovaResult.post_hoc_tukey.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] font-bold uppercase text-zinc-400">
                    Pairwise Tukey HSD Post-Hoc Comparisons
                  </div>
                  <div className="border border-zinc-800 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left">
                      <thead className="bg-zinc-900 text-[10px] text-zinc-400 uppercase">
                        <tr>
                          <th className="p-2">Contrast</th>
                          <th className="p-2">Diff</th>
                          <th className="p-2">p-adj</th>
                          <th className="p-2">Sig</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800 font-mono text-[11px]">
                        {anovaResult.post_hoc_tukey.map((cmp: any, idx: number) => (
                          <tr key={idx} className="hover:bg-zinc-900/40">
                            <td className="p-2 font-sans">{cmp.group1} vs {cmp.group2}</td>
                            <td className="p-2">{cmp.diff}</td>
                            <td className="p-2">{cmp.p_adj < 0.001 ? '< 0.001' : cmp.p_adj}</td>
                            <td className="p-2">
                              {cmp.significant ? (
                                <span className="text-emerald-400 font-bold">Yes *</span>
                              ) : (
                                <span className="text-zinc-500">No</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Result Card: Regression & Smoothing */}
          {activeTab === 'regression' && regressionResult && (
            <div className="rounded-2xl antigravity-card p-5 border border-sky-500/30 bg-sky-950/10 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <span className="text-xs font-semibold text-sky-400">Regression Statistics</span>
                <span className="font-mono text-xs font-bold text-emerald-400">R² = {regressionResult.r_squared}</span>
              </div>

              <div className="p-3 rounded-xl bg-zinc-950 text-center font-mono text-xs text-sky-300 border border-zinc-800">
                {regressionResult.formula_latex}
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 uppercase">Pearson r</div>
                  <div className="font-mono text-sm font-semibold text-zinc-100">{regressionResult.pearson_r}</div>
                </div>

                <div className="p-2.5 rounded-xl bg-zinc-900/60 border border-zinc-800">
                  <div className="text-[10px] text-zinc-500 uppercase">Standard Error</div>
                  <div className="font-mono text-sm font-semibold text-zinc-100">{regressionResult.std_err}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'smoothing' && smoothResult && (
            <div className="rounded-2xl antigravity-card p-5 border border-emerald-500/30 bg-emerald-950/10 space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
                <span className="text-xs font-semibold text-emerald-400">Signal Filtering Metric</span>
                <span className="font-mono text-xs font-bold text-emerald-400">R² = {smoothResult.r_squared}</span>
              </div>
              <p className="text-xs text-zinc-300 leading-relaxed">
                Preserved high-frequency peaks while eliminating noise over {smoothResult.x.length} data points (Window: {smoothResult.window_size}).
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
