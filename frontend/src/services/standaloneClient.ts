/**
 * Standalone Client-Side Academic Discovery & LLM Synthesis Engine for ResearchLoom Android
 * Enables 100% standalone operation on mobile and tablets without a desktop server.
 */

import {
  RawPaperMetadata,
  ReviewPaper,
  SearchRequest,
  DiscoveryResponse,
  PipelineResponse,
  SnowballResponse,
  SnowballSeedMetadata,
  SnowballPaperItem,
  ScreeningDecisionRequest,
  ScreeningAuditItem,
  PRISMAStatsResponse,
  SynthesisDrafterRequest,
  SynthesisDrafterResponse,
  BibliographicReferenceItem,
  ReferenceImportResponse,
  VerifyDOIResponse
} from '../types';

interface OpenAlexWork {
  id: string;
  doi?: string | null;
  title?: string | null;
  publication_year?: number | null;
  authorships?: Array<{
    author?: {
      display_name?: string | null;
    };
  }>;
  primary_location?: {
    source?: {
      display_name?: string | null;
    };
    pdf_url?: string | null;
    landing_page_url?: string | null;
  };
  open_access?: {
    is_oa?: boolean;
    oa_url?: string | null;
  };
  abstract_inverted_index?: Record<string, number[]> | null;
}

/**
 * Reconstruct abstract from OpenAlex inverted index
 */
function reconstructAbstract(invertedIndex?: Record<string, number[]> | null): string {
  if (!invertedIndex) return '';
  const wordPositions: Array<{ word: string; pos: number }> = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    for (const pos of positions) {
      wordPositions.push({ word, pos });
    }
  }
  wordPositions.sort((a, b) => a.pos - b.pos);
  return wordPositions.map((w) => w.word).join(' ');
}

/**
 * Direct client-side OpenAlex search
 */
export async function searchOpenAlexStandalone(
  query: string,
  maxResults: number = 25,
  yearMin?: number,
  yearMax?: number
): Promise<RawPaperMetadata[]> {
  const url = new URL('https://api.openalex.org/works');
  url.searchParams.set('search', query);
  url.searchParams.set('per_page', Math.min(maxResults, 50).toString());
  url.searchParams.set('select', 'id,doi,title,publication_year,authorships,primary_location,open_access,abstract_inverted_index');
  url.searchParams.set('mailto', 'researchloom@client.local');

  const filters: string[] = [];
  if (yearMin && yearMax) {
    filters.push(`publication_year:${yearMin}-${yearMax}`);
  } else if (yearMin) {
    filters.push(`publication_year:>${yearMin - 1}`);
  } else if (yearMax) {
    filters.push(`publication_year:<${yearMax + 1}`);
  }
  if (filters.length > 0) {
    url.searchParams.set('filter', filters.join(','));
  }

  const response = await fetch(url.toString(), {
    headers: { 'Accept': 'application/json' }
  });

  if (!response.ok) {
    throw new Error(`OpenAlex query failed (${response.status})`);
  }

  const data = await response.json();
  const results: OpenAlexWork[] = data.results || [];

  return results.map((work) => {
    const authors = (work.authorships || [])
      .map((a) => a.author?.display_name)
      .filter((name): name is string => !!name);

    const doi = work.doi ? work.doi.replace(/^https?:\/\/doi\.org\//, '') : undefined;
    const pdfUrl = work.open_access?.oa_url || work.primary_location?.pdf_url || undefined;
    const abstract = reconstructAbstract(work.abstract_inverted_index);

    return {
      id: work.id.replace('https://openalex.org/', ''),
      title: work.title || 'Untitled Work',
      authors: authors.length > 0 ? authors : ['Unknown Author'],
      year: work.publication_year || new Date().getFullYear(),
      venue: work.primary_location?.source?.display_name || undefined,
      doi,
      abstract: abstract || '',
      is_oa: !!work.open_access?.is_oa,
      pdf_url: pdfUrl,
      source: 'OpenAlex'
    };
  });
}

/**
 * Direct client-side arXiv search
 */
export async function searchArxivStandalone(
  query: string,
  maxResults: number = 15
): Promise<RawPaperMetadata[]> {
  try {
    const cleanQuery = query.replace(/[^\w\s]/gi, ' ').trim();
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(cleanQuery)}&start=0&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`;

    const response = await fetch(url);
    if (!response.ok) return [];

    const xmlText = await response.text();
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
    const entries = Array.from(xmlDoc.getElementsByTagName('entry'));

    return entries.map((entry) => {
      const idRaw = entry.getElementsByTagName('id')[0]?.textContent || '';
      const arxivId = idRaw.split('/abs/').pop() || idRaw;
      const title = entry.getElementsByTagName('title')[0]?.textContent?.replace(/\s+/g, ' ').trim() || 'Untitled';
      const summary = entry.getElementsByTagName('summary')[0]?.textContent?.replace(/\s+/g, ' ').trim() || '';
      const published = entry.getElementsByTagName('published')[0]?.textContent || '';
      const year = published ? parseInt(published.substring(0, 4), 10) : new Date().getFullYear();

      const authorNodes = Array.from(entry.getElementsByTagName('author'));
      const authors = authorNodes
        .map((a) => a.getElementsByTagName('name')[0]?.textContent?.trim())
        .filter((name): name is string => !!name);

      const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`;

      return {
        id: `arxiv_${arxivId.replace(/\./g, '_')}`,
        title,
        authors: authors.length > 0 ? authors : ['arXiv Contributor'],
        year,
        venue: 'arXiv Preprints',
        abstract: summary,
        is_oa: true,
        pdf_url: pdfUrl,
        source: 'arXiv'
      };
    });
  } catch {
    return [];
  }
}

