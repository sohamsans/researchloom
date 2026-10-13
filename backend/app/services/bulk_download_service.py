import io
import os
import json
import zipfile
import asyncio
from typing import List
from app.models.schemas import VaultPaperItem
from app.services.document_vault_service import fetch_and_vault_paper, sanitize_filename

def generate_bibtex_entry(p: VaultPaperItem, idx: int) -> str:
    """Format paper as standard BibTeX article entry."""
    first_author = (p.authors[0].split()[-1].lower()) if p.authors else "author"
    year = p.year or 2024
    key = f"{first_author}{year}_{idx+1}"
    authors_str = " and ".join(p.authors) if p.authors else "Unknown"
    doi_part = f",\n  doi = {{{p.doi}}}" if p.doi else ""
    journal = f",\n  journal = {{{p.venue}}}" if p.venue else ""

    return f"""@article{{{key},
  title = {{{p.title}}},
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
