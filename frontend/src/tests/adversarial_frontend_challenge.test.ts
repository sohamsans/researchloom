import { describe, it, expect } from 'vitest';
import { cleanAndOrientLayout, FlowNode, FlowEdge } from '../components/flowmap/FlowMapCanvas';
import { escapeLatex } from '../components/DataSheetStudio';

describe('Adversarial Challenge 1: Flow Map Auto-Layout Stress Tests', () => {
  it('handles 3-node citation cycle (A -> B -> C -> A) without infinite loop or NaN coordinates', () => {
    const nodes: FlowNode[] = [
      { id: 'A', title: 'Paper A', type: 'paper', x: 0, y: 0 },
      { id: 'B', title: 'Paper B', type: 'paper', x: 0, y: 0 },
      { id: 'C', title: 'Paper C', type: 'paper', x: 0, y: 0 }
    ];
    const edges: FlowEdge[] = [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'B', target: 'C' },
      { id: 'e3', source: 'C', target: 'A' }
    ];

    const result = cleanAndOrientLayout(nodes, edges);

    expect(result).toHaveLength(3);
    const resultIds = result.map(n => n.id).sort();
    expect(resultIds).toEqual(['A', 'B', 'C']);

    // Check finite non-NaN coordinates
    result.forEach(node => {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeGreaterThanOrEqual(0);
    });
  });

  it('handles disconnected components + cycles + isolated singletons', () => {
    const nodes: FlowNode[] = [
      // Component 1: Cyclic (A <-> B)
      { id: 'c1_a', title: 'Cycle A', type: 'paper', x: 0, y: 0 },
      { id: 'c1_b', title: 'Cycle B', type: 'paper', x: 0, y: 0 },
      // Component 2: Self-loop cycle
      { id: 'c2_self', title: 'Self Loop', type: 'paper', x: 0, y: 0 },
      // Component 3: Disconnected singletons
      { id: 'iso_1', title: 'Isolated 1', type: 'note', x: 0, y: 0 },
      { id: 'iso_2', title: 'Isolated 2', type: 'folder', x: 0, y: 0 },
      // Component 4: Standard DAG branch
      { id: 'dag_root', title: 'DAG Root', type: 'paper', x: 0, y: 0 },
      { id: 'dag_leaf1', title: 'DAG Leaf 1', type: 'paper', x: 0, y: 0 },
      { id: 'dag_leaf2', title: 'DAG Leaf 2', type: 'paper', x: 0, y: 0 },
      // Component 5: Complex 4-node cycle with cross edges
      { id: 'k4_1', title: 'K4-1', type: 'paper', x: 0, y: 0 },
      { id: 'k4_2', title: 'K4-2', type: 'paper', x: 0, y: 0 },
      { id: 'k4_3', title: 'K4-3', type: 'paper', x: 0, y: 0 },
      { id: 'k4_4', title: 'K4-4', type: 'paper', x: 0, y: 0 }
    ];

    const edges: FlowEdge[] = [
      // C1 cycle
      { id: 'e1', source: 'c1_a', target: 'c1_b' },
      { id: 'e2', source: 'c1_b', target: 'c1_a' },
      // C2 self-loop
      { id: 'e3', source: 'c2_self', target: 'c2_self' },
      // C4 DAG
      { id: 'e4', source: 'dag_root', target: 'dag_leaf1' },
      { id: 'e5', source: 'dag_root', target: 'dag_leaf2' },
      // C5 cyclic graph
      { id: 'e6', source: 'k4_1', target: 'k4_2' },
      { id: 'e7', source: 'k4_2', target: 'k4_3' },
      { id: 'e8', source: 'k4_3', target: 'k4_4' },
      { id: 'e9', source: 'k4_4', target: 'k4_1' },
      { id: 'e10', source: 'k4_1', target: 'k4_3' }
    ];

    const result = cleanAndOrientLayout(nodes, edges);

    expect(result).toHaveLength(nodes.length);
    result.forEach(node => {
      expect(Number.isFinite(node.x)).toBe(true);
      expect(Number.isFinite(node.y)).toBe(true);
      expect(node.x).toBeGreaterThan(0);
      expect(node.y).toBeGreaterThan(0);
    });
  });

  it('guarantees complete node immutability (original input array objects strictly unmutated)', () => {
    const originalNodes: FlowNode[] = [
      { id: 'node_1', title: 'Original Title 1', type: 'paper', x: 42, y: 99 },
      { id: 'node_2', title: 'Original Title 2', type: 'paper', x: 777, y: 888 },
      { id: 'node_3', title: 'Original Title 3', type: 'note', x: -50, y: -100 }
    ];
    const edges: FlowEdge[] = [
      { id: 'e1', source: 'node_1', target: 'node_2' },
      { id: 'e2', source: 'node_2', target: 'node_3' }
    ];

    // Deep freeze input objects to empirically catch any illegal write attempts
    const frozenInput = originalNodes.map(n => Object.freeze({ ...n }));

    // Executing layout on frozen objects must NOT throw TypeError: Cannot assign to read only property
    let result: FlowNode[] = [];
    expect(() => {
      result = cleanAndOrientLayout(frozenInput, edges);
    }).not.toThrow();

    // Verify original frozen objects retained their exact initial coordinates
    expect(frozenInput[0].x).toBe(42);
    expect(frozenInput[0].y).toBe(99);
    expect(frozenInput[1].x).toBe(777);
    expect(frozenInput[1].y).toBe(888);
    expect(frozenInput[2].x).toBe(-50);
    expect(frozenInput[2].y).toBe(-100);

    // Verify returned nodes are distinct object references with newly calculated layout
    expect(result).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      expect(result[i]).not.toBe(frozenInput[i]);
      expect(result[i].id).toBe(frozenInput[i].id);
    }
  });

  it('survives stress scale: large 60-node circular ring graph', () => {
    const count = 60;
    const nodes: FlowNode[] = Array.from({ length: count }, (_, i) => ({
      id: `ring_${i}`,
      title: `Ring Paper ${i}`,
      type: 'paper',
      x: 0,
      y: 0
    }));

    // Circle: ring_0 -> ring_1 -> ... -> ring_59 -> ring_0
    const edges: FlowEdge[] = Array.from({ length: count }, (_, i) => ({
      id: `e_${i}`,
      source: `ring_${i}`,
      target: `ring_${(i + 1) % count}`
    }));

    const result = cleanAndOrientLayout(nodes, edges);
    expect(result).toHaveLength(count);
    result.forEach(n => {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
    });
  });

  it('handles empty nodes and missing edge targets gracefully', () => {
    expect(cleanAndOrientLayout([], [])).toEqual([]);

    // Edge referencing non-existent nodes
    const nodes: FlowNode[] = [
      { id: 'valid_1', title: 'V1', type: 'paper', x: 0, y: 0 }
    ];
    const ghostEdges: FlowEdge[] = [
      { id: 'ghost_1', source: 'ghost_source', target: 'valid_1' },
      { id: 'ghost_2', source: 'valid_1', target: 'ghost_target' }
    ];

    const result = cleanAndOrientLayout(nodes, ghostEdges);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('valid_1');
    expect(Number.isFinite(result[0].x)).toBe(true);
    expect(Number.isFinite(result[0].y)).toBe(true);
  });
});

