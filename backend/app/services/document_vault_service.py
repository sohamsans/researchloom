import os
import re
import hashlib
import asyncio
from typing import Optional, Tuple, List
from urllib.parse import urljoin, quote
import httpx
from sqlalchemy import select
from app.db.database import AsyncSessionLocal
from app.db.models import PaperDocumentVault
from app.models.schemas import VaultPaperItem, VaultStatusResponse
from app.config import get_settings

import sys

def _get_vault_dir() -> str:
    if getattr(sys, "frozen", False):
        base = os.path.dirname(sys.executable)
    else:
        base = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    path = os.getenv("LITBUDDY_VAULT_DIR", os.path.join(base, "LitBuddy Papers"))
    os.makedirs(path, exist_ok=True)
    return path

VAULT_DIR = _get_vault_dir()

SCI_HUB_MIRRORS = [
    "https://sci-hub.se",
    "https://sci-hub.st",
    "https://sci-hub.ru",
    "https://sci-hub.ren",
    "https://sci-hub.mksa.top"
]

BROWSER_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/pdf,application/xhtml+xml,text/html;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9"
}

def compute_vault_id(doi: Optional[str], title: str) -> str:
    """Deterministic 64-char hex ID for PDF document vault."""
    if doi and len(doi.strip()) > 3:
        clean_doi = doi.lower().strip()
        clean_doi = re.sub(r"^https?://(dx\.)?doi\.org/", "", clean_doi)
        return hashlib.sha256(clean_doi.encode("utf-8")).hexdigest()
    clean_title = re.sub(r"[^a-zA-Z0-9]", "", title.lower()).strip()
    return hashlib.sha256(clean_title.encode("utf-8")).hexdigest()

def sanitize_filename(name: str) -> str:
    """Safe ASCII filename for filesystem storage."""
    clean = re.sub(r'[\\/*?:"<>|]', "", name)
    clean = re.sub(r'\s+', "_", clean)
    return clean[:80]

async def get_vault_record(vault_id: str) -> Optional[PaperDocumentVault]:
    """Retrieve database record for vaulted document."""
    try:
        async with AsyncSessionLocal() as session:
            stmt = select(PaperDocumentVault).where(PaperDocumentVault.id == vault_id)
            result = await session.execute(stmt)
            return result.scalar_one_or_none()
    except Exception as e:
        print(f"[Vault DB Error] Reading {vault_id}: {e}")
        return None

async def check_vault_status(doi: Optional[str], title: str) -> VaultStatusResponse:
    """Check if paper PDF is already stored in local vault."""
    vault_id = compute_vault_id(doi, title)
    record = await get_vault_record(vault_id)
    if record and os.path.exists(record.file_path):
        return VaultStatusResponse(
            is_vaulted=True,
            vault_id=vault_id,
            file_size_bytes=record.file_size_bytes,
            source_resolved=record.source_resolved,
            has_figures=bool(record.figures_json),
            has_fulltext=bool(record.parsed_fulltext)
        )
    return VaultStatusResponse(is_vaulted=False)

async def download_from_url(client: httpx.AsyncClient, url: str, depth: int = 0) -> Optional[bytes]:
    """
    Stream download and validate %PDF- magic bytes.
    If the response is an academic HTML landing page, parse standard meta tags
    (citation_pdf_url, bepress_citation_pdf_url) or direct PDF links to resolve the raw PDF.
    """
    if depth > 2 or not url:
        return None
    try:
        res = await client.get(url, timeout=20.0, follow_redirects=True, headers=BROWSER_HEADERS)
        if res.status_code == 200:
            # 1. Direct PDF stream
            if res.content.startswith(b"%PDF-"):
                return res.content

            # 2. Check for HTML landing page with academic metadata
            content_type = res.headers.get("content-type", "").lower()
            if "html" in content_type or res.content.startswith(b"<!DOCTYPE") or res.content.startswith(b"<html"):
                html = res.text
                
                # Check for Highwire Press / Google Scholar / Dublin Core tags used by 95% of publishers
                meta_matches = re.findall(
                    r'<meta[^>]+name=["\'](?:citation_pdf_url|bepress_citation_pdf_url|dc\.identifier)["\'][^>]+content=["\']([^"\']+)["\']',
                    html,
                    re.IGNORECASE
                )
                if not meta_matches:
                    meta_matches = re.findall(
                        r'<meta[^>]+content=["\']([^"\']+)["\'][^>]+name=["\'](?:citation_pdf_url|bepress_citation_pdf_url)["\']',
                        html,
                        re.IGNORECASE
                    )

                if meta_matches:
                    pdf_target = meta_matches[0].strip()
                    pdf_target = urljoin(url, pdf_target)
                    pdf_result = await download_from_url(client, pdf_target, depth=depth + 1)
                    if pdf_result:
                        return pdf_result

                # Check for direct anchor download link ending in .pdf
                link_matches = re.findall(r'<a[^>]+href=["\']([^"\']+\.pdf[^"\']*)["\']', html, re.IGNORECASE)
                for link in link_matches:
                    full_link = urljoin(url, link.strip())
                    pdf_result = await download_from_url(client, full_link, depth=depth + 1)
                    if pdf_result:
                        return pdf_result
    except Exception:
        pass
    return None

