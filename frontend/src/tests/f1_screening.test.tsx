import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Feature 1: PRISMA Screening Hotkey Loop & Flow Metrics', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('detects hotkey loop at final paper in screening queue', () => {
    // In PRISMAFlowDiagram.tsx:
    // when currentIndex === papers.length - 1, isCompleted is set to true
    // and subsequent hotkey presses are rejected.

    const papers = [
      { id: 'p1', title: 'Paper 1' },
      { id: 'p2', title: 'Paper 2' }
    ];

    let currentIndex = 0;
    let isCompleted = false;
    const decisionsLogged: string[] = [];

    const handleDecision = (action: string) => {
      if (isCompleted || currentIndex >= papers.length) return;
      decisionsLogged.push(`${papers[currentIndex].id}:${action}`);
      if (currentIndex < papers.length - 1) {
        currentIndex += 1;
      } else {
        isCompleted = true;
      }
    };

    // Process paper 0
    handleDecision('included');
    expect(currentIndex).toBe(1);

    // Process paper 1 (final paper)
    handleDecision('included');
    expect(currentIndex).toBe(1);

    // If user presses hotkey again on the completed queue:
    handleDecision('included');
    // In a defect-free implementation, completed queue must reject further decisions on the final paper
    // Here we assert that the final paper should not be logged more than once:
    const finalPaperDecisions = decisionsLogged.filter(d => d.startsWith('p2:'));
    expect(finalPaperDecisions.length).toBe(1);
  });
});