describe('Adversarial Challenge 2: DataSheet LaTeX Export Stress Tests', () => {
  it('preserves numerical 0 and does not replace it with "-"', () => {
    expect(escapeLatex(0)).toBe('0');
    expect(escapeLatex('0')).toBe('0');
    expect(escapeLatex(0.0)).toBe('0');
    expect(escapeLatex(-0)).toBe('0');
  });

  it('correctly returns "-" for empty, null, and undefined values', () => {
    expect(escapeLatex(null)).toBe('-');
    expect(escapeLatex(undefined)).toBe('-');
    expect(escapeLatex('')).toBe('-');
    expect(escapeLatex('   ')).toBe('-');
    expect(escapeLatex('\t\n ')).toBe('-');
  });

  it('escapes strings with multiple %, _, &, $, # correctly without corruption', () => {
    // Single occurrences
    expect(escapeLatex('%')).toBe('\\%');
    expect(escapeLatex('_')).toBe('\\_');
    expect(escapeLatex('&')).toBe('\\&');
    expect(escapeLatex('$')).toBe('\\$');
    expect(escapeLatex('#')).toBe('\\#');

    // Clustered multiple special characters
    const complexStr = 'Discount 50% & Profit_Margin #1 at $1,000 with 100% ROI';
    const escaped = escapeLatex(complexStr);
    expect(escaped).toBe('Discount 50\\% \\& Profit\\_Margin \\#1 at \\$1,000 with 100\\% ROI');

    // Adjacent special characters
    expect(escapeLatex('%_&#$')).toBe('\\%\\_\\&\\#\\$');
    expect(escapeLatex('$$$###%%%___&&&')).toBe('\\$\\$\\$\\#\\#\\#\\%\\%\\%\\_\\_\\_\\&\\&\\&');
  });

  it('handles numbers parsed by SheetJS and floating point values', () => {
    // SheetJS outputs numbers as JS numbers in sheet_to_json
    expect(escapeLatex(12345)).toBe('12345');
    expect(escapeLatex(98.765)).toBe('98.765');
    expect(escapeLatex(-42)).toBe('-42');
    expect(escapeLatex(1e-4)).toBe('0.0001');
    expect(escapeLatex(0.0000001)).toBe('1e-7');
  });

  it('generates well-formed LaTeX booktabs row with numerical 0 and special characters', () => {
    const columns = ['Model', 'Accuracy (%)', 'Cost ($)', 'Err_Count', 'Notes'];
    const row = {
      Model: 'Transformer_v2',
      'Accuracy (%)': 95.5,
      'Cost ($)': 0,
      Err_Count: 0,
      Notes: 'Fast & Robust #1'
    };

    const formattedCells = columns.map(col => escapeLatex(row[col as keyof typeof row]));
    const rowLatex = formattedCells.join(' & ');

    // Accuracy has escaped %
    expect(rowLatex).toContain('95.5');
    // Cost ($) is numerical 0, must be '0' and NOT '-'
    expect(formattedCells[2]).toBe('0');
    // Err_Count is numerical 0, must be '0' and NOT '-'
    expect(formattedCells[3]).toBe('0');
    // Notes has escaped & and #
    expect(formattedCells[4]).toBe('Fast \\& Robust \\#1');

    expect(rowLatex).toBe('Transformer\\_v2 & 95.5 & 0 & 0 & Fast \\& Robust \\#1');
  });
});

