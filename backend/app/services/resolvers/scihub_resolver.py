"""
Sci-Hub Multi-Mirror Concurrent Racing Resolver.
Simultaneously races across all active Sci-Hub mirrors using asyncio.as_completed.
Returns the first valid PDF response and immediately cancels remaining pending requests.
"""
import asyncio
import re
from typing import Optional
from urllib.parse import urljoin
import httpx
from .utils import is_valid_pdf, BROWSER_HEADERS

SCI_HUB_MIRRORS = [
    "https://sci-hub.se",
    "https://sci-hub.st",
    "https://sci-hub.ru",
    "https://sci-hub.ren",
    "https://sci-hub.wf",
    "https://sci-hub.do",
    "https://sci-hub.ee",
    "https://sci-hub.mksa.top",
    "https://sci-hub.shop",
]

PDF_SRC_PATTERNS = [
    r"""location\.href\s*=\s*['"]([^'"]+\.pdf[^'"]*)['"]""",
    r"""src\s*=\s*['"]([^'"]+\.pdf(?:\?[^'"]*)?)['"]""",
    r"""iframe[^>]+src\s*=\s*['"]([^'"]+)['"]""",
    r"""embed[^>]+src\s*=\s*['"]([^'"]+\.pdf[^'"]*)['"]""",
    r"""href\s*=\s*['"]([^'"]*download[^'"]*)['"]""",
    r"""download\s*=\s*['"][^'"]*['"][^>]*href\s*=\s*['"]([^'"]+)['"]""",
]


async def _probe_single_scihub_mirror(
    mirror: str,
    clean_doi: str,
    client: httpx.AsyncClient
) -> Optional[bytes]:
    """Probe a single Sci-Hub mirror for a paper PDF."""
    try:
        page_url = f"{mirror}/{clean_doi}"
        res = await client.get(page_url, timeout=14.0, follow_redirects=True, headers=BROWSER_HEADERS)
        if res.status_code not in (200, 301, 302):
            return None

        # Direct PDF binary response
        if is_valid_pdf(res.content):
            return res.content

        if not (b"<html" in res.content[:200].lower() or b"<!doc" in res.content[:200].lower()):
            return None

        html = res.text
        for pattern in PDF_SRC_PATTERNS:
            matches = re.findall(pattern, html, re.IGNORECASE)
            for match in matches:
                pdf_url = match.strip()
                if pdf_url.startswith("//"):
                    pdf_url = "https:" + pdf_url
                elif not pdf_url.startswith("http"):
                    pdf_url = urljoin(mirror, pdf_url)

                try:
                    pdf_res = await client.get(
                        pdf_url, timeout=16.0, follow_redirects=True, headers=BROWSER_HEADERS
                    )
                    if pdf_res.status_code == 200 and is_valid_pdf(pdf_res.content):
                        return pdf_res.content
                except Exception:
                    continue
    except Exception:
        pass
    return None


async def resolve_scihub(
    doi: Optional[str],
    client: httpx.AsyncClient
) -> Optional[bytes]:
    """Concurrently race across all Sci-Hub mirrors in parallel."""
    if not doi:
        return None

    clean_doi = doi.strip()
    clean_doi = re.sub(r"^https?://(dx\.)?doi\.org/", "", clean_doi)

    tasks = [
        asyncio.create_task(_probe_single_scihub_mirror(mirror, clean_doi, client))
        for mirror in SCI_HUB_MIRRORS
    ]

    try:
        for fut in asyncio.as_completed(tasks, timeout=24.0):
            try:
                res = await fut
                if res and is_valid_pdf(res):
                    # Cancel all other mirrors
                    for t in tasks:
                        if not t.done():
                            t.cancel()
                    return res
            except Exception:
                continue
    except asyncio.TimeoutError:
        pass
    finally:
        for t in tasks:
            if not t.done():
                t.cancel()

    return None
