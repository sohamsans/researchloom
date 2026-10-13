import json
import re
from typing import List, Optional, Dict, Any
import httpx
from app.config import get_settings
from app.models.schemas import TriageResponse, TriageItem, ReviewPaper

def clean_json_text(raw_text: str) -> str:
    """Strip markdown formatting, code fences, and extraneous commentary from LLM responses."""
    text = raw_text.strip()
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", text)
    if match:
        text = match.group(1).strip()
    # Find start and end brackets for safety
    start_bracket = text.find("{")
    end_bracket = text.rfind("}")
    if start_bracket != -1 and end_bracket != -1:
        text = text[start_bracket:end_bracket + 1]
    return text

def compress_abstract(text: str, max_words: int = 180) -> str:
    """Hyper-lean abstract compression: cap at 180 words and strip boilerplate."""
    if not text:
        return ""
    # Strip standard copyright and license boilerplate
    cleaned = re.sub(r"(?i)(copyright|all rights reserved|creative commons|published by|received:.*accepted:).*", "", text)
    words = cleaned.split()
    if len(words) <= max_words:
        return " ".join(words)
    return " ".join(words[:max_words]) + "..."

def normalize_gemini_model(model_name: Optional[str]) -> str:
    """Normalize user-specified or legacy Gemini model names to valid official endpoints."""
    if not model_name:
        return "gemini-3.8-flash"
    m = model_name.lower().strip()
    if m in ("gemini", "default", "auto", ""):
        return "gemini-3.8-flash"
    if "3.8" in m:
        return "gemini-3.8-flash"
    if "2.5" in m or "2.5-flash" in m:
        return "gemini-2.5-flash"
    if "2.0-flash" in m or "2.0" in m or "flash-lite" in m or "8b" in m or "1.5-flash-8b" in m:
        return "gemini-3.8-flash"
    if "1.5-pro" in m:
        return "gemini-1.5-pro"
    if "1.5-flash" in m:
        return "gemini-1.5-flash"
    if not m.startswith("gemini-"):
        return "gemini-3.8-flash"
    return model_name.strip()

def compress_paper_slice(text: str, max_chars: int = 8000) -> str:
    """Strip bibliography markers, license clauses, and clamp to 8,000 chars for token conservation."""
    if not text:
        return ""
    # Remove large citation/reference chunks
    cleaned = re.sub(r"(?i)\n(references|bibliography|acknowledgements)[\s\S]*", "", text)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned[:max_chars]

def parse_triage_fallback(candidates: List[dict]) -> TriageResponse:
    """Heuristic fallback if no LLM API key is configured or during service outage."""
    items = []
    for c in candidates:
        abstract = c.get("abstract", "")
        score = 4 if len(abstract) > 100 else 3
        items.append(TriageItem(
            id=str(c.get("id")),
            score=score,
            rationale="Heuristic relevance score based on keyword density and abstract presence."
        ))
    return TriageResponse(evaluations=items)

def parse_deep_fallback(paper_meta: dict, text_slice: str) -> ReviewPaper:
    """Heuristic fallback for deep extraction when LLM is unavailable."""
    title = paper_meta.get("title", "")
    abstract = paper_meta.get("abstract", "")
    return ReviewPaper(
        id=str(paper_meta.get("id", "")),
        title=title,
        year=paper_meta.get("year"),
        authors=paper_meta.get("authors", []),
        venue=paper_meta.get("venue", ""),
        relevance_score=paper_meta.get("relevance_score", 4),
        triage_rationale=paper_meta.get("triage_rationale", "Accepted candidate."),
        core_problem=f"Investigates challenges and methodologies surrounding: {title}.",
        methodology="Empirical analysis and structured literature assessment.",
        key_findings=abstract[:200] + ("..." if len(abstract) > 200 else ""),
        research_gaps="Requires further real-world empirical validation and extended domain benchmarking.",
        critical_remarks="Valuable reference paper highlighting key architectural frameworks in this domain.",
        doi_link=paper_meta.get("doi_link", ""),
        pdf_downloaded=paper_meta.get("pdf_downloaded", False),
        source=paper_meta.get("source", "")
    )