/**
 * Deduplicate papers by DOI and normalized title
 */
export function deduplicatePapers(papers: RawPaperMetadata[]): RawPaperMetadata[] {
  const seenDois = new Set<string>();
  const seenTitles = new Set<string>();
  const unique: RawPaperMetadata[] = [];

  for (const paper of papers) {
    if (paper.doi) {
      const normDoi = paper.doi.toLowerCase().trim();
      if (seenDois.has(normDoi)) continue;
      seenDois.add(normDoi);
    }

    const normTitle = paper.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (normTitle && seenTitles.has(normTitle)) continue;
    if (normTitle) seenTitles.add(normTitle);

    unique.push(paper);
  }

  return unique;
}

/**
 * Client-Side LLM Call (Groq, Gemini, OpenRouter)
 */
export async function callClientLLM(
  prompt: string,
  systemPrompt: string,
  keys: { groq?: string; gemini?: string; claude?: string; openai?: string; openrouter?: string },
  preferredProvider: string = 'groq'
): Promise<string> {
  // Provider 1: Groq Cloud (Fast, generous rate limits)
  if (preferredProvider === 'groq' && keys.groq) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keys.groq.trim()}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2,
        max_tokens: 4096
      })
    });
    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    }
  }

  // Provider 2: Google Gemini
  if ((preferredProvider === 'gemini' || !keys.groq) && keys.gemini) {
    const model = 'gemini-1.5-flash';
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${keys.gemini.trim()}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 }
      })
    });
    if (res.ok) {
      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    }
  }

  // Provider 3: OpenAI
  if (preferredProvider === 'openai' && keys.openai) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keys.openai.trim()}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      })
    });
    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    }
  }

  // Provider 4: Anthropic Claude
  if (preferredProvider === 'claude' && keys.claude) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': keys.claude.trim(),
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2
      })
    });
    if (res.ok) {
      const data = await res.json();
      return data.content?.[0]?.text || '';
    }
  }

  // Provider 5: OpenRouter
  if (keys.openrouter) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keys.openrouter.trim()}`
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.2
      })
    });
    if (res.ok) {
      const data = await res.json();
      return data.choices?.[0]?.message?.content || '';
    }
  }

  throw new Error('No working BYOK LLM key configured on device. Please enter your Groq, Gemini, or OpenRouter key in Settings.');
}

/**
 * Execute standalone discovery workflow
 */
export async function executeStandaloneDiscover(req: SearchRequest): Promise<DiscoveryResponse> {
  const [openAlexPapers, arxivPapers] = await Promise.all([
    searchOpenAlexStandalone(req.topic, req.max_results, req.year_min, req.year_max).catch(() => []),
    searchArxivStandalone(req.topic, Math.min(req.max_results, 15)).catch(() => [])
  ]);

  const combined = deduplicatePapers([...openAlexPapers, ...arxivPapers]);

  return {
    topic: req.topic,
    total_discovered: combined.length,
    papers: combined,
    warnings: []
  };
}

/**
 * Execute standalone synthesis pipeline
 */
export async function executeStandalonePipeline(
  papers: RawPaperMetadata[],
  topic: string,
  keys: { groq?: string; gemini?: string; claude?: string; openai?: string; openrouter?: string },
  provider: string = 'groq'
): Promise<PipelineResponse> {
  const candidateSummary = papers.slice(0, 15).map((p, i) => `[${i + 1}] "${p.title}" (${p.year}) - Authors: ${p.authors.join(', ')}\nAbstract: ${p.abstract?.slice(0, 300) || 'None'}`).join('\n\n');

  const systemPrompt = `You are ResearchLoom's autonomous academic literature synthesizer.