async def resolve_scihub_pdf(doi: str, client: httpx.AsyncClient) -> Optional[bytes]:
    """Resilient fallback across Sci-Hub mirrors with iframe/embed and script parsing."""
    clean_doi = doi.strip()
    clean_doi = re.sub(r"^https?://(dx\.)?doi\.org/", "", clean_doi)

    for mirror in SCI_HUB_MIRRORS:
        try:
            url = f"{mirror}/{clean_doi}"
            resp = await client.get(url, headers=BROWSER_HEADERS, timeout=14.0, follow_redirects=True)
            if resp.status_code == 200:
                if resp.content.startswith(b"%PDF-"):
                    return resp.content

                html = resp.text
                match = re.search(r'<embed[^>]+src=["\']([^"\']+\.pdf[^"\']*)["\']', html, re.IGNORECASE)
                if not match:
                    match = re.search(r'<iframe[^>]+src=["\']([^"\']+\.pdf[^"\']*)["\']', html, re.IGNORECASE)
                if not match:
                    match = re.search(r'location\.href\s*=\s*["\']([^"\']+\.pdf[^"\']*)["\']', html, re.IGNORECASE)
                if not match:
                    match = re.search(r'onclick=["\']location\.href\s*=\s*\\?["\']([^"\']+\.pdf[^"\']*)\\?["\']["\']', html, re.IGNORECASE)

                if match:
                    pdf_src = match.group(1).strip()
                    pdf_src = urljoin(mirror, pdf_src)
                    pdf_bytes = await download_from_url(client, pdf_src)
                    if pdf_bytes:
                        return pdf_bytes
        except Exception:
            continue
    return None

async def resolve_crossref_direct_pdf(doi: str, client: httpx.AsyncClient) -> Optional[bytes]:
    """Resolve direct application/pdf resources registered in Crossref metadata."""
    clean_doi = doi.strip()
    clean_doi = re.sub(r"^https?://(dx\.)?doi\.org/", "", clean_doi)
    try:
        url = f"https://api.crossref.org/works/{clean_doi}"
        resp = await client.get(url, timeout=12.0, headers=BROWSER_HEADERS)
        if resp.status_code == 200:
            data = resp.json().get("message", {})
            links = data.get("link", [])
            for item in links:
                if "pdf" in item.get("content-type", "").lower() or "pdf" in item.get("intended-application", "").lower():
                    pdf_url = item.get("URL")
                    if pdf_url:
                        pdf_bytes = await download_from_url(client, pdf_url)
                        if pdf_bytes:
                            return pdf_bytes
    except Exception:
        pass
    return None

async def resolve_semantic_scholar_pdf(doi_or_title: str, client: httpx.AsyncClient) -> Optional[bytes]:
    """Query Semantic Scholar Graph API for openAccessPdf URL."""
    try:
        clean = doi_or_title.strip()
        clean = re.sub(r"^https?://(dx\.)?doi\.org/", "", clean)
        encoded = quote(clean)
        url = f"https://api.semanticscholar.org/graph/v1/paper/{encoded}?fields=openAccessPdf,title"
        resp = await client.get(url, timeout=12.0, headers=BROWSER_HEADERS)
        if resp.status_code == 200:
            data = resp.json()
            oa_obj = data.get("openAccessPdf")
            if oa_obj and oa_obj.get("url"):
                pdf_bytes = await download_from_url(client, oa_obj.get("url"))
                if pdf_bytes:
                    return pdf_bytes
    except Exception:
        pass
    return None

