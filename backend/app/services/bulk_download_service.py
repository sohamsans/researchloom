import io
import os
import re
import json
import zipfile
import asyncio
import unicodedata
from typing import List, Optional
from app.models.schemas import VaultPaperItem
from app.services.document_vault_service import fetch_and_vault_paper, sanitize_filename

LATIN_SPECIAL_MAP = {
    'Ł': 'L', 'ł': 'l', 'Ø': 'O', 'ø': 'o', 'ß': 'ss', 'Æ': 'AE', 'æ': 'ae',
    'Œ': 'OE', 'œ': 'oe', 'Ð': 'D', 'ð': 'd', 'Þ': 'TH', 'þ': 'th'
}

STOP_WORDS = {
    'a', 'an', 'the', 'in', 'on', 'at', 'for', 'to', 'of', 'and', 'with', 'by',
    'from', 'as', 'is', 'are', 'was', 'were', 'that', 'this', 'these', 'those'
}

def escape_latex_text(text_str: str) -> str:
    """Escapes special LaTeX characters while preserving math blocks ($...$) and protecting uppercase acronyms."""
    if not text_str:
        return ""
    math_pattern = re.compile(r'(\$(?:\\\$|[^$])+\$)')
    tokens = math_pattern.split(text_str)
    escaped_tokens = []
    for token in tokens:
        if token.startswith('$') and token.endswith('$') and len(token) > 1:
            escaped_tokens.append(token)
        else:
            # Linear non-backtracking scanner to avoid polynomial ReDoS on repeated backslashes
            t = token
            chars = []
            for ch in t:
                if ch in ('&', '%', '_', '#'):
                    chars.append('\\' + ch)
                else:
                    chars.append(ch)
            t = "".join(chars)
            t = re.sub(r'(?<!\{)\b[A-Z]{2,}(?:-[0-9A-Za-z]+)?\b(?!\})', r'{\g<0>}', t)
            escaped_tokens.append(t)
    return "".join(escaped_tokens)

