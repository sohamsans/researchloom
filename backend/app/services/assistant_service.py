import json
from typing import List, Optional
from app.config import get_settings
from app.models.schemas import AssistantChatMessage, AssistantChatResponse
from app.services.llm_provider import UniversalLLMClient, clean_json_text

def get_assistant_fallback(user_input: str, error_detail: Optional[str] = None) -> AssistantChatResponse:
    """Friendly fallback when LLM credentials are not configured or when an API error occurs."""
    if error_detail:
        reply = (
            f"Hello! I am your ResearchLoom (Samhita) Copilot.\n\n"
            f"⚠️ Diagnostic Notice: The active AI model returned an error:\n{error_detail}\n\n"
            "Please check your API key in BYOK Settings (or switch models via the top model switcher pill)."
        )
    else:
        reply = (
            "Hello! I am your ResearchLoom (Samhita) Copilot. To unlock full real-time conversational analysis and query translation, "
            "please add a free API key (such as Groq or Google Gemini) in BYOK Settings."
        )
    return AssistantChatResponse(
        assistant_reply=reply,
        clarifying_questions=[
            "What specific empirical or theoretical question are you aiming to solve?",
            "Which literature databases (arXiv, OpenAlex, Crossref) are you targeting?"
        ],
        suggested_queries=[
            "deep learning architectures survey",
            "autonomous trajectory optimization",
            "transformer attention mechanisms"
        ],
        suggested_year_min=2021,
        suggested_year_max=2026,
        recommended_threshold=4
    )

async def generate_assistant_response(
    messages: List[AssistantChatMessage],
    provider: Optional[str] = "groq",
    model_name: Optional[str] = None,
    groq_key: Optional[str] = None,
    gemini_key: Optional[str] = None,
    openrouter_key: Optional[str] = None,
    deepseek_key: Optional[str] = None,
    nvidia_key: Optional[str] = None,
    custom_key: Optional[str] = None,
    custom_base_url: Optional[str] = None
) -> AssistantChatResponse:
    """Generate interactive academic advice, clarifying questions, and queries using Universal LLM Hub."""
    transcript_lines = []
    last_user_text = ""
    for m in messages:
        role = "User" if m.role == "user" else "Assistant"
        transcript_lines.append(f"{role}: {m.content}")
        if m.role == "user":
            last_user_text = m.content

    transcript = "\n".join(transcript_lines)

    system_prompt = (
        "You are ResearchLoom (Samhita) Copilot, an elite conversational academic research advisor.\n"
        "Converse naturally and intelligently with the researcher, helping them clarify their research questions, brainstorm angles, and formulate precise queries.\n"
        "Return a valid JSON object with keys:\n"
        "- 'assistant_reply': A natural, intelligent, comprehensive conversational response directly answering the user.\n"
        "- 'clarifying_questions': 2-3 insightful scientific questions to narrow down scope.\n"
        "- 'suggested_queries': 2-4 clean, distinct academic search queries (never repeat or concatenate words).\n"
        "- 'suggested_year_min': Publication year integer or null.\n"
        "- 'suggested_year_max': Publication year integer or null.\n"
        "- 'recommended_threshold': An integer 1-5 (default 4)."
    )

    llm = UniversalLLMClient(
        provider=provider,
        model_name=model_name,
        groq_key=groq_key,
        gemini_key=gemini_key,
        openrouter_key=openrouter_key,
        deepseek_key=deepseek_key,
        nvidia_key=nvidia_key,
        custom_key=custom_key,
        custom_base_url=custom_base_url
    )

    try:
        raw_text = await llm.chat_completion(
            system_prompt=system_prompt,
            user_prompt=f"Conversation Transcript:\n{transcript}",
            max_tokens=1800
        )
        cleaned = clean_json_text(raw_text)
        data = json.loads(cleaned)
        return AssistantChatResponse.model_validate(data)
    except Exception as e:
        err_str = str(e)
        print(f"[Assistant Service Universal LLM Error]: {err_str}, using fallback.")
        return get_assistant_fallback(last_user_text or "literature review", error_detail=err_str if llm.has_any_configured_key() else None)

def compress_paper_context(papers: List[dict], max_papers: int = 15) -> str:
    """Compress paper metadata and syntheses into high-signal factual context."""
    slices = []
    for i, p in enumerate(papers[:max_papers], 1):
        pid = p.get("id") or f"P{i}"
        title = p.get("title", "Untitled")
        year = p.get("year", "n.d.")
        authors = p.get("authors", [])
        author_lead = authors[0] if authors else "Unknown"
        venue = p.get("venue", "")

        core = p.get("core_problem", "")
        method = p.get("methodology", "")
        findings = p.get("key_findings", "")
        gaps = p.get("research_gaps", "")
        abstract = p.get("abstract", "")[:500] if not findings else ""

        line = f"[{i}] id:{pid} | '{title}' ({author_lead} et al., {year}, {venue})\n"
        if findings:
            line += f"  - Problem: {core}\n  - Method: {method}\n  - Findings: {findings}\n  - Gaps: {gaps}\n"
        elif abstract:
            line += f"  - Abstract: {abstract}...\n"
        slices.append(line)
    return "\n".join(slices)