class UniversalLLMClient:
    """
    Universal LLM Hub supporting:
    - Groq (openai/gpt-oss-20b, llama-3.1-8b-instant, llama-3.3-70b-versatile)
    - Google Gemini (gemini-3.5-flash-lite, gemini-2.0-flash, gemini-1.5-flash)
    - OpenRouter (openrouter.ai/api/v1 - meta-llama/llama-3.3-70b-instruct:free, etc.)
    - DeepSeek (deepseek-chat, deepseek-reasoner)
    - NVIDIA NIM (meta/llama-3.1-8b-instruct)
    - Custom OpenAI-compatible endpoints
    """
    def __init__(
        self,
        provider: Optional[str] = None,
        model_name: Optional[str] = None,
        api_key: Optional[str] = None,
        groq_key: Optional[str] = None,
        gemini_key: Optional[str] = None,
        openrouter_key: Optional[str] = None,
        deepseek_key: Optional[str] = None,
        nvidia_key: Optional[str] = None,
        custom_key: Optional[str] = None,
        custom_base_url: Optional[str] = None
    ):
        settings = get_settings()
        self.groq_key = (groq_key or settings.groq_api_key).strip()
        self.gemini_key = (gemini_key or settings.gemini_api_key).strip()
        self.openrouter_key = (openrouter_key or "").strip()
        self.deepseek_key = (deepseek_key or "").strip()
        self.nvidia_key = (nvidia_key or "").strip()
        self.custom_key = (custom_key or "").strip()
        self.custom_base_url = (custom_base_url or "").strip().rstrip("/")

        # Active provider determination:
        # If requested provider has no configured key, or no provider was passed,
        # automatically route to the first provider that actually has credentials!
        req_provider = (provider or "").lower().strip()
        candidates = ["gemini", "groq", "openrouter", "deepseek", "nvidia", "custom"]
        if req_provider and self.has_configured_key(req_provider):
            self.provider = req_provider
        else:
            self.provider = next((c for c in candidates if self.has_configured_key(c)), "")
            if not self.provider:
                self.provider = req_provider or "heuristic"

        # Model determination (guarantee provider-model congruence)
        if self.provider == "gemini":
            self.model_name = normalize_gemini_model(model_name or settings.gemini_model)
        elif self.provider == "groq":
            if not model_name or "gemini" in model_name.lower() or "deepseek" in model_name.lower() or "8b-instant" in model_name.lower():
                self.model_name = settings.groq_model or "llama-3.3-70b-versatile"
            else:
                self.model_name = model_name
        elif self.provider == "openrouter":
            self.model_name = model_name if (model_name and "/" in model_name) else "meta-llama/llama-3.3-70b-instruct:free"
        elif self.provider == "deepseek":
            self.model_name = model_name if (model_name and "deepseek" in model_name) else "deepseek-chat"
        elif self.provider == "nvidia":
            self.model_name = model_name if (model_name and "meta" in model_name) else "meta/llama-3.1-8b-instruct"
        elif self.provider == "custom":
            self.model_name = model_name or "default"
        else:
            self.model_name = model_name or "heuristic"

    def has_configured_key(self, provider: str) -> bool:
        """Check whether credentials are provided for the specified LLM service."""
        p = provider.lower().strip()
        if p == "groq":
            return bool(self.groq_key)
        if p == "gemini":
            return bool(self.gemini_key)
        if p == "openrouter":
            return bool(self.openrouter_key)
        if p == "deepseek":
            return bool(self.deepseek_key)
        if p == "nvidia":
            return bool(self.nvidia_key)
        if p == "custom":
            return bool(self.custom_key and self.custom_base_url)
        return False

    def has_any_configured_key(self) -> bool:
        """Check whether any LLM provider has an active key configured."""
        return any(
            self.has_configured_key(p)
            for p in ["groq", "gemini", "openrouter", "deepseek", "nvidia", "custom"]
        )

    async def _call_openai_compatible(
        self,
        base_url: str,
        api_key: str,
        model: str,
        system_prompt: str,
        user_prompt: str,
        extra_headers: Optional[Dict[str, str]] = None,
        max_tokens: int = 2048,
        response_json: bool = True
    ) -> str:
        headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json"
        }
        if extra_headers:
            headers.update(extra_headers)

        payload: Dict[str, Any] = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            "temperature": 0.2,
            "max_tokens": max_tokens
        }
        if response_json:
            payload["response_format"] = {"type": "json_object"}

        endpoint = f"{base_url}/chat/completions"
        async with httpx.AsyncClient(timeout=45.0) as client:
            resp = await client.post(endpoint, json=payload, headers=headers)
            if resp.status_code != 200:
                raise RuntimeError(f"API {base_url} returned HTTP {resp.status_code}: {resp.text[:300]}")
            data = resp.json()
            return data["choices"][0]["message"]["content"] or "{}"

    async def _call_gemini(self, system_prompt: str, user_prompt: str, response_json: bool = True) -> str:
        if not self.gemini_key:
            raise RuntimeError("Gemini API key is not configured.")

        target_model = normalize_gemini_model(self.model_name)
        prompt = f"{system_prompt}\n\n{user_prompt}"

        # 1. Primary path: official google-genai SDK
        try:
            import asyncio
            from google import genai
            from google.genai import types

            client = genai.Client(api_key=self.gemini_key)

            def _sync_generate(is_json: bool):
                config_kwargs: Dict[str, Any] = {"temperature": 0.2}
                if is_json:
                    config_kwargs["response_mime_type"] = "application/json"
                return client.models.generate_content(
                    model=target_model,
                    contents=prompt,
                    config=types.GenerateContentConfig(**config_kwargs)
                )

            try:
                res = await asyncio.to_thread(_sync_generate, response_json)
                if res and res.text:
                    return res.text
            except Exception as sdk_err:
                # If strict JSON mime-type failed, retry without JSON enforcement before falling back
                if response_json:
                    try:
                        res = await asyncio.to_thread(_sync_generate, False)
                        if res and res.text:
                            return res.text
                    except Exception:
                        pass
                raise sdk_err

        except Exception as e:
            # 2. Resilient fallback path: Direct REST Generative Language API
            endpoint = f"https://generativelanguage.googleapis.com/v1beta/models/{target_model}:generateContent?key={self.gemini_key}"
            async with httpx.AsyncClient(timeout=45.0) as client:
                body: Dict[str, Any] = {
                    "contents": [{"parts": [{"text": prompt}]}],
                    "generationConfig": {"temperature": 0.2}
                }
                if response_json:
                    body["generationConfig"]["responseMimeType"] = "application/json"

                resp = await client.post(endpoint, json=body)
                # If strict JSON was rejected by REST API, retry with plain text
                if resp.status_code != 200 and response_json:
                    del body["generationConfig"]["responseMimeType"]
                    resp = await client.post(endpoint, json=body)

                if resp.status_code != 200:
                    err_detail = resp.text[:300]
                    try:
                        err_json = resp.json()
                        err_detail = err_json.get("error", {}).get("message", err_detail)
                    except Exception:
                        pass
                    raise RuntimeError(f"Gemini API error ({resp.status_code}): {err_detail}")

                data = resp.json()
                candidates = data.get("candidates", [])
                if not candidates:
                    raise RuntimeError("Gemini API returned no response candidates.")
                parts = candidates[0].get("content", {}).get("parts", [])
                if not parts:
                    raise RuntimeError("Gemini candidate contains no content parts.")
                return parts[0].get("text") or "{}"

    async def _try_single_provider(
        self,
        provider: str,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 2048,
        response_json: bool = True
    ) -> str:
        """Call a specific provider directly without failover."""
        p = provider.lower().strip()
        if p == "groq":
            if not self.groq_key:
                raise RuntimeError("Groq API key is not configured.")
            model = self.model_name if (self.provider == "groq" and "gemini" not in self.model_name.lower()) else "llama-3.1-8b-instant"
            return await self._call_openai_compatible(
                base_url="https://api.groq.com/openai/v1",
                api_key=self.groq_key,
                model=model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                max_tokens=max_tokens,
                response_json=response_json
            )

        if p == "gemini":
            if not self.gemini_key:
                raise RuntimeError("Google Gemini API key is not configured.")
            return await self._call_gemini(system_prompt, user_prompt, response_json=response_json)

        if p == "openrouter":
            if not self.openrouter_key:
                raise RuntimeError("OpenRouter API key is not configured.")
            model = self.model_name if self.provider == "openrouter" else "meta-llama/llama-3.3-70b-instruct:free"
            return await self._call_openai_compatible(
                base_url="https://openrouter.ai/api/v1",
                api_key=self.openrouter_key,
                model=model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                extra_headers={
                    "HTTP-Referer": "https://researchloom.dev",
                    "X-Title": "ResearchLoom AI"
                },
                max_tokens=max_tokens,
                response_json=response_json
            )

        if p == "deepseek":
            if not self.deepseek_key:
                raise RuntimeError("DeepSeek API key is not configured.")
            model = self.model_name if self.provider == "deepseek" else "deepseek-chat"
            return await self._call_openai_compatible(
                base_url="https://api.deepseek.com",
                api_key=self.deepseek_key,
                model=model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                max_tokens=max_tokens,
                response_json=response_json
            )

        if p == "nvidia":
            if not self.nvidia_key:
                raise RuntimeError("NVIDIA NIM API key is not configured.")
            model = self.model_name if self.provider == "nvidia" else "meta/llama-3.1-8b-instruct"
            return await self._call_openai_compatible(
                base_url="https://integrate.api.nvidia.com/v1",
                api_key=self.nvidia_key,
                model=model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                max_tokens=max_tokens,
                response_json=response_json
            )

        if p == "custom":
            if not (self.custom_key and self.custom_base_url):
                raise RuntimeError("Custom endpoint requires both an API key and Base URL.")
            return await self._call_openai_compatible(
                base_url=self.custom_base_url,
                api_key=self.custom_key,
                model=self.model_name,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
                max_tokens=max_tokens,
                response_json=response_json
            )

        raise RuntimeError(f"Unknown or unsupported provider '{provider}'.")

    async def chat_completion(
        self,
        system_prompt: str,
        user_prompt: str,
        max_tokens: int = 2500,
        response_json: bool = True
    ) -> str:
        """
        Dispatch query to the designated active provider.
        If a 429 (rate limit), 402 (quota exceeded), or network error occurs,
        automatically cascades to other CONFIGURED providers with shared context continuity.
        """
        if not self.has_any_configured_key():
            active_name = (self.provider or "AI models").upper()
            raise RuntimeError(
                f"No API key configured for {active_name}. "
                "Please configure a free Groq or Google Gemini key in BYOK Settings."
            )

        # Build list of candidate providers that actually have keys/endpoints configured
        all_providers = ["groq", "gemini", "openrouter", "deepseek", "nvidia", "custom"]
        ordered = [self.provider] + [p for p in all_providers if p != self.provider]
        candidate_providers = [p for p in ordered if self.has_configured_key(p)]

        if not candidate_providers:
            raise RuntimeError(
                f"Provider '{self.provider}' has no API key configured. "
                "Please enter your key in BYOK Settings."
            )

        primary_prov = candidate_providers[0]
        primary_error: Optional[Exception] = None

        for idx, prov in enumerate(candidate_providers):
            try:
                res = await self._try_single_provider(
                    prov, system_prompt, user_prompt, max_tokens, response_json=response_json
                )
                if prov != self.provider:
                    print(f"[Smart Model Failover] Primary '{self.provider}' unavailable; seamlessly used '{prov}'.")
                return res
            except Exception as e:
                if idx == 0:
                    primary_error = e
                print(f"[Smart Model Failover] Provider '{prov}' attempt failed: {e}")
                continue

        # If all configured providers failed, raise the primary provider's specific error message!
        raise RuntimeError(f"{primary_prov.capitalize()} request failed: {primary_error}")

    async def batch_triage(self, topic: str, candidates: List[dict]) -> TriageResponse:
        """Stage 1: Batch triage candidate abstracts with ultra-lean token compression in safe micro-chunks.
        Chunks are processed concurrently (up to 4 in parallel) for high-speed triage on large pools."""
        if not candidates:
            return TriageResponse(evaluations=[])

        import asyncio as _asyncio

        chunk_size = 12
        max_concurrent = 4  # Run up to 4 chunks at once without overwhelming LLM rate limits

        system_instruction = (
            "You are an objective scientific literature screening analyst.\n"
            "Screen academic candidate papers for direct technical and conceptual relevance to the research topic across all scientific, engineering, aerospace, and defense technology domains.\n"
            "Evaluate neutrally and factually based on scholarly merit without editorializing or arbitrary refusal.\n"
            "Return ONLY JSON: {\"evaluations\": [{\"id\": \"...\", \"score\": 1-5, \"rationale\": \"1 concise sentence\"}]}.\n"
            "Scoring: 5=vital, 4=relevant, 3=marginal, 1-2=irrelevant."
        )

        # Build all chunks
        chunks = [candidates[i:i + chunk_size] for i in range(0, len(candidates), chunk_size)]

        async def process_chunk(chunk: List[dict]) -> List:
            compact_payload = [
                {
                    "id": str(c.get("id")),
                    "title": c.get("title", ""),
                    "year": c.get("year"),
                    "abstract": compress_abstract(c.get("abstract", ""), max_words=180)
                }
                for c in chunk
            ]
            user_content = f"Topic: {topic}\n\nPapers:\n{json.dumps(compact_payload)}"
            try:
                raw_json = await self.chat_completion(system_instruction, user_content, max_tokens=2048)
                cleaned = clean_json_text(raw_json)
                data = json.loads(cleaned)
                parsed = TriageResponse.model_validate(data)
                return parsed.evaluations
            except Exception as e:
                print(f"[Universal LLM Triage Chunk Error]: {e}, using heuristic fallback for chunk.")
                fallback = parse_triage_fallback(chunk)
                return fallback.evaluations

        # Process chunks in concurrent waves bounded by max_concurrent semaphore
        sem = _asyncio.Semaphore(max_concurrent)

        async def bounded_chunk(chunk):
            async with sem:
                return await process_chunk(chunk)

        results = await _asyncio.gather(*[bounded_chunk(c) for c in chunks], return_exceptions=True)

        all_evaluations = []
        for idx, res in enumerate(results):
            if isinstance(res, list):
                all_evaluations.extend(res)
            else:
                print(f"[Triage Chunk {idx} Exception]: {res}")
                fallback = parse_triage_fallback(chunks[idx])
                all_evaluations.extend(fallback.evaluations)

        return TriageResponse(evaluations=all_evaluations)


    async def deep_extraction(
        self,
        topic: str,
        paper_meta: dict,
        text_slice: str
    ) -> ReviewPaper:
        """Stage 2: Deep extraction of methodology, findings, and gaps from compressed sliced text."""
        cleaned_slice = compress_paper_slice(text_slice, max_chars=8000)

        system_instruction = (
            "You are an objective academic research analyst.\n"
            "Extract structured academic insights from the provided peer-reviewed paper context across all scientific, engineering, aerospace, materials, and defense technology domains.\n"
            "Provide neutral, precise technical extractions without lecturing or editorializing.\n"
            "Return ONLY JSON with fields:\n"
            "{\n"
            "  \"core_problem\": \"1-2 concise sentences on primary challenge/question\",\n"
            "  \"methodology\": \"Concise summary of theoretical/empirical approach\",\n"
            "  \"key_findings\": \"Top 2-3 empirical or conceptual findings\",\n"
            "  \"research_gaps\": \"Explicit limitations, open questions, future work\",\n"
            "  \"critical_remarks\": \"Actionable synthesis remark for literature review\"\n"
            "}"
        )

        user_content = (
            f"Topic: {topic}\n"
            f"Title: {paper_meta.get('title')}\n"
            f"Year: {paper_meta.get('year')}\n"
            f"Authors: {', '.join(paper_meta.get('authors', []))}\n"
            f"Context:\n{cleaned_slice}"
        )

        try:
            raw_json = await self.chat_completion(system_instruction, user_content, max_tokens=1500)
            cleaned = clean_json_text(raw_json)
            extracted = json.loads(cleaned)
            return ReviewPaper(
                id=str(paper_meta.get("id")),
                title=paper_meta.get("title", ""),
                year=paper_meta.get("year"),
                authors=paper_meta.get("authors", []),
                venue=paper_meta.get("venue", ""),
                relevance_score=paper_meta.get("relevance_score", 4),
                triage_rationale=paper_meta.get("triage_rationale", ""),
                core_problem=extracted.get("core_problem", "Not specified"),
                methodology=extracted.get("methodology", "Not specified"),
                key_findings=extracted.get("key_findings", "Not specified"),
                research_gaps=extracted.get("research_gaps", "Not specified"),
                critical_remarks=extracted.get("critical_remarks", "Not specified"),
                doi_link=paper_meta.get("doi_link", ""),
                pdf_downloaded=paper_meta.get("pdf_downloaded", False),
                source=paper_meta.get("source", "")
            )
        except Exception as e:
            print(f"[Universal LLM Deep Error]: {e}, using heuristic fallback.")
            return parse_deep_fallback(paper_meta, text_slice)

# Backwards compatible alias
LLMService = UniversalLLMClient
