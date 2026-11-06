import json
import re
import logging
from typing import List, Dict, Any, Tuple
from app.models.schemas import (
    SynthesisDrafterRequest,
    SynthesisDrafterResponse,
    SynthesisParagraph,
    MatrixPaperSummary,
    VaultPaperItem
)
from app.services.llm_provider import UniversalLLMClient, clean_json_text
from app.services.bulk_download_service import normalize_citation_key, generate_bibtex_entry, escape_latex_text

logger = logging.getLogger(__name__)

LENS_PROMPT_MAP = {
    "contrastive": "Focus intensely on divergent approaches, architectural tradeoffs, and contrasting assumptions between papers.",
    "discrepancies": "Focus on conflicting empirical results, contradictory findings, and irreconcilable evaluation claims.",
    "consensus": "Focus on converging paradigms, universally confirmed empirical results, and emerging community consensus.",
    "gaps": "Focus on unaddressed edge cases, failure modes, scalability bottlenecks, and open questions left by these studies."
}

def derive_paper_cite_key(p: MatrixPaperSummary) -> str:
    """Derive strict [Author][Year] citation key (e.g. Vaswani2017) for prompt whitelist."""
    first_author = "Unknown"
    if p.authors:
        raw_author = p.authors[0].strip()
        first_author = raw_author.split(",")[0].strip() if "," in raw_author else raw_author.split()[-1].strip()
        first_author = re.sub(r"[^A-Za-z]", "", first_author).capitalize() or "Author"
    year_str = str(p.year) if p.year and 1800 <= p.year <= 2100 else "Nd"
    return f"{first_author}{year_str}"