Analyze the provided papers on the topic: "${topic}".
Output ONLY valid JSON matching this schema:
{
  "synthesized_papers": [
    {
      "index": 1,
      "title": "string",
      "authors": ["string"],
      "year": 2024,
      "venue": "string",
      "doi": "string",
      "relevance_score": 5,
      "relevance_reason": "string",
      "core_problem": "string",
      "methodology": "string",
      "key_findings": "string",
      "limitations": "string"
    }
  ]
}
Do not include markdown code block formatting or backticks around the JSON.`;

  const rawJson = await callClientLLM(
    `Synthesize these literature candidates for the topic: "${topic}":\n\n${candidateSummary}`,
    systemPrompt,
    keys,
    provider
  );

  const cleanJson = rawJson.replace(/```json/gi, '').replace(/```/g, '').trim();
  let parsedData: any;
  try {
    parsedData = JSON.parse(cleanJson);
  } catch {
    parsedData = { synthesized_papers: [] };
  }

  const synthesizedList: ReviewPaper[] = (parsedData.synthesized_papers || []).map((sp: any, idx: number) => {
    const raw = papers[idx] || papers[0];
    return {
      id: raw?.id || `synth_${idx}`,
      title: sp.title || raw?.title || 'Unknown Title',
      authors: sp.authors || raw?.authors || ['Unknown Author'],
      year: sp.year || raw?.year || new Date().getFullYear(),
      venue: sp.venue || raw?.venue,
      relevance_score: sp.relevance_score || 5,
      triage_rationale: sp.relevance_reason || 'Synthesized directly on device.',
      core_problem: sp.core_problem || 'Investigating key research questions in domain.',
      methodology: sp.methodology || 'Empirical data collection and synthesis.',
      key_findings: sp.key_findings || 'Demonstrated measurable results under evaluation.',
      research_gaps: sp.limitations || 'Limited sample size and localized constraints.',
      critical_remarks: 'Synthesized via standalone client pipeline.',
      doi_link: raw?.doi ? `https://doi.org/${raw.doi}` : '',
      pdf_downloaded: !!raw?.pdf_url,
      source: raw?.source || 'OpenAlex'
    };
  });

  return {
    topic,
    total_discovered: papers.length,
    total_triaged: synthesizedList.length,
    total_selected: synthesizedList.length,
    papers: synthesizedList,
    warnings: []
  };
}

// ============================================================================
// STANDALONE CITATION SNOWBALLING (OpenAlex Direct CORS)
// ============================================================================

