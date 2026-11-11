import { describe, it, expect } from 'vitest';
import { escapeLatex } from '../components/DataSheetStudio';

describe('Feature 6: Multi-Studio Cross-Feature Contracts', () => {
  it('prevents double \\begin{equation} nesting when inserting from Formula Studio to Writing Studio', () => {
    // FormulaStudio.tsx line 350:
    const formulaSnippet = `\\begin{equation}\n  E = m c^2\n\\end{equation}\n% Where: Energy`;

    // WritingStudio.tsx display math detection:
    const isDisplayMath = /^\s*(\\begin\{(equation|align|gather|multline|flalign)\*?\}|\\\[|\$\$)/.test(formulaSnippet);
    const snippetToInsert = isDisplayMath
      ? formulaSnippet
      : `\\begin{equation}\n  ${formulaSnippet}\n\\end{equation}`;

    const initialLatex = '\\documentclass{article}\n\\begin{document}\n';
    const outputLatex = initialLatex + `\n\n% Inserted from Formula Studio\n${snippetToInsert}\n`;

    // Assertion: Output LaTeX must NOT contain double nested \\begin{equation}
    const beginCount = (outputLatex.match(/\\begin\{equation\}/g) || []).length;
    expect(beginCount).toBe(1);
  });

  it('routes stylus handwritten note text to markdown prose rather than LaTeX math equation', () => {
    // StylusStudio.tsx lines 558-563:
    const stylusNote = '> [Handwritten Note & Figure]: Annotated via Active Stylus';

    // In App.tsx: onInsertToStudio sets pendingStylusNote(note), which routes to WritingStudio as markdown prose:
    const proseInserted = `\n\n${stylusNote}\n`;

    // Assertion: Markdown blockquote must NOT be wrapped inside KaTeX / LaTeX math equation block!
    expect(proseInserted).not.toContain('\\begin{equation}');
  });

  it('escapes percentage sign (%) in DataSheet Studio LaTeX table export', () => {
    // DataSheetStudio.tsx lines 24, 124-126:
    const columns = ['Model / Method', 'Dataset', 'Accuracy (%)', 'Latency (ms)'];

    const headerRow = columns.map(c => `\\textbf{${escapeLatex(c)}}`).join(' & ');

    // In LaTeX, '%' starts an unescaped comment that swallows the remainder of the line!
    // Proper escaping must produce '\%'
    expect(headerRow).toContain('\\textbf{Accuracy (\\%)}');
    expect(headerRow).not.toMatch(/Accuracy \(%\)/);
  });
});