async def resolve_archive_org_pdf(title: str, doi: Optional[str], client: httpx.AsyncClient) -> Optional[bytes]:
    """Check Internet Archive Wayback Machine and Scholar repository for digitized paper."""
    # 1. Check Wayback for DOI URL
    if doi:
        clean_doi = re.sub(r"^https?://(dx\.)?doi\.org/", "", doi.strip())
        try:
            wayback_url = f"https://archive.org/wayback/available?url=https://doi.org/{clean_doi}"
            resp = await client.get(wayback_url, timeout=10.0, headers=BROWSER_HEADERS)
            if resp.status_code == 200:
                data = resp.json()
                closest = data.get("archived_snapshots", {}).get("closest", {})
                snapshot_url = closest.get("url")
                if snapshot_url and closest.get("available"):
                    pdf_bytes = await download_from_url(client, snapshot_url)
                    if pdf_bytes:
                        return pdf_bytes
        except Exception:
            pass

    # 2. Check Archive.org search for title
    if title and len(title) > 8:
        try:
            clean_title = re.sub(r"[^a-zA-Z0-9\s]", "", title)[:60].strip()
            search_url = f"https://archive.org/advancedsearch.php?q=title:({quote(clean_title)})+AND+mediatype:texts&fl[]=identifier&rows=1&output=json"
            resp = await client.get(search_url, timeout=10.0, headers=BROWSER_HEADERS)
            if resp.status_code == 200:
                docs = resp.json().get("response", {}).get("docs", [])
                if docs:
                    item_id = docs[0].get("identifier")
                    direct_pdf = f"https://archive.org/download/{item_id}/{item_id}.pdf"
                    pdf_bytes = await download_from_url(client, direct_pdf)
                    if pdf_bytes:
                        return pdf_bytes
        except Exception:
            pass
    return None

async def resolve_dokumen_pdf(title: str, client: httpx.AsyncClient) -> Optional[bytes]:
    """Search dokumen.pub repository for uploaded technical/academic papers and scan copies."""
    if not title or len(title) < 10:
        return None
    try:
        clean_q = re.sub(r"[^a-zA-Z0-9\s]", "", title)[:50].strip()
        search_url = f"https://dokumen.pub/search?q={quote(clean_q)}"
        resp = await client.get(search_url, timeout=12.0, headers=BROWSER_HEADERS)
        if resp.status_code == 200 and "dokumen.pub" in resp.text:
            # Find first document result link
            matches = re.findall(r'<a[^>]+href=["\'](/[^"\']+\.html)["\']', resp.text)
            for doc_link in matches[:2]:
                full_doc_url = f"https://dokumen.pub{doc_link}"
                doc_page = await client.get(full_doc_url, timeout=12.0, headers=BROWSER_HEADERS)
                if doc_page.status_code == 200:
                    # Look for download link
                    dl_match = re.search(r'<a[^>]+href=["\'](/download/[^"\']+)["\']', doc_page.text)
                    if dl_match:
                        dl_url = f"https://dokumen.pub{dl_match.group(1)}"
                        pdf_bytes = await download_from_url(client, dl_url)
                        if pdf_bytes:
                            return pdf_bytes
    except Exception:
        pass
    return None

async def _race_resolvers(
    resolvers: list,
    label: str
) -> tuple:
    """
    Race a list of async callables concurrently.
    Returns (pdf_bytes, source_label) for the FIRST that returns a valid PDF.
    All remaining tasks are cancelled and awaited to suppress CancelledError.
    """
    if not resolvers:
        return None, None

    tasks = {asyncio.ensure_future(fn()): src for fn, src in resolvers}
    all_tasks = list(tasks.keys())
    winner_bytes: Optional[bytes] = None
    winner_source: Optional[str] = None

    try:
        # Wait for all tasks with a global timeout; inspect as they complete
        done, pending = await asyncio.wait(
            all_tasks,
            return_when=asyncio.ALL_COMPLETED,
            timeout=32.0
        )

        for task in done:
            if winner_bytes:
                break  # Already have a winner, skip remaining
            try:
                result = task.result()
                if result and isinstance(result, bytes) and result.startswith(b"%PDF-") and len(result) >= 20_000:
                    winner_bytes = result
                    winner_source = tasks[task]
                    print(f"[{label}] Resolved: {winner_source}")
            except (asyncio.CancelledError, Exception):
                pass

        # Cancel anything still pending (timeout case)
        for t in pending:
            t.cancel()
        if pending:
            await asyncio.gather(*pending, return_exceptions=True)

    except Exception as e:
        print(f"[Race Resolver {label}] Unexpected error: {e}")
        # Cancel everything
        for t in all_tasks:
            t.cancel()
        await asyncio.gather(*all_tasks, return_exceptions=True)

    return winner_bytes, winner_source