export async function executeStandaloneSnowballing(
  seedIdentifier: string,
  direction: 'backward' | 'forward',
  maxResults: number = 25,
  title?: string
): Promise<SnowballResponse> {
  let cleanId = seedIdentifier.trim();
  const politeEmail = 'autolit@research.local';
  let seedWork: OpenAlexWork | null = null;
  const warnings: string[] = [];

  // 1. Try canonical OpenAlex ID W...
  if (/^W\d+$/i.test(cleanId)) {
    try {
      const resp = await fetch(`https://api.openalex.org/works/${cleanId.toUpperCase()}?mailto=${politeEmail}`);
      if (resp.ok) seedWork = await resp.json();
    } catch {}
  }

  // 2. Try arXiv ID (normalize arxiv_1706_03762 or arxiv:1706.03762)
  if (!seedWork) {
    let normArxiv = cleanId.replace(/^arxiv[_\:]/i, '').trim();
    if (normArxiv.includes('_') && /^\d{4}_\d{4,5}(?:v\d+)?$/i.test(normArxiv)) {
      normArxiv = normArxiv.replace('_', '.');
    }
    const match = normArxiv.match(/^(\d{4}\.\d{4,5}(?:v\d+)?)$/i);
    if (match) {
      try {
        const resp = await fetch(`https://api.openalex.org/works/https://arxiv.org/abs/${match[1]}?mailto=${politeEmail}`);
        if (resp.ok) seedWork = await resp.json();
      } catch {}
    }
  }

  // 3. Try DOI
  if (!seedWork) {
    let cleanDoi = cleanId;
    for (const prefix of ['https://doi.org/', 'http://doi.org/', 'http://dx.doi.org/', 'https://dx.doi.org/', 'doi:']) {
      if (cleanDoi.toLowerCase().startsWith(prefix)) {
        cleanDoi = cleanDoi.slice(prefix.length);
        break;
      }
    }
    if (cleanDoi.includes('/')) {
      try {
        const resp = await fetch(`https://api.openalex.org/works/https://doi.org/${encodeURIComponent(cleanDoi)}?mailto=${politeEmail}`);
        if (resp.ok) seedWork = await resp.json();
      } catch {}
    }
  }

  // 4. Try title search or cleanId search if not synthetic
  if (!seedWork) {
    const searchQuery = title && title.trim().length > 3 ? title.trim() : (!cleanId.startsWith('synth_') && cleanId.length > 3 ? cleanId : '');
    if (searchQuery) {
      try {
        const resp = await fetch(`https://api.openalex.org/works?search=${encodeURIComponent(searchQuery)}&per-page=1&mailto=${politeEmail}`);
        if (resp.ok) {
          const data = await resp.json();
          if (data.results && data.results.length > 0) {
            seedWork = data.results[0];
          }
        }
      } catch {}
    }
  }

  // If still not resolved from OpenAlex, fallback to local synthetic metadata
  const canonicalId = seedWork?.id ? seedWork.id.split('/').pop() || seedWork.id : (cleanId.startsWith('W') ? cleanId : `local_${Date.now()}`);
  const seedTitle = seedWork?.title || title || 'Seed Paper';
  const seedYear = seedWork?.publication_year || undefined;
  const seedAuthors = seedWork?.authorships?.map(a => a.author?.display_name).filter(Boolean) as string[] || ['Unknown Author'];

  const seedMeta: SnowballSeedMetadata = {
    openalex_id: canonicalId,
    doi: seedWork?.doi?.replace('https://doi.org/', '') || undefined,
    title: seedTitle,
    year: seedYear,
    authors: seedAuthors,
    cited_by_count: (seedWork as any)?.cited_by_count || 0,
    referenced_works_count: (seedWork as any)?.referenced_works?.length || 0,
    venue: seedWork?.primary_location?.source?.display_name || undefined,
    is_oa: !!seedWork?.open_access?.is_oa,
    oa_url: seedWork?.open_access?.oa_url || seedWork?.primary_location?.pdf_url || undefined
  };

  if (!seedWork || !seedWork.id) {
    warnings.push('Could not locate seed on OpenAlex. Live citation network unavailable offline.');
    return {
      seed: seedMeta,
      direction,
      total_count: 0,
      papers: [],
      warnings
    };
  }

  // Query OpenAlex for cited_by (backward) or cites (forward)
  const filterParam = direction === 'backward' ? `cited_by:${canonicalId}` : `cites:${canonicalId}`;
  const relationLabel: 'predecessor' | 'successor' = direction === 'backward' ? 'predecessor' : 'successor';
  const queryUrl = `https://api.openalex.org/works?filter=${filterParam}&per-page=${maxResults}&sort=cited_by_count:desc&mailto=${politeEmail}`;

  try {
    const resp = await fetch(queryUrl);
    if (!resp.ok) throw new Error(`OpenAlex HTTP ${resp.status}`);
    const data = await resp.json();
    const results: OpenAlexWork[] = data.results || [];

    const papers: SnowballPaperItem[] = results.map(w => {
      const wId = w.id ? w.id.split('/').pop() || w.id : `w_${Date.now()}`;
      return {
        id: wId,
        doi: w.doi ? w.doi.replace('https://doi.org/', '') : undefined,
        title: w.title || 'Untitled Paper',
        year: w.publication_year || undefined,
        authors: w.authorships?.map(a => a.author?.display_name).filter(Boolean) as string[] || ['Unknown Author'],
        cited_by_count: (w as any).cited_by_count || 0,
        venue: w.primary_location?.source?.display_name || undefined,
        abstract: reconstructAbstract(w.abstract_inverted_index),
        is_oa: !!w.open_access?.is_oa,
        oa_url: w.open_access?.oa_url || w.primary_location?.pdf_url || undefined,
        relation: relationLabel,
        source: 'openalex'
      };
    });

    return {
      seed: seedMeta,
      direction,
      total_count: data.meta?.count || papers.length,
      papers,
      warnings
    };
  } catch (err: any) {
    warnings.push(`Could not fetch citations: ${err.message || 'Offline or network blocked'}`);
    return {
      seed: seedMeta,
      direction,
      total_count: 0,
      papers: [],
      warnings
    };
  }
}

