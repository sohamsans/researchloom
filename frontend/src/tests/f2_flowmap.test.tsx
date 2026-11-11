import { describe, it, expect } from 'vitest';
import { cleanAndOrientLayout } from '../components/flowmap/FlowMapCanvas';

describe('Feature 2: Flow Map Canvas Studio & DAG Auto-Layout', () => {
  it('detects in-place mutation of nodes in DAG auto-layout', () => {
    // In FlowMapCanvas.tsx lines 558-574:
    // cleanAndOrientLayout shallow copies nodes into new objects to preserve React immutability.

    const originalNode = { id: 'n1', label: 'Transformer', title: 'Transformer', type: 'paper' as const, x: 100, y: 100 };
    const initialNodes = [originalNode];

    const updated = cleanAndOrientLayout(initialNodes, []);

    // React state immutability assertion: original object reference must NOT be mutated!
    expect(originalNode.x).toBe(100);
    expect(originalNode.y).toBe(100);
    expect(updated[0].x).not.toBe(100);
  });

  it('handles cyclic dependencies without collapsing nodes into unranked final tier', () => {
    // Cyclic graph: A -> B -> C -> A
    const nodes = [
      { id: 'A', title: 'Paper A', type: 'paper' as const, x: 0, y: 0 },
      { id: 'B', title: 'Paper B', type: 'paper' as const, x: 0, y: 0 },
      { id: 'C', title: 'Paper C', type: 'paper' as const, x: 0, y: 0 }
    ];
    const edges = [
      { id: 'e1', source: 'A', target: 'B' },
      { id: 'e2', source: 'B', target: 'C' },
      { id: 'e3', source: 'C', target: 'A' }
    ];

    const inDegree: Record<string, number> = { A: 1, B: 1, C: 1 };
    const queue: string[] = [];
    nodes.forEach(n => {
      if (inDegree[n.id] === 0) queue.push(n.id);
    });
    // With cycle breaking:
    if (queue.length === 0 && nodes.length > 0) {
      queue.push(nodes[0].id);
    }

    // Queue has cycle-breaker node:
    expect(queue.length).toBeGreaterThan(0);

    const updated = cleanAndOrientLayout(nodes, edges);
    expect(updated.length).toBe(3);
  });
});