async def generate_comparative_synthesis_section(req: SynthesisDrafterRequest) -> SynthesisDrafterResponse:
    """
    Synthesize comparative literature review section from evidence matrix rows using free-tier cloud LLMs.
    Enforces strict GEMINI.md limits: 250-word abstract cap, <=12,000 char prompt budget, and citation key firewall.
    """
    n_papers = len(req.papers)
    char_budget_per_paper = max(400, 9500 // n_papers)

    # 1. Map input papers to valid citation keys and build paper payload
    paper_key_map: Dict[str, MatrixPaperSummary] = {}
    valid_keys: List[str] = []
    paper_summaries_payload = []

    for idx, p in enumerate(req.papers):
        cite_key = derive_paper_cite_key(p)
        # Avoid collisions in whitelist
        orig_key = cite_key
        collision_count = 1
        while cite_key in paper_key_map:
            cite_key = f"{orig_key}{chr(96 + collision_count)}"
            collision_count += 1

        paper_key_map[cite_key] = p
        valid_keys.append(cite_key)

        # Truncate abstract to 250 words max
        abs_words = p.abstract.split() if p.abstract else []
        clean_abs = " ".join(abs_words[:250])

        # Pack extracted cells
        cells_str = ", ".join(f"{k}: {v}" for k, v in p.extracted_cells.items()) if p.extracted_cells else "None"

        summary_text = (
            f"Paper Key: {cite_key}\n"
            f"Title: {p.title}\n"
            f"Authors: {', '.join(p.authors[:4]) if p.authors else 'Unknown'}\n"
            f"Year: {p.year or 'N/A'}\n"
            f"Extracted Matrix Attributes: {cells_str}\n"
            f"Abstract / Summary: {clean_abs}"
        )
        # Clamp to per-paper char budget
        clamped_summary = summary_text[:char_budget_per_paper]
        paper_summaries_payload.append(clamped_summary)

    lens_instruction = LENS_PROMPT_MAP.get(req.synthesis_lens, LENS_PROMPT_MAP["contrastive"])

    system_prompt = (
        "You are an expert academic peer-reviewer and literature review synthesizer. "
        "Your task is to synthesize the provided papers into a rigorous, comparative academic section.\n"
        "STRICT CITATION RULES:\n"
        f"1. You may ONLY cite papers using the LaTeX command \\cite{{Key}} using these exact valid keys: {valid_keys}.\n"
        "2. Do NOT invent, hallucinate, or alter any citation keys.\n"
        "3. Every paragraph MUST compare at least two papers directly.\n"
        "4. Output MUST be valid JSON adhering strictly to the schema provided.\n"
        f"SYNTHESIS FOCUS: {lens_instruction}"
    )

    user_prompt = (
        f"Topic: {req.topic}\n\n"
        "Candidate Papers:\n"
        + "\n---\n".join(paper_summaries_payload) + "\n\n"
        "Generate a structured comparative literature review section as JSON with this exact structure:\n"
        "{\n"
        '  "section_title": "Descriptive Academic Title",\n'
        '  "paragraphs": [\n'
        '    {\n'
        '      "subheading": "Theme or Methodological Contrast",\n'
        '      "text": "Detailed synthesis text with \\cite{Key} citations...",\n'
        '      "cited_keys": ["Key1", "Key2"]\n'
        '    }\n'
        '  ]\n'
        "}"
    )

    llm = UniversalLLMClient(
        provider=req.model_provider or "groq",
        model_name=req.model_name,
        groq_key=req.groq_api_key,
        gemini_key=req.gemini_api_key,
        claude_key=req.claude_api_key,
        openai_key=req.openai_api_key,
        openrouter_key=req.openrouter_api_key,
        deepseek_key=req.deepseek_api_key,
        nvidia_key=req.nvidia_api_key,
        custom_key=req.custom_api_key,
        custom_base_url=req.custom_base_url
    )

    raw_response = await llm.chat_completion(
        system_prompt=system_prompt,
        user_prompt=user_prompt,
        max_tokens=2200,
        response_json=True
    )

    # Clean and parse JSON
    cleaned_json = clean_json_text(raw_response)
    try:
        data = json.loads(cleaned_json)
    except Exception as e:
        logger.error(f"[Synthesis] JSON decode error: {e}. Raw: {raw_response[:300]}")
        raise ValueError(f"LLM produced non-JSON synthesis response: {str(e)}")

    section_title = data.get("section_title") or f"Comparative Analysis: {req.topic[:40]}"
    raw_paragraphs = data.get("paragraphs") or []

    # 2. Whitelist Verification & Hallucination Firewall
    paragraphs: List[SynthesisParagraph] = []
    all_cited_keys_set = set()

    for p_obj in raw_paragraphs:
        subhead = p_obj.get("subheading") or "Comparative Insights"
        raw_text = p_obj.get("text") or ""

        # Extract all \cite{...} tokens from text
        found_cites = re.findall(r"\\cite\{([^}]+)\}", raw_text)
        validated_cites_in_p = []

        def replace_cite_tag(match):
            key = match.group(1).strip()
            if key in valid_keys:
                validated_cites_in_p.append(key)
                all_cited_keys_set.add(key)
                return f"\\cite{{{key}}}"
            # Check if key is partial match
            for vk in valid_keys:
                if key.lower() in vk.lower() or vk.lower() in key.lower():
                    validated_cites_in_p.append(vk)
                    all_cited_keys_set.add(vk)
                    return f"\\cite{{{vk}}}"
            # Hallucinated key - strip citation command
            logger.warning(f"[Synthesis Firewall] Stripped hallucinated key '{key}'")
            return ""

        sanitized_text = re.sub(r"\\cite\{([^}]+)\}", replace_cite_tag, raw_text)

        paragraphs.append(SynthesisParagraph(
            subheading=subhead,
            text=sanitized_text,
            cited_keys=list(set(validated_cites_in_p))
        ))

    # 3. Assemble Full LaTeX Section
    latex_lines = [f"\\section{{{escape_latex_text(section_title)}}}", ""]
    for p in paragraphs:
        if p.subheading:
            latex_lines.append(f"\\subsection{{{escape_latex_text(p.subheading)}}}")
        latex_lines.append(p.text)
        latex_lines.append("")

    full_latex = "\n".join(latex_lines)

    # 4. Generate BibTeX entries for all cited papers
    bibtex_entries: List[str] = []
    for key in all_cited_keys_set:
        if key in paper_key_map:
            p_meta = paper_key_map[key]
            vault_item = VaultPaperItem(
                id=p_meta.paper_id,
                title=p_meta.title,
                authors=p_meta.authors,
                year=p_meta.year,
                venue=None,
                doi=p_meta.doi,
                abstract=p_meta.abstract,
                is_oa=False,
                pdf_url=None,
                source="matrix"
            )
            bib_str = generate_bibtex_entry(vault_item)
            bibtex_entries.append(bib_str)

    active_model = req.model_name or (req.model_provider or "groq")

    return SynthesisDrafterResponse(
        section_title=section_title,
        paragraphs=paragraphs,
        full_latex_section=full_latex,
        bibtex_entries=bibtex_entries,
        model_used=active_model,
        lens_applied=req.synthesis_lens
    )