// ============================================================================
// STANDALONE PRISMA 2020 SCREENING & AUDIT (LocalStorage Persistence)
// ============================================================================

const SCREENING_STORAGE_PREFIX = 'researchloom_screening_decisions_';

export function saveStandaloneScreeningDecision(req: ScreeningDecisionRequest): ScreeningAuditItem {
  const wsId = req.workspace_id || 'default_workspace';
  const storageKey = `${SCREENING_STORAGE_PREFIX}${wsId}`;
  const existingRaw = localStorage.getItem(storageKey);
  const existing: ScreeningAuditItem[] = existingRaw ? JSON.parse(existingRaw) : [];

  const auditItem: ScreeningAuditItem = {
    id: `decision_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    workspace_id: wsId,
    paper_id: req.paper_id,
    paper_title: req.paper_title,
    paper_doi: req.paper_doi,
    action: req.action,
    exclusion_reason: req.exclusion_reason,
    stage: req.stage || 'screening',
    reviewer_id: req.reviewer_id || 'primary_researcher',
    notes: req.notes,
    created_at: new Date().toISOString()
  };

  // Upsert decision (if paper already decided, replace with newest)
  const filtered = existing.filter(d => d.paper_id !== req.paper_id);
  filtered.push(auditItem);
  localStorage.setItem(storageKey, JSON.stringify(filtered));

  return auditItem;
}

export function getStandalonePRISMAStats(workspaceId: string = 'default_workspace', totalIdentified: number = 0): PRISMAStatsResponse {
  const storageKey = `${SCREENING_STORAGE_PREFIX}${workspaceId}`;
  const existingRaw = localStorage.getItem(storageKey);
  const decisions: ScreeningAuditItem[] = existingRaw ? JSON.parse(existingRaw) : [];

  let screenExcluded = 0;
  const screenExcludedByReason: Record<string, number> = {};
  let totalIncluded = 0;

  decisions.forEach(d => {
    if (d.action === 'excluded') {
      screenExcluded++;
      const reason = d.exclusion_reason || 'Other / Unspecified';
      screenExcludedByReason[reason] = (screenExcludedByReason[reason] || 0) + 1;
    } else if (d.action === 'included') {
      totalIncluded++;
    }
  });

  const totalScreened = decisions.length;
  const identifiedCount = Math.max(totalIdentified, totalScreened);

  return {
    total_identified: identifiedCount,
    duplicates_removed: 0,
    total_screened: totalScreened,
    screen_excluded: screenExcluded,
    screen_excluded_by_reason: screenExcludedByReason,
    eligibility_assessed: totalIncluded,
    eligibility_excluded: 0,
    eligibility_excluded_by_reason: {},
    total_included: totalIncluded,
    recent_audit_log: decisions.slice(-20).reverse()
  };
}

// ============================================================================
// STANDALONE EVIDENCE MATRIX SYNTHESIS (Client BYOK LLM)
// ============================================================================

export async function executeStandaloneMatrixSynthesis(
  req: SynthesisDrafterRequest,
  keys: { groq?: string; gemini?: string; claude?: string; openai?: string; openrouter?: string },
  provider: 'groq' | 'gemini' | 'claude' | 'openai' | 'openrouter' = 'groq'
): Promise<SynthesisDrafterResponse> {
  const paperSummaries = req.papers.map((p, idx) => {
    const citeKey = `${(p.authors[0] || 'Unknown').split(' ')[0]}${p.year || 2024}`;
    return `[${citeKey}] "${p.title}" (${p.year || 'N/A'})\nAbstract: ${p.abstract?.slice(0, 500) || 'N/A'}\nKey cells: ${JSON.stringify(p.extracted_cells || {})}`;
  }).join('\n\n');

  const lensPrompt = {
    contrastive: 'Highlight core methodological differences, trade-offs, and divergent conclusions between the studies.',
    discrepancies: 'Focus sharply on empirical conflicts, contradictory metrics, and disputed claims.',
    consensus: 'Synthesize shared principles, robust commonalities, and universal baselines across the works.',
    gaps: 'Identify unaddressed questions, benchmark omissions, and critical research frontiers left open.'
  }[req.synthesis_lens] || 'Synthesize comparative insights across the literature.';

  const systemPrompt = `You are a distinguished academic synthesis specialist. Synthesize the provided papers into a rigorous, publication-grade academic section adhering to the lens: ${req.synthesis_lens.toUpperCase()}.
Requirements:
1. Provide a section_title.
2. Structure the text into 2-3 scholarly paragraphs. In each paragraph, embed standard academic citation keys (e.g. \\cite{Vaswani2017}) and list cited_keys in the cited_keys array.
3. Provide full_latex_section containing the complete formatted LaTeX code.
4. Provide bibtex_entries as an array of BibTeX strings for the cited works.
Output ONLY valid JSON matching this structure:
{
  "section_title": "string",
  "paragraphs": [
    {
      "subheading": "string",
      "text": "string",
      "cited_keys": ["Key2024"]
    }
  ],
  "full_latex_section": "string",
  "bibtex_entries": ["@article{...}"]
}
Do not wrap in markdown or backticks.`;

  const rawJson = await callClientLLM(
    `Topic: "${req.topic}"\n\nAnalytical Directive: ${lensPrompt}\n\nEvidence Papers:\n${paperSummaries}`,
    systemPrompt,
    keys,
    provider
  );

  const cleanJson = rawJson.replace(/```json/gi, '').replace(/```/g, '').trim();
  try {
    const parsed = JSON.parse(cleanJson);
    return {
      section_title: parsed.section_title || `Comparative Analysis: ${req.topic}`,
      paragraphs: parsed.paragraphs || [],
      full_latex_section: parsed.full_latex_section || '',
      bibtex_entries: parsed.bibtex_entries || [],
      model_used: `Standalone client (${provider})`,
      lens_applied: req.synthesis_lens
    };
  } catch {
    return {
      section_title: `Comparative Analysis: ${req.topic}`,
      paragraphs: [
        {
          subheading: 'Synthesis Overview',
          text: cleanJson,
          cited_keys: []
        }
      ],
      full_latex_section: `\\section{Comparative Analysis}\n${cleanJson}`,
      bibtex_entries: [],
      model_used: `Standalone client (${provider})`,
      lens_applied: req.synthesis_lens
    };
  }
}

// ============================================================================
// STANDALONE BIBTEX / CSL IMPORT & CROSSREF DOI VERIFICATION
// ============================================================================

const BIB_STORAGE_PREFIX = 'researchloom_references_';

export function importStandaloneReferences(
  format: 'bibtex' | 'csl-json',
  content: string,
  collectionName: string = 'Imported Collection'
): ReferenceImportResponse {
  const existingRaw = localStorage.getItem(BIB_STORAGE_PREFIX);
  const existing: BibliographicReferenceItem[] = existingRaw ? JSON.parse(existingRaw) : [];

  const parsedItems: BibliographicReferenceItem[] = [];

  if (format === 'bibtex') {
    // Lightweight client-side BibTeX regex parser
    const entryRegex = /@(\w+)\s*\{\s*([^,]+),([^@]*)/g;
    let match: RegExpExecArray | null;
    while ((match = entryRegex.exec(content)) !== null) {
      const entryType = match[1].toLowerCase();
      const citationKey = match[2].trim();
      const body = match[3];

      const getField = (field: string): string => {
        const fMatch = body.match(new RegExp(`${field}\\s*=\\s*[{"]([^}"]+)[}"]`, 'i'));
        return fMatch ? fMatch[1].trim() : '';
      };

      const title = getField('title') || 'Untitled Reference';
      const yearStr = getField('year');
      const year = yearStr ? parseInt(yearStr, 10) : undefined;
      const authorsStr = getField('author');
      const authors = authorsStr ? authorsStr.split(/\s+and\s+/i).map(a => a.trim()) : ['Unknown Author'];
      const doi = getField('doi') || undefined;
      const venue = getField('journal') || getField('booktitle') || undefined;

      const firstAuthor = authors[0] ? authors[0].split(',')[0].trim() : 'Unknown';
      const citeAuthorYear = `${firstAuthor} et al., ${year || 'n.d.'}`;

      parsedItems.push({
        id: `bib_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        citation_key: citationKey,
        cite_author_year: citeAuthorYear,
        entry_type: entryType,
        title,
        authors,
        year,
        venue,
        doi,
        doi_verified: false,
        bibtex_raw: `@${entryType}{${citationKey},\n${body.trim()}}`,
        collection_name: collectionName,
        source: 'bibtex_import',
        is_vaulted: true,
        created_at: new Date().toISOString()
      });
    }
  } else {
    // CSL-JSON
    try {
      const jsonList = JSON.parse(content);
      const items = Array.isArray(jsonList) ? jsonList : [jsonList];
      items.forEach((csl: any) => {
        const authors = (csl.author || []).map((a: any) => `${a.family || ''} ${a.given || ''}`.trim()).filter(Boolean);
        const year = csl.issued?.['date-parts']?.[0]?.[0] || undefined;
        const firstAuthor = authors[0]?.split(' ')[0] || 'Unknown';
        parsedItems.push({
          id: `csl_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
          citation_key: csl.id || `${firstAuthor}${year || 2024}`,
          cite_author_year: `${firstAuthor} et al., ${year || 'n.d.'}`,
          entry_type: csl.type || 'article',
          title: csl.title || 'Untitled Reference',
          authors: authors.length ? authors : ['Unknown Author'],
          year,
          venue: csl['container-title'] || undefined,
          doi: csl.DOI || undefined,
          doi_verified: false,
          collection_name: collectionName,
          source: 'csl_import',
          is_vaulted: true,
          created_at: new Date().toISOString()
        });
      });
    } catch {}
  }

  // Deduplicate and append to existing
  let importedCount = 0;
  let duplicatesMerged = 0;
  parsedItems.forEach(item => {
    const dupIdx = existing.findIndex(e => (item.doi && e.doi === item.doi) || e.citation_key === item.citation_key);
    if (dupIdx >= 0) {
      existing[dupIdx] = { ...existing[dupIdx], ...item };
      duplicatesMerged++;
    } else {
      existing.push(item);
      importedCount++;
    }
  });

  localStorage.setItem(BIB_STORAGE_PREFIX, JSON.stringify(existing));

  return {
    total_parsed: parsedItems.length,
    imported_count: importedCount,
    duplicates_merged: duplicatesMerged,
    references: parsedItems,
    warnings: []
  };
}

export function getStandaloneReferences(collectionName?: string): BibliographicReferenceItem[] {
  const existingRaw = localStorage.getItem(BIB_STORAGE_PREFIX);
  const existing: BibliographicReferenceItem[] = existingRaw ? JSON.parse(existingRaw) : [];
  if (collectionName) {
    return existing.filter(r => r.collection_name === collectionName);
  }
  return existing;
}

export async function verifyStandaloneDOI(doi: string): Promise<VerifyDOIResponse> {
  const clean = doi.replace(/^https?:\/\/doi\.org\//i, '').trim();
  try {
    const resp = await fetch(`https://api.crossref.org/works/${encodeURIComponent(clean)}`);
    if (resp.ok) {
      const data = await resp.json();
      const message = data.message || {};
      return {
        doi: clean,
        verified: true,
        title: message.title?.[0],
        venue: message['container-title']?.[0],
        year: message.issued?.['date-parts']?.[0]?.[0] || undefined,
        citation_count: message['is-referenced-by-count'] || 0
      };
    }
  } catch {}
  return {
    doi: clean,
    verified: false,
    error: 'Could not verify DOI against Crossref.'
  };
}