async def fetch_and_vault_paper(paper: VaultPaperItem) -> Tuple[Optional[str], Optional[str]]:
    """
    Download paper through a concurrent multi-tier racing cascade.
    Resolvers are launched in parallel groups; the first valid PDF binary wins.

    Stage 1 (Legal OA Race):
      - arXiv, Europe PMC, Unpaywall, DOAJ, CORE, Habanero/Crossref, Semantic Scholar
    Stage 2 (Publisher Landing Page Scraper + Direct URL):
      - PyPaperBot-style meta tag scraper, direct pdf_url resolution
    Stage 3 (Archival Race):
      - Internet Archive Scholar, Wayback CDX, IA texts
    Stage 4 (Shadow Archive Race):
      - LibGen scimag, Sci-Hub 9-mirror rotation, Dokumen.pub

    Returns (vault_id, file_path).
    """
    from app.services.resolvers.arxiv_resolver import resolve_arxiv
    from app.services.resolvers.europepmc_resolver import resolve_europepmc
    from app.services.resolvers.doaj_resolver import resolve_doaj
    from app.services.resolvers.core_resolver import resolve_core
    from app.services.resolvers.habanero_resolver import resolve_habanero_crossref
    from app.services.resolvers.archive_scholar_resolver import resolve_archive_scholar
    from app.services.resolvers.libgen_resolver import resolve_libgen
    from app.services.resolvers.scihub_resolver import resolve_scihub as resolve_scihub_new
    from app.services.resolvers.publisher_scraper import resolve_publisher_landing
    from app.services.resolvers.gutenberg_resolver import resolve_gutenberg
    from app.services.resolvers.ipfs_resolver import resolve_ipfs_scimag
    from app.services.resolvers.zenodo_ssrn_resolver import resolve_zenodo, resolve_ssrn

    vault_id = compute_vault_id(paper.doi, paper.title)

    # 0. Instant vault cache replay (0ms)
    existing = await get_vault_record(vault_id)
    if existing and os.path.exists(existing.file_path):
        try:
            async with AsyncSessionLocal() as session:
                stmt = select(PaperDocumentVault).where(PaperDocumentVault.id == vault_id)
                res = await session.execute(stmt)
                rec = res.scalar_one_or_none()
                if rec:
                    rec.download_count += 1
                    await session.commit()
        except Exception:
            pass
        return vault_id, existing.file_path

    pdf_bytes: Optional[bytes] = None
    source_resolved: str = "unknown"

    async with httpx.AsyncClient(timeout=32.0, follow_redirects=True, headers=BROWSER_HEADERS) as client:

        # ── STAGE 1: Legal Open Access (Concurrent Race) ──────────────────────
        stage1_resolvers = []
        if paper.doi or paper.id:
            stage1_resolvers.append((
                lambda: resolve_arxiv(paper.doi, paper.title, paper.abstract if hasattr(paper, 'abstract') else None, client),
                "arxiv"
            ))
        if paper.doi or paper.title:
            stage1_resolvers.append((
                lambda: resolve_europepmc(paper.doi, paper.title, client),
                "europepmc"
            ))
        if paper.doi or paper.title:
            stage1_resolvers.append((
                lambda: resolve_doaj(paper.doi, paper.title, client),
                "doaj"
            ))
        if paper.doi or paper.title:
            stage1_resolvers.append((
                lambda: resolve_core(paper.doi, paper.title, client),
                "core"
            ))
        if paper.doi or paper.title:
            stage1_resolvers.append((
                lambda: resolve_zenodo(paper.doi, paper.title, client),
                "zenodo"
            ))
        if paper.doi:
            stage1_resolvers.append((
                lambda: resolve_ssrn(paper.doi, client),
                "ssrn"
            ))
        if paper.doi:
            stage1_resolvers.append((
                lambda: resolve_habanero_crossref(paper.doi, client),
                "crossref_textmining"
            ))
        if paper.doi:
            stage1_resolvers.append((
                lambda: resolve_semantic_scholar_pdf(paper.doi, client),
                "semantic_scholar"
            ))
        if paper.doi:
            stage1_resolvers.append((
                lambda: resolve_unpaywall_stage1(paper.doi, client),
                "unpaywall"
            ))

        pdf_bytes, source_resolved = await _race_resolvers(stage1_resolvers, "Stage1 Legal OA")

        # ── STAGE 2: Direct URL + Publisher Landing Page Scraper ──────────────
        if not pdf_bytes:
            stage2_resolvers = []
            if paper.pdf_url:
                stage2_resolvers.append((
                    lambda: download_from_url(client, paper.pdf_url),
                    "direct_oa"
                ))
            if paper.pdf_url:
                stage2_resolvers.append((
                    lambda: resolve_publisher_landing(paper.pdf_url, client),
                    "publisher_scraper"
                ))
            if paper.doi:
                doi_url = f"https://doi.org/{paper.doi}"
                stage2_resolvers.append((
                    lambda: resolve_publisher_landing(doi_url, client),
                    "doi_landing"
                ))
            if stage2_resolvers:
                pdf_bytes, source_resolved = await _race_resolvers(stage2_resolvers, "Stage2 Publisher Scraper")

        # ── STAGE 3: Archival Sources & Classic Repositories (Concurrent Race) ───
        if not pdf_bytes:
            first_author = paper.authors[0] if paper.authors else None
            stage3_resolvers = [
                (lambda: resolve_archive_scholar(paper.doi, paper.title, client), "archive_scholar"),
                (lambda: resolve_archive_org_pdf(paper.title, paper.doi, client), "archive_org"),
                (lambda: resolve_gutenberg(paper.title, first_author, client), "gutenberg_openlib"),
                (lambda: resolve_dokumen_pdf(paper.title, client), "dokumen_pub"),
            ]
            pdf_bytes, source_resolved = await _race_resolvers(stage3_resolvers, "Stage3 Archival & Classics")

        # ── STAGE 4: P2P, IPFS Gateways & Shadow Archives (Concurrent Race) ────
        if not pdf_bytes and paper.doi:
            stage4_resolvers = [
                (lambda: resolve_ipfs_scimag(None, paper.doi, client), "ipfs_p2p"),
                (lambda: resolve_scihub_new(paper.doi, client), "scihub"),
                (lambda: resolve_libgen(paper.doi, paper.title, client), "libgen"),
            ]
            pdf_bytes, source_resolved = await _race_resolvers(stage4_resolvers, "Stage4 P2P & Shadow Archives")

    if not pdf_bytes:
        print(f"[Document Vault] Failed all tiers for '{paper.title[:50]}'")
        return None, None

    # Store PDF to disk
    sha256_hash = hashlib.sha256(pdf_bytes).hexdigest()
    safe_title = sanitize_filename(paper.title)
    file_name = f"{vault_id[:16]}_{safe_title}.pdf"
    file_path = os.path.join(VAULT_DIR, file_name)

    with open(file_path, "wb") as f:
        f.write(pdf_bytes)

    # Save vault record (upsert: update if already exists, insert if new)
    try:
        async with AsyncSessionLocal() as session:
            # Check for existing record first (handles race conditions / re-downloads)
            existing_rec = await session.get(PaperDocumentVault, vault_id)
            if existing_rec:
                # Update file path and stats in case the file changed
                existing_rec.file_path = file_path
                existing_rec.file_size_bytes = len(pdf_bytes)
                existing_rec.file_sha256 = sha256_hash
                existing_rec.source_resolved = source_resolved
                existing_rec.download_count = (existing_rec.download_count or 0) + 1
            else:
                vault_entry = PaperDocumentVault(
                    id=vault_id,
                    doi=paper.doi,
                    title=paper.title,
                    file_path=file_path,
                    file_size_bytes=len(pdf_bytes),
                    file_sha256=sha256_hash,
                    source_resolved=source_resolved,
                    download_count=1
                )
                session.add(vault_entry)
            await session.commit()
    except Exception as e:
        print(f"[Vault DB Error] Saving record {vault_id}: {e}")

    print(f"[Document Vault] Stored '{paper.title[:50]}' ({len(pdf_bytes):,} bytes, source={source_resolved})")
    return vault_id, file_path


async def resolve_unpaywall_stage1(doi: str, client: httpx.AsyncClient) -> Optional[bytes]:
    """Thin async wrapper around resolve_unpaywall_pdf for use in race."""
    from app.services.pdf_service import resolve_unpaywall_pdf
    oa_url = await resolve_unpaywall_pdf(doi, client=client)
    if oa_url:
        return await download_from_url(client, oa_url)
    return None