describe('Adversarial Challenge 3: WritingStudio Formula Insertion Stress Tests', () => {
  // Regex from WritingStudio.tsx line 363:
  const displayMathRegex = /^\s*(\\begin\{(equation|align|gather|multline|flalign)\*?\}|\\\[|\$\$)/;

  const simulateInsertFormula = (incomingFormulaSnippet: string, mode: 'latex' | 'rich', existingDoc: string): string => {
    const isDisplayMath = displayMathRegex.test(incomingFormulaSnippet);

    if (mode === 'latex') {
      const snippetToInsert = isDisplayMath
        ? incomingFormulaSnippet
        : `\\begin{equation}\n  ${incomingFormulaSnippet}\n\\end{equation}`;

      return existingDoc + `\n\n% Inserted from Formula Studio\n${snippetToInsert}\n`;
    } else {
      const isAlreadyWrappedInDollars = incomingFormulaSnippet.trim().startsWith('$$') || isDisplayMath;
      const snippetToInsert = isAlreadyWrappedInDollars
        ? incomingFormulaSnippet
        : `$$\n${incomingFormulaSnippet}\n$$`;

      return existingDoc + `\n\n${snippetToInsert}\n`;
    }
  };

  it('does NOT double nest \\begin{equation} when formula is already an equation environment', () => {
    const formula = `\\begin{equation}\n  E = m c^2\n\\end{equation}`;
    const initialLatex = '\\documentclass{article}\n\\begin{document}\n';
    const output = simulateInsertFormula(formula, 'latex', initialLatex);

    const beginCount = (output.match(/\\begin\{equation\}/g) || []).length;
    const endCount = (output.match(/\\end\{equation\}/g) || []).length;
    expect(beginCount).toBe(1);
    expect(endCount).toBe(1);
    expect(output).not.toContain('\\begin{equation}\n  \\begin{equation}');
  });

  it('does NOT wrap \\begin{align} or \\begin{align*} inside \\begin{equation}', () => {
    const alignFormula = `\\begin{align}\n  y &= ax + b \\\\\n  z &= cy + d\n\\end{align}`;
    const output = simulateInsertFormula(alignFormula, 'latex', '');

    expect(output).toContain('\\begin{align}');
    expect(output).not.toContain('\\begin{equation}');

    const starredAlign = `   \\begin{align*}\n  \\nabla \\cdot B = 0\n\\end{align*}`;
    const outputStarred = simulateInsertFormula(starredAlign, 'latex', '');
    expect(outputStarred).toContain('\\begin{align*}');
    expect(outputStarred).not.toContain('\\begin{equation}');
  });

  it('does NOT wrap \\begin{gather} or \\begin{gather*} inside \\begin{equation}', () => {
    const gatherFormula = `\\begin{gather}\n  x = 1 \\\\\n  y = 2\n\\end{gather}`;
    const output = simulateInsertFormula(gatherFormula, 'latex', '');

    expect(output).toContain('\\begin{gather}');
    expect(output).not.toContain('\\begin{equation}');

    const starredGather = `  \\begin{gather*}\n  a = b\n\\end{gather*}`;
    const outputStarred = simulateInsertFormula(starredGather, 'latex', '');
    expect(outputStarred).toContain('\\begin{gather*}');
    expect(outputStarred).not.toContain('\\begin{equation}');
  });

  it('does NOT wrap \\begin{multline} or \\begin{flalign} inside \\begin{equation}', () => {
    const multlineFormula = `\\begin{multline}\n  p(x) = a + b + c + d \\\\\n  + e + f\n\\end{multline}`;
    const outputMultline = simulateInsertFormula(multlineFormula, 'latex', '');
    expect(outputMultline).toContain('\\begin{multline}');
    expect(outputMultline).not.toContain('\\begin{equation}');

    const flalignFormula = `\\begin{flalign*}\n  f(x) &= g(x)\n\\end{flalign*}`;
    const outputFlalign = simulateInsertFormula(flalignFormula, 'latex', '');
    expect(outputFlalign).toContain('\\begin{flalign*}');
    expect(outputFlalign).not.toContain('\\begin{equation}');
  });

  it('does NOT wrap \\[ ... \\] inside \\begin{equation}', () => {
    const bracketFormula = `\\[ \\int_0^1 f(x) dx \\]`;
    const output = simulateInsertFormula(bracketFormula, 'latex', '');

    expect(output).toContain('\\[ \\int_0^1 f(x) dx \\]');
    expect(output).not.toContain('\\begin{equation}');
  });

  it('does NOT wrap $$ ... $$ inside \\begin{equation}', () => {
    const dollarFormula = `$$ \\lim_{x \\to 0} \\frac{\\sin x}{x} = 1 $$`;
    const output = simulateInsertFormula(dollarFormula, 'latex', '');

    expect(output).toContain('$$ \\lim_{x \\to 0} \\frac{\\sin x}{x} = 1 $$');
    expect(output).not.toContain('\\begin{equation}');
  });

  it('correctly wraps raw formulas (E = mc^2) in \\begin{equation} in LaTeX mode and $$ in Rich mode', () => {
    const rawFormula = 'E = m c^2';

    // LaTeX mode
    const latexOutput = simulateInsertFormula(rawFormula, 'latex', '');
    expect(latexOutput).toContain('\\begin{equation}\n  E = m c^2\n\\end{equation}');

    // Rich mode
    const richOutput = simulateInsertFormula(rawFormula, 'rich', '# Title');
    expect(richOutput).toContain('$$\nE = m c^2\n$$');
  });

  it('handles formula with leading whitespace and newlines without false negatives', () => {
    const paddedEquation = '  \n\t  \\begin{equation}\n  x = y\n\\end{equation}';
    const output = simulateInsertFormula(paddedEquation, 'latex', '');

    const beginCount = (output.match(/\\begin\{equation\}/g) || []).length;
    expect(beginCount).toBe(1);
    expect(output).not.toContain('\\begin{equation}\n    \n\t  \\begin{equation}');
  });

  it('in Rich mode, does not double wrap display math environments or double dollar formulas', () => {
    const eqFormula = `\\begin{equation}\n  E = mc^2\n\\end{equation}`;
    const richOutput1 = simulateInsertFormula(eqFormula, 'rich', '# Note');
    expect(richOutput1).not.toContain('$$\n\\begin{equation}');

    const dollarFormula = `$$ x^2 + y^2 = r^2 $$`;
    const richOutput2 = simulateInsertFormula(dollarFormula, 'rich', '# Note');
    expect(richOutput2).not.toContain('$$\n$$');
  });
});
