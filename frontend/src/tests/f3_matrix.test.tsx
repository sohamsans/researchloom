import { describe, it, expect } from 'vitest';
import { validateMatrixSelection } from '../components/matrix/EvidenceMatrixStudio';
import { generateStandaloneCitationKey } from '../services/standaloneClient';

describe('Feature 3: Evidence Matrix Studio', () => {
  it('enforces maximum 15-paper row selection guard for comparative synthesis', () => {
    // In EvidenceMatrixStudio.tsx line 351:
    // handleSynthesizeSelectedSection checks `if (selectedPaperIds.size < 2)`
    // and `if (selectedPaperIds.size > 15)`, while FastAPI backend
    // `SynthesisDrafterRequest` schema strictly enforces max_length=15, triggering HTTP 422.

    const selectedPaperIds = new Set(Array.from({ length: 16 }, (_, i) => `paper_${i}`));

    // In a defect-free implementation, selecting 16 papers should be guarded against:
    const isValid = validateMatrixSelection(selectedPaperIds.size);
    // Assertion: 16 papers must NOT be valid for synthesis
    expect(isValid).toBe(false);
  });

  it('generates citation key using author surname in standalone client parity with backend', () => {
    // In standaloneClient.ts line 654:
    // For "Ashish Vaswani", split(' ')[0] was "Ashish", producing "Ashish2017" instead of "Vaswani2017".

    const author = "Ashish Vaswani";
    const year = 2017;

    const currentCiteKey = generateStandaloneCitationKey(author, year);

    // Expected academic standard parity with backend normalize_citation_key:
    expect(currentCiteKey).toBe("Vaswani2017");
  });
});
