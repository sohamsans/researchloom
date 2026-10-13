import asyncio
from typing import List, Optional
from app.models.schemas import (
    SearchRequest,
    PipelineResponse,
    ReviewPaper,
    RawPaperMetadata,
    TriageItem,
    SelectedPipelineRequest
)
from app.services.academic_search import discover_academic_papers
from app.services.pdf_service import get_paper_content_slices
from app.services.llm_provider import LLMService
from app.config import get_settings

async def process_paper_deep_extraction(
    paper: RawPaperMetadata,
    topic: str,
    score: int,
    rationale: str,
    llm: LLMService
) -> ReviewPaper:
    """Download OA PDF or fallback to abstract, then run Stage 2 deep extraction with Tier 2 caching."""
    from app.services.cache_service import get_cached_synthesis, save_paper_synthesis

    # 1. Check Tier 2 Synthesis Cache
    cached_synthesis = await get_cached_synthesis(paper.doi, paper.title)
    if cached_synthesis is not None:
        print(f"[Cache Hit: Tier 2 Synthesis] Reused review for '{paper.title[:50]}' (0 LLM tokens).")
        # Update relevance score from current triage if appropriate
        cached_synthesis.relevance_score = score
        cached_synthesis.triage_rationale = rationale
        return cached_synthesis

    doi_link = f"https://doi.org/{paper.doi}" if paper.doi else (paper.pdf_url or "")
    sliced_text, pdf_downloaded = await get_paper_content_slices(
        doi=paper.doi,
        pdf_url=paper.pdf_url,
        abstract=paper.abstract
    )

    paper_meta = {
        "id": paper.id,
        "title": paper.title,
        "year": paper.year,
        "authors": paper.authors,
        "venue": paper.venue,
        "relevance_score": score,
        "triage_rationale": rationale,
        "doi_link": doi_link,
        "pdf_downloaded": pdf_downloaded,
        "source": paper.source,
        "abstract": paper.abstract
    }

    review_item = await llm.deep_extraction(
        topic=topic,
        paper_meta=paper_meta,
        text_slice=sliced_text
    )

    # 2. Save into Tier 2 Synthesis Cache
    await save_paper_synthesis(review_item)

    return review_item

async def run_literature_review_pipeline(request: SearchRequest) -> PipelineResponse:
    """Execute complete end-to-end AutoLit AI review pipeline."""
    settings = get_settings()
    llm = LLMService(
        provider=request.model_provider,
        model_name=request.model_name,
        groq_key=request.groq_api_key,
        gemini_key=request.gemini_api_key,
        openrouter_key=request.openrouter_api_key,
        deepseek_key=request.deepseek_api_key,
        nvidia_key=request.nvidia_api_key,
        custom_key=request.custom_api_key,
        custom_base_url=request.custom_base_url
    )
    warnings: List[str] = []

    # Phase A: Academic Discovery (Deep Pool with Rate Shield)
    raw_papers: List[RawPaperMetadata] = await discover_academic_papers(
        topic=request.topic,
        max_results=request.max_results,
        offset=request.offset,
        exclude_dois=request.exclude_dois,
        year_min=request.year_min,
        year_max=request.year_max,
        no_year_constraint=request.no_year_constraint
    )

    if not raw_papers:
        return PipelineResponse(
            topic=request.topic,
            total_discovered=0,
            total_triaged=0,
            total_selected=0,
            papers=[],
            warnings=["No academic literature matching your query was found across discovery engines."]
        )

    # Phase B: Stage 1 Batch Triage (1 Cloud LLM call)
    candidate_dicts = [p.model_dump() for p in raw_papers]
    triage_result = await llm.batch_triage(topic=request.topic, candidates=candidate_dicts)
    triage_map = {item.id: item for item in triage_result.evaluations}

    # Filter top papers (score >= threshold, capped at max_top_papers)
    selected_papers: List[RawPaperMetadata] = []
    for p in raw_papers:
        triage_info = triage_map.get(p.id)
        score = triage_info.score if triage_info else 3
        if score >= request.relevance_threshold:
            selected_papers.append(p)
            if len(selected_papers) >= settings.max_top_papers:
                break

    if not selected_papers and raw_papers:
        sorted_by_score = sorted(
            raw_papers,
            key=lambda x: triage_map.get(x.id, TriageItem(id=x.id, score=1, rationale="")).score,
            reverse=True
        )
        selected_papers = sorted_by_score[:3]
        warnings.append(
            f"No papers met threshold score of {request.relevance_threshold}. Included top {len(selected_papers)} papers."
        )

    # Phase C & D: Deep Extraction (bounded with per-paper 14s timeout)
    extracted_papers: List[ReviewPaper] = []
    semaphore = asyncio.Semaphore(3)

    async def bounded_process(p: RawPaperMetadata):
        async with semaphore:
            t_info = triage_map.get(p.id)
            score = t_info.score if t_info else 4
            rationale = t_info.rationale if t_info else "Passed initial screening."
            try:
                return await asyncio.wait_for(
                    process_paper_deep_extraction(p, request.topic, score, rationale, llm),
                    timeout=14.0
                )
            except asyncio.TimeoutError:
                print(f"[Pipeline Deep Timeout] Paper '{p.title[:40]}' timed out, using lean fallback.")
                from app.services.llm_provider import parse_deep_fallback
                return parse_deep_fallback({
                    "id": p.id,
                    "title": p.title,
                    "year": p.year,
                    "authors": p.authors,
                    "venue": p.venue,
                    "relevance_score": score,
                    "triage_rationale": rationale,
                    "doi_link": f"https://doi.org/{p.doi}" if p.doi else (p.pdf_url or ""),
                    "pdf_downloaded": False,
                    "source": p.source,
                    "abstract": p.abstract
                }, p.abstract or "")

    tasks = [bounded_process(p) for p in selected_papers]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for res in results:
        if isinstance(res, ReviewPaper):
            extracted_papers.append(res)
        else:
            print(f"[Pipeline Error processing paper]: {res}")

    return PipelineResponse(
        topic=request.topic,
        total_discovered=len(raw_papers),
        total_triaged=len(triage_result.evaluations),
        total_selected=len(extracted_papers),
        papers=extracted_papers,
        warnings=warnings
    )

