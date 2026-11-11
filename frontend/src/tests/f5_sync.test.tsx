import { describe, it, expect, vi, beforeEach } from 'vitest';
import { gatherEodCommitPayload } from '../services/api';

describe('Feature 5: Cross-Platform Standalone Mode & P2P Sync', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('gathers local references and notes from localStorage for End-of-Day commit payload', async () => {
    // Seed local references in localStorage
    const localPapers = [
      {
        id: 'tablet_paper_1',
        title: 'Offline Field Study on Active Stylus Latency',
        authors: ['Researcher Tablet'],
        year: 2026
      }
    ];
    localStorage.setItem('researchloom_references_', JSON.stringify(localPapers));

    let transmittedPayload: any = null;
    global.fetch = vi.fn().mockImplementation((url, options) => {
      if (url === '/api/sync/eod/commit') {
        transmittedPayload = JSON.parse(options.body);
        return Promise.resolve({
          ok: true,
          json: async () => ({ status: 'success', message: 'Committed' })
        });
      }
      return Promise.resolve({ ok: false });
    });

    const handleSyncCommit = async () => {
      const payload = gatherEodCommitPayload();
      await fetch('/api/sync/eod/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    };

    await handleSyncCommit();

    // Assertion: Transmitted payload MUST include the local papers from localStorage!
    expect(transmittedPayload).not.toBeNull();
    expect(transmittedPayload.new_papers.length).toBe(1);
    expect(transmittedPayload.new_papers[0].title).toBe('Offline Field Study on Active Stylus Latency');
  });
});