def normalize_citation_key(authors: List[str], year: Optional[int], title: str, collision_count: int = 0) -> str:
    """Computes standardized [Author][Year][ShortTitle] citation key with collision suffix."""
    author_token = "Unknown"
    if authors and authors[0]:
        first_author = authors[0].strip()
        if "," in first_author:
            surname = first_author.split(",")[0].strip()
        else:
            surname = first_author.split()[-1].strip()
        surname_trans = "".join(LATIN_SPECIAL_MAP.get(c, c) for c in surname)
        surname_clean = unicodedata.normalize('NFKD', surname_trans).encode('ascii', 'ignore').decode('ascii')
        parts = re.split(r'[-\s]+', surname_clean)
        author_token = "".join(p.capitalize() for p in parts if p) or "Author"

    year_token = str(year) if year and 1800 <= year <= 2100 else "Nd"

    title_token = "Paper"
    if title:
        words = re.findall(r'[A-Za-z0-9]+', title)
        meaningful = [w for w in words if w.lower() not in STOP_WORDS]
        if meaningful:
            first_word = meaningful[0]
            first_trans = "".join(LATIN_SPECIAL_MAP.get(c, c) for c in first_word)
            first_clean = unicodedata.normalize('NFKD', first_trans).encode('ascii', 'ignore').decode('ascii')
            title_token = first_clean.capitalize() or "Paper"

    base_key = f"{author_token}{year_token}{title_token}"

    if collision_count <= 0:
        return base_key
    letters = "abcdefghijklmnopqrstuvwxyz"
    idx = collision_count - 1
    if idx < 26:
        suffix = letters[idx]
    else:
        first = letters[(idx // 26) - 1]
        second = letters[idx % 26]
        suffix = f"{first}{second}"

    return f"{base_key}{suffix}"

def generate_bibtex_entry(p: VaultPaperItem, idx: int = 0) -> str:
    """Format paper as standard BibTeX article entry with standardized key and sanitized fields."""
    key = normalize_citation_key(p.authors, p.year, p.title)
    authors_str = " and ".join(p.authors) if p.authors else "Unknown"
    sanitized_title = escape_latex_text(p.title)
    sanitized_venue = escape_latex_text(p.venue) if p.venue else None
    year = p.year or 2024
    doi_part = f",\n  doi = {{{p.doi}}}" if p.doi else ""
    journal = f",\n  journal = {{{sanitized_venue}}}" if sanitized_venue else ""

    return f"""@article{{{key},
  title = {{{sanitized_title}}},
  author = {{{authors_str}}},
  year = {{{year}}}{journal}{doi_part}
}}"""

async def create_bulk_papers_zip(papers: List[VaultPaperItem]) -> io.BytesIO:
    """Download and bundle selected papers into an in-memory ZIP archive with manifest & .bib citations.
    Uses aggressive micro-chunking (batches of 6-8 papers) with mirror cycling and 16-worker desktop concurrency."""
    zip_buffer = io.BytesIO()

    # Desktop workstation scale: 16 concurrent resolvers
    semaphore = asyncio.Semaphore(16)

    async def fetch_with_retry_and_cycle(p: VaultPaperItem):
        async with semaphore:
            # Attempt 1: Standard race across all tiers
            try:
                vault_id, file_path = await asyncio.wait_for(fetch_and_vault_paper(p), timeout=25.0)
                if file_path and os.path.exists(file_path):
                    return vault_id, file_path
            except Exception as e:
                print(f"[Bulk Download] Attempt 1 for '{p.title[:35]}': {e}")

            # Attempt 2: Immediate cycle retry with backoff in case of transient mirror congestion
            try:
                await asyncio.sleep(0.5)
                vault_id, file_path = await asyncio.wait_for(fetch_and_vault_paper(p), timeout=25.0)
                if file_path and os.path.exists(file_path):
                    return vault_id, file_path
            except Exception as e:
                print(f"[Bulk Download] Cycle attempt 2 for '{p.title[:35]}': {e}")

            return None, None

    # Chunk papers into micro-batches of 8 to prevent overwhelming any single connection/mirror
    chunk_size = 8
    results = [None] * len(papers)
    for i in range(0, len(papers), chunk_size):
        chunk_papers = papers[i:i + chunk_size]
        chunk_tasks = [asyncio.create_task(fetch_with_retry_and_cycle(p)) for p in chunk_papers]
        try:
            chunk_results = await asyncio.gather(*chunk_tasks, return_exceptions=True)
            for j, res in enumerate(chunk_results):
                idx = i + j
                if isinstance(res, tuple):
                    results[idx] = res
                else:
                    results[idx] = (None, None)
        except Exception as e:
            print(f"[Bulk Download] Chunk {i // chunk_size} error: {e}")
            for j in range(len(chunk_papers)):
                results[i + j] = (None, None)

    manifest_entries = []
    bibtex_entries = []

    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        for idx, (paper, res) in enumerate(zip(papers, results)):
            vault_id = None
            file_path = None
            if isinstance(res, tuple):
                vault_id, file_path = res

            safe_title = sanitize_filename(paper.title)
            year_str = str(paper.year) if paper.year else "nd"
            author_lead = paper.authors[0].split()[-1] if paper.authors else "Author"

            entry_info = {
                "index": idx + 1,
                "title": paper.title,
                "authors": paper.authors,
                "year": paper.year,
                "venue": paper.venue,
                "doi": paper.doi,
                "downloaded": False
            }

            if file_path and os.path.exists(file_path):
                archive_name = f"papers/[{idx+1}]_{author_lead}_{year_str}_{safe_title[:50]}.pdf"
                zf.write(file_path, arcname=archive_name)
                entry_info["downloaded"] = True
                entry_info["archive_path"] = archive_name

            manifest_entries.append(entry_info)
            bibtex_entries.append(generate_bibtex_entry(paper, idx))

        # Add references.bib
        bibtex_content = "\n\n".join(bibtex_entries)
        zf.writestr("references.bib", bibtex_content)

        # Add manifest.json
        manifest_content = json.dumps({
            "tool": "ResearchLoom (Samhita) Document Vault",
            "total_papers": len(papers),
            "successfully_bundled": sum(1 for e in manifest_entries if e["downloaded"]),
            "papers": manifest_entries
        }, indent=2)
        zf.writestr("manifest.json", manifest_content)

        # Add README.txt
        readme_content = (
            "ResearchLoom (Samhita) Literature Review - Paper Bundle\n"
            "=======================================================\n\n"
            f"Total Requested: {len(papers)}\n"
            f"Successfully Vaulted: {sum(1 for e in manifest_entries if e['downloaded'])}\n\n"
            "Contents:\n"
            "- papers/         : Full-text PDF documents\n"
            "- references.bib  : Consolidated BibTeX citations for LaTeX / Overleaf\n"
            "- manifest.json   : Metadata index linking filenames to DOIs and venues\n"
        )
        zf.writestr("README.txt", readme_content)

    zip_buffer.seek(0)
    return zip_buffer