async def run_pipeline_on_selected_papers(request: SelectedPipelineRequest) -> PipelineResponse:
    """Step 2: Execute Stage 1 Triage & Stage 2 Deep Extraction on user-selected papers."""
    settings = get_settings()
    llm = LLMService(
        provider=request.model_provider,
        model_name=request.model_name,
        groq_key=request.groq_api_key,
        gemini_key=request.gemini_api_key,
        openrouter_key=request.openrouter_api_key,
        deepseek_key=request.deepseek_api_key,
        nvidia_key=request.nvidia_api_key,
        custom_key=request.custom_api_key,
        custom_base_url=request.custom_base_url
    )
    warnings: List[str] = []

    if not request.selected_papers:
        return PipelineResponse(
            topic=request.topic,
            total_discovered=0,
            total_triaged=0,
            total_selected=0,
            papers=[],
            warnings=["No papers were selected for synthesis."]
        )

    # Stage 1: Batch Triage on selected candidate set
    candidate_dicts = [p.model_dump() for p in request.selected_papers]
    triage_result = await llm.batch_triage(topic=request.topic, candidates=candidate_dicts)
    triage_map = {item.id: item for item in triage_result.evaluations}

    # Helper function for topical redundancy check (detect papers that repeat the same thing)
    import re
    def normalize_title_tokens(title: str) -> set:
        clean = re.sub(r"[^a-zA-Z0-9\s]", "", title.lower())
        stopwords = {"a", "an", "the", "and", "or", "of", "in", "for", "on", "with", "to", "at", "by", "from", "using", "based", "approach", "study", "via"}
        tokens = set(clean.split()) - stopwords
        return tokens

    def jaccard_similarity(s1: set, s2: set) -> float:
        if not s1 or not s2:
            return 0.0
        inter = len(s1.intersection(s2))
        union = len(s1.union(s2))
        return inter / union if union > 0 else 0.0

    # Filter papers strictly based on topical relevance (triage score >= relevance_threshold)
    relevant_candidates: List[RawPaperMetadata] = []
    for p in request.selected_papers:
        t_info = triage_map.get(p.id)
        score = t_info.score if t_info else 4
        if score >= request.relevance_threshold:
            relevant_candidates.append(p)

    if not relevant_candidates:
        # Fallback to candidates if threshold is overly stringent
        relevant_candidates = list(request.selected_papers)
        warnings.append(f"Evaluated all {len(relevant_candidates)} candidates across topical scope.")

    # Sort candidates by relevance score descending (vital 5 first, then 4)
    relevant_candidates.sort(key=lambda p: (triage_map.get(p.id).score if triage_map.get(p.id) else 4), reverse=True)

    # Dynamic Redundancy Filtering: Prune papers that repeat the exact same title/methodology
    unique_relevant_papers: List[RawPaperMetadata] = []
    seen_token_sets: List[set] = []
    redundant_pruned_count = 0

    for p in relevant_candidates:
        tokens = normalize_title_tokens(p.title)
        # Check if this paper's core title concepts heavily overlap (>0.75 Jaccard overlap) with an already accepted higher-scoring paper
        is_repeat = False
        for seen in seen_token_sets:
            if jaccard_similarity(tokens, seen) >= 0.75:
                is_repeat = True
                break
        
        if is_repeat:
            redundant_pruned_count += 1
            continue

        unique_relevant_papers.append(p)
        seen_token_sets.append(tokens)

    if redundant_pruned_count > 0:
        warnings.append(f"De-duplicated {redundant_pruned_count} redundant papers repeating identical topical coverage.")

    filtered = unique_relevant_papers

    # If the user explicitly provided a max_synthesis_count, respect it; otherwise synthesize all unique relevant papers
    if request.max_synthesis_count and request.max_synthesis_count > 0:
        filtered = filtered[:request.max_synthesis_count]

    # Deep extraction tier (for high-speed concurrency, deep extract up to 60 papers with full PDF/abstract slicing)
    max_deep_count = min(len(filtered), 60)
    deep_candidates = filtered[:max_deep_count]
    remaining_candidates = filtered[max_deep_count:]

    # Stage 2: Deep extraction (bounded with per-paper 14s timeout)
    extracted_papers: List[ReviewPaper] = []
    semaphore = asyncio.Semaphore(4)

    async def bounded_process(p: RawPaperMetadata):
        async with semaphore:
            t_info = triage_map.get(p.id)
            score = t_info.score if t_info else 4
            rationale = t_info.rationale if t_info else "Selected by researcher."
            try:
                return await asyncio.wait_for(
                    process_paper_deep_extraction(p, request.topic, score, rationale, llm),
                    timeout=14.0
                )
            except asyncio.TimeoutError:
                print(f"[Deep Extraction Timeout] Paper '{p.title[:40]}' timed out, using lean fallback.")
                from app.services.llm_provider import parse_deep_fallback
                return parse_deep_fallback({
                    "id": p.id,
                    "title": p.title,
                    "year": p.year,
                    "authors": p.authors,
                    "venue": p.venue,
                    "relevance_score": score,
                    "triage_rationale": rationale,
                    "doi_link": f"https://doi.org/{p.doi}" if p.doi else (p.pdf_url or ""),
                    "pdf_downloaded": False,
                    "source": p.source,
                    "abstract": p.abstract
                }, p.abstract or "")

    # Deep extract top candidates concurrently
    tasks = [bounded_process(p) for p in deep_candidates]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    for res in results:
        if isinstance(res, ReviewPaper):
            extracted_papers.append(res)
        else:
            print(f"[Selected Pipeline Error]: {res}")

    # For any remaining papers passing threshold beyond deep limit, include with high-speed abstract synthesis
    if remaining_candidates:
        from app.services.llm_provider import parse_deep_fallback
        for p in remaining_candidates:
            t_info = triage_map.get(p.id)
            score = t_info.score if t_info else 4
            rationale = t_info.rationale if t_info else "Selected candidate."
            fallback_paper = parse_deep_fallback({
                "id": p.id,
                "title": p.title,
                "year": p.year,
                "authors": p.authors,
                "venue": p.venue,
                "relevance_score": score,
                "triage_rationale": rationale,
                "doi_link": f"https://doi.org/{p.doi}" if p.doi else (p.pdf_url or ""),
                "pdf_downloaded": False,
                "source": p.source,
                "abstract": p.abstract
            }, p.abstract or "")
            extracted_papers.append(fallback_paper)

    return PipelineResponse(
        topic=request.topic,
        total_discovered=len(request.selected_papers),
        total_triaged=len(triage_result.evaluations),
        total_selected=len(extracted_papers),
        papers=extracted_papers,
        warnings=warnings
    )
