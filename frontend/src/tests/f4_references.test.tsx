import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAllReferences } from '../services/api';

describe('Feature 4: Master Reference Manager Offline Fallback', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('falls back to offline localStorage references when backend fetch fails', async () => {
    // Seed offline references in localStorage
    const offlineRefs = [
      {
        id: 'ref_offline_1',
        title: 'Deep Residual Learning for Image Recognition',
        authors: ['Kaiming He'],
        year: 2016,
        citation_key: 'He2016Deep'
      }
    ];
    localStorage.setItem('researchloom_references_', JSON.stringify(offlineRefs));

    // Mock fetch failure (simulating offline mode)
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: async () => ({})
    });

    const result = await getAllReferences();

    // In a defect-free offline-first implementation, result.items must return the cached references:
    expect(result.items.length).toBe(1);
    expect(result.items[0].title).toBe('Deep Residual Learning for Image Recognition');
  });
});