async def answer_paper_qa(
    query: str,
    papers: List[dict],
    chat_history: List[AssistantChatMessage],
    provider: Optional[str] = "groq",
    model_name: Optional[str] = None,
    groq_key: Optional[str] = None,
    gemini_key: Optional[str] = None,
    openrouter_key: Optional[str] = None,
    deepseek_key: Optional[str] = None,
    nvidia_key: Optional[str] = None,
    custom_key: Optional[str] = None,
    custom_base_url: Optional[str] = None
) -> dict:
    """Answer questions grounded in synthesized literature with LaTeX math support and deep explanations."""
    compressed_papers = compress_paper_context(papers, max_papers=15)
    
    # Check for specific paper detail request (e.g. "explain paper 2", "paper #1")
    extra_paper_detail = ""
    import re
    match_paper_num = re.search(r"paper\s*#?\s*(\d+)", query, re.IGNORECASE)
    if match_paper_num:
        idx = int(match_paper_num.group(1)) - 1
        if 0 <= idx < len(papers):
            target = papers[idx]
            extra_paper_detail = (
                f"\n\nFOCUS PAPER DETAILS [Paper {idx + 1}]:\n"
                f"Title: {target.get('title')}\n"
                f"Authors: {', '.join(target.get('authors', []))}\n"
                f"Core Problem: {target.get('core_problem', '')}\n"
                f"Methodology: {target.get('methodology', '')}\n"
                f"Key Findings: {target.get('key_findings', '')}\n"
                f"Research Gaps: {target.get('research_gaps', '')}\n"
                f"Abstract: {target.get('abstract', '')}\n"
            )

    history_turns = []
    for m in chat_history[-8:]:
        history_turns.append(f"{'User' if m.role == 'user' else 'Assistant'}: {m.content}")
    history_context = "\n".join(history_turns) if history_turns else "None"

    system_prompt = (
        "You are ResearchLoom (Samhita), an elite, highly knowledgeable scientific literature research partner.\n"
        "You chat naturally, thoroughly, and conversationally like ChatGPT or Gemini, fully grounded in the provided papers.\n\n"
        "CRITICAL DIRECTIVES:\n"
        "1. Thorough Answers: Provide rich, deep, multi-paragraph academic explanations. Do not give shallow one-liners.\n"
        "2. Explain Like a Pro: When asked to explain a paper, break down the intuition, the problem formulation, how the method works step-by-step, the empirical results, and the key takeaway.\n"
        "3. Citations: Cite supporting papers using standard bracketed notation like [1], [2], or [1, 3] matching the collection numbers.\n"
        "4. LaTeX Math: Whenever equations, loss functions, variables, or statistics appear, render them in KaTeX math delimiters:\n"
        "   - Inline math: $...$ (e.g. $E = mc^2$ or $\\mathcal{L}_{\\text{triage}}$)\n"
        "   - Display math: $$...$$ on its own line\n"
        "5. Output Format: Return a JSON object with keys: 'answer', 'cited_paper_ids', 'suggested_followups', 'suggested_searches'.\n"
        "   If you cannot produce JSON, return your full response in clean Markdown with LaTeX math."
    )

    user_prompt = (
        f"Curated Literature Collection ({len(papers)} papers available):\n"
        f"{compressed_papers}"
        f"{extra_paper_detail}\n\n"
        f"Recent Conversation History:\n"
        f"{history_context}\n\n"
        f"User Inquiry:\n"
        f"{query}\n"
    )

    llm = UniversalLLMClient(
        provider=provider,
        model_name=model_name,
        groq_key=groq_key,
        gemini_key=gemini_key,
        openrouter_key=openrouter_key,
        deepseek_key=deepseek_key,
        nvidia_key=nvidia_key,
        custom_key=custom_key,
        custom_base_url=custom_base_url
    )

    try:
        raw_text = await llm.chat_completion(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=2500
        )
        cleaned = clean_json_text(raw_text)
        try:
            data = json.loads(cleaned)
            raw_cited = data.get("cited_paper_ids", [])
            cited_str = [str(x) for x in raw_cited if x is not None] if isinstance(raw_cited, list) else []
            raw_followups = data.get("suggested_followups", [])
            followups = [str(x) for x in raw_followups if x] if isinstance(raw_followups, list) else []
            return {
                "answer": data.get("answer", raw_text),
                "cited_paper_ids": cited_str,
                "suggested_followups": followups or [
                    "How does this compare with the baseline models?",
                    "What were the experimental limitations?"
                ],
                "suggested_searches": [str(x) for x in data.get("suggested_searches", []) if x] if isinstance(data.get("suggested_searches"), list) else []
            }
        except Exception:
            # Model responded with direct markdown text instead of JSON
            return {
                "answer": raw_text,
                "cited_paper_ids": [],
                "suggested_followups": [
                    "What empirical benchmarks were tested?",
                    "Can you summarize the methodology in depth?"
                ],
                "suggested_searches": []
            }
    except Exception as e:
        err_msg = str(e)
        print(f"[Paper QA LLM Error]: {err_msg}")
        active_prov = (provider or "AI model").capitalize()

        if not llm.has_any_configured_key() or "No API key configured" in err_msg:
            answer_text = (
                f"**No active API key configured for {active_prov}.**\n\n"
                "Please open **BYOK Settings** from the top bar to add your free Google Gemini or Groq API key. "
                "All your gathered papers, citations, and downloaded PDFs remain safely cached in the Document Vault."
            )
        else:
            answer_text = (
                f"**{active_prov} query could not be completed.**\n\n"
                f"**Diagnostic Details:** {err_msg}\n\n"
                "Please verify your API key in **BYOK Settings**, check your daily quota limits, "
                "or switch to another provider using the model switcher pill in the top header."
            )

        return {
            "answer": answer_text,
            "cited_paper_ids": [],
            "suggested_followups": [
                "How do I set up a free Gemini or Groq key?",
                "Can I view the synthesized paper matrix?"
            ],
            "suggested_searches": []
        }
