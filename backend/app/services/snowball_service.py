import re
import urllib.parse
import logging
from typing import Optional, List, Dict, Any, Tuple
import httpx
from sqlalchemy import select
from app.db.database import AsyncSessionLocal
from app.db.models import PaperCache, BibliographicReference
from app.models.schemas import SnowballResponse, SnowballSeedMetadata, SnowballPaperItem
from app.services.rate_shield import rate_limit_shield

logger = logging.getLogger(__name__)

OPENALEX_BASE_URL = "https://api.openalex.org"
POLITE_EMAIL = "autolit@research.local"
HEADERS = {
    "User-Agent": f"ResearchLoom/4.3.1 (mailto:{POLITE_EMAIL})",
    "Accept": "application/json"
}

def reconstruct_abstract(inverted_index: Optional[Dict[str, List[int]]]) -> str:
    """Reconstruct plain-text abstract from OpenAlex inverted index, capping at 250 words."""
    if not inverted_index or not isinstance(inverted_index, dict):
        return ""
    try:
        word_positions: List[Tuple[int, str]] = []
        for word, positions in inverted_index.items():
            if isinstance(positions, list):
                for pos in positions:
                    word_positions.append((pos, word))
        word_positions.sort(key=lambda x: x[0])
        words = [w for _, w in word_positions]
        return " ".join(words[:250])
    except Exception as e:
        logger.warning(f"Error reconstructing abstract: {e}")
        return ""

def extract_authors(work: Dict[str, Any]) -> List[str]:
    authors = []
    for authorship in work.get("authorships", []):
        author_obj = authorship.get("author", {})
        display_name = author_obj.get("display_name")
        if display_name:
            authors.append(display_name)
    return authors

@rate_limit_shield(max_retries=3, base_delay=1.5)
async def resolve_seed_work(client: httpx.AsyncClient, identifier: str, title: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """Resolve an incoming identifier (OpenAlex ID, DOI, arXiv ID, or PMID) into a canonical OpenAlex Work object."""
    clean_id = identifier.strip()

    # 1. OpenAlex Canonical ID (W...)
    if re.match(r"^W\d+$", clean_id, re.IGNORECASE):
        clean_openalex = clean_id.upper()
        url = f"{OPENALEX_BASE_URL}/works/{clean_openalex}?mailto={POLITE_EMAIL}"
        resp = await client.get(url, headers=HEADERS, timeout=12.0)
        if resp.status_code == 200:
            return resp.json()

    # 2. arXiv ID (supports 2303.08774, arxiv:2303.08774, arxiv_2303_08774)
    norm_arxiv = re.sub(r"^arxiv[_\:]", "", clean_id, flags=re.IGNORECASE).strip()
    if "_" in norm_arxiv and re.match(r"^\d{4}_\d{4,5}(?:v\d+)?$", norm_arxiv):
        norm_arxiv = norm_arxiv.replace("_", ".")
    arxiv_match = re.match(r"^(\d{4}\.\d{4,5}(?:v\d+)?)$", norm_arxiv, re.IGNORECASE)
    if arxiv_match:
        arxiv_id = arxiv_match.group(1)
        safe_arxiv_id = urllib.parse.quote(arxiv_id, safe=".")
        url = f"{OPENALEX_BASE_URL}/works/https://arxiv.org/abs/{safe_arxiv_id}?mailto={POLITE_EMAIL}"
        resp = await client.get(url, headers=HEADERS, timeout=12.0)
        if resp.status_code == 200:
            return resp.json()

    # 3. PMID (e.g. pmid:32868963 or 7-9 digits)
    pmid_match = re.match(r"^(?:pmid:)?(\d{7,9})$", clean_id, re.IGNORECASE)
    if pmid_match:
        pmid = pmid_match.group(1)
        url = f"{OPENALEX_BASE_URL}/works/pmid:{pmid}?mailto={POLITE_EMAIL}"
        resp = await client.get(url, headers=HEADERS, timeout=12.0)
        if resp.status_code == 200:
            return resp.json()

    # 4. DOI or Generic URL
    clean_doi = clean_id
    for prefix in ["https://doi.org/", "http://doi.org/", "http://dx.doi.org/", "https://dx.doi.org/", "doi:"]:
        if clean_doi.lower().startswith(prefix):
            clean_doi = clean_doi[len(prefix):]
            break

    if "/" in clean_doi and re.match(r"^10\.\d{4,9}/[-._;()/:A-Za-z0-9]+$", clean_doi):
        safe_doi = urllib.parse.quote(clean_doi, safe="/")
        url = f"{OPENALEX_BASE_URL}/works/https://doi.org/{safe_doi}?mailto={POLITE_EMAIL}"
        resp = await client.get(url, headers=HEADERS, timeout=12.0)
        if resp.status_code == 200:
            return resp.json()

    # 5. Search fallback by clean_id if it resembles text (and not synthetic IDs like synth_0)
    if not clean_id.startswith("synth_") and len(clean_id) > 3:
        clean_search = re.sub(r"[^\w\s-]", " ", clean_id).strip()
        if clean_search:
            safe_search = urllib.parse.quote(clean_search)
            url = f"{OPENALEX_BASE_URL}/works?filter=default.search:{safe_search}&per-page=1&mailto={POLITE_EMAIL}"
            resp = await client.get(url, headers=HEADERS, timeout=12.0)
            if resp.status_code == 200:
                results = resp.json().get("results", [])
                if results:
                    return results[0]

    # 6. Fallback search by title if passed
    if title and len(title.strip()) > 3:
        clean_title = re.sub(r"[^\w\s-]", " ", title).strip()
        if clean_title:
            safe_title = urllib.parse.quote(clean_title)
            url = f"{OPENALEX_BASE_URL}/works?search={safe_title}&per-page=1&mailto={POLITE_EMAIL}"
            resp = await client.get(url, headers=HEADERS, timeout=12.0)
            if resp.status_code == 200:
                results = resp.json().get("results", [])
                if results:
                    return results[0]

    return None

def parse_work_to_item(work: Dict[str, Any], relation: str) -> SnowballPaperItem:
    raw_id = work.get("id", "")
    short_id = raw_id.split("/")[-1] if "/" in raw_id else raw_id
    primary_loc = work.get("primary_location") or {}
    source_obj = primary_loc.get("source") or {}
    venue = source_obj.get("display_name")
    oa_info = work.get("open_access") or {}
    is_oa = bool(oa_info.get("is_oa", False))
    oa_url = oa_info.get("oa_url") or primary_loc.get("pdf_url")

    raw_doi = work.get("doi")
    clean_doi = raw_doi.replace("https://doi.org/", "") if raw_doi else None

    abstract = reconstruct_abstract(work.get("abstract_inverted_index"))

    return SnowballPaperItem(
        id=short_id,
        doi=clean_doi,
        title=work.get("title") or "Untitled Paper",
        year=work.get("publication_year"),
        authors=extract_authors(work),
        cited_by_count=work.get("cited_by_count", 0) or 0,
        venue=venue,
        abstract=abstract,
        is_oa=is_oa,
        oa_url=oa_url,
        relation=relation,
        source="openalex"
    )

async def perform_citation_snowballing(
    seed_identifier: str,
    direction: str, # "backward" or "forward"
    max_results: int = 25,
    title: Optional[str] = None
) -> SnowballResponse:
    """Execute forward or backward citation snowballing using OpenAlex polite pool with local database fallback."""
    warnings: List[str] = []
    
    async with httpx.AsyncClient() as client:
        try:
            seed_work = await resolve_seed_work(client, seed_identifier, title=title)
        except Exception as e:
            logger.warning(f"[Snowball] Failed to resolve seed online: {e}")
            seed_work = None
            warnings.append(f"Network error resolving seed '{seed_identifier}'. Checked local database.")

        if not seed_work:
            # Check local SQLite cache
            cached_seed = await find_local_cached_seed(seed_identifier, title=title)
            if cached_seed:
                return SnowballResponse(
                    seed=cached_seed,
                    direction=direction,
                    total_count=0,
                    papers=[],
                    warnings=["Resolved seed from local database cache. Live citation snowballing unavailable offline."]
                )
            raise ValueError(f"Could not resolve seed work with identifier '{seed_identifier}'. Please provide a valid DOI, arXiv ID, PMID, or OpenAlex ID.")

        # Build seed metadata
        raw_seed_id = seed_work.get("id", "")
        canonical_openalex_id = raw_seed_id.split("/")[-1] if "/" in raw_seed_id else raw_seed_id
        raw_doi = seed_work.get("doi")
        clean_doi = raw_doi.replace("https://doi.org/", "") if raw_doi else None
        primary_loc = seed_work.get("primary_location") or {}
        source_obj = primary_loc.get("source") or {}
        venue = source_obj.get("display_name")
        oa_info = seed_work.get("open_access") or {}

        seed_meta = SnowballSeedMetadata(
            openalex_id=canonical_openalex_id,
            doi=clean_doi,
            title=seed_work.get("title") or "Untitled Seed Paper",
            year=seed_work.get("publication_year"),
            authors=extract_authors(seed_work),
            cited_by_count=seed_work.get("cited_by_count", 0) or 0,
            referenced_works_count=len(seed_work.get("referenced_works", [])),
            venue=venue,
            is_oa=bool(oa_info.get("is_oa", False)),
            oa_url=oa_info.get("oa_url") or primary_loc.get("pdf_url")
        )

        # Execute Snowball Query
        # Backward = Predecessors cited by seed -> filter=cited_by:canonical_openalex_id
        # Forward = Successors that cite seed -> filter=cites:canonical_openalex_id
        safe_canonical_id = urllib.parse.quote(canonical_openalex_id, safe="")
        filter_param = f"cited_by:{safe_canonical_id}" if direction == "backward" else f"cites:{safe_canonical_id}"
        relation_label = "predecessor" if direction == "backward" else "successor"

        query_url = (
            f"{OPENALEX_BASE_URL}/works"
            f"?filter={filter_param}"
            f"&per-page={max_results}"
            f"&sort=cited_by_count:desc"
            f"&mailto={POLITE_EMAIL}"
        )

        try:
            resp = await client.get(query_url, headers=HEADERS, timeout=14.0)
            if resp.status_code != 200:
                raise httpx.HTTPStatusError(f"HTTP {resp.status_code}", request=resp.request, response=resp)
            data = resp.json()
            total_count = data.get("meta", {}).get("count", 0)
            results = data.get("results", [])
            papers = [parse_work_to_item(w, relation_label) for w in results]

            return SnowballResponse(
                seed=seed_meta,
                direction=direction,
                total_count=total_count,
                papers=papers,
                warnings=warnings
            )
        except Exception as e:
            logger.error(f"[Snowball] Failed querying {direction} citations: {e}")
            warnings.append(f"External API query for {direction} citations failed ({str(e)}). Returning seed metadata only.")
            return SnowballResponse(
                seed=seed_meta,
                direction=direction,
                total_count=0,
                papers=[],
                warnings=warnings
            )

async def find_local_cached_seed(identifier: str, title: Optional[str] = None) -> Optional[SnowballSeedMetadata]:
    """Look up paper in local SQLite cache by DOI or title with defensive exception protection."""
    clean_id = identifier.replace("https://doi.org/", "").strip()
    try:
        async with AsyncSessionLocal() as session:
            # Check PaperCache
            conditions = [PaperCache.doi == clean_id]
            if not clean_id.startswith("synth_"):
                conditions.append(PaperCache.title.ilike(f"%{clean_id}%"))
            if title:
                conditions.append(PaperCache.title.ilike(f"%{title.strip()}%"))

            from sqlalchemy import or_
            stmt = select(PaperCache).where(or_(*conditions))
            res = await session.execute(stmt)
            p = res.scalar_one_or_none()
            if p:
                authors = []
                try:
                    import json
                    authors = json.loads(p.authors_json) if p.authors_json else []
                except Exception:
                    authors = [p.authors_json] if p.authors_json else []
                return SnowballSeedMetadata(
                    openalex_id=p.cache_key,
                    doi=p.doi,
                    title=p.title,
                    year=p.year,
                    authors=authors,
                    cited_by_count=0,
                    referenced_works_count=0,
                    venue=p.venue,
                    is_oa=p.is_oa,
                    oa_url=p.pdf_url
                )

            # Check BibliographicReference defensively
            try:
                b_conditions = [BibliographicReference.doi == clean_id, BibliographicReference.citation_key == clean_id]
                if title:
                    b_conditions.append(BibliographicReference.title.ilike(f"%{title.strip()}%"))
                b_stmt = select(BibliographicReference).where(or_(*b_conditions))
                b_res = await session.execute(b_stmt)
                b = b_res.scalar_one_or_none()
                if b:
                    authors = []
                    try:
                        import json
                        authors = json.loads(b.authors_json) if b.authors_json else []
                    except Exception:
                        authors = [b.authors_json] if b.authors_json else []
                    return SnowballSeedMetadata(
                        openalex_id=b.citation_key,
                        doi=b.doi,
                        title=b.title,
                        year=b.year,
                        authors=authors,
                        cited_by_count=0,
                        referenced_works_count=0,
                        venue=b.venue,
                        is_oa=False,
                        oa_url=b.url
                    )
            except Exception as b_err:
                logger.warning(f"[Snowball] BibliographicReference lookup skipped or failed: {b_err}")
    except Exception as e:
        logger.warning(f"[Snowball] Local cache lookup failed: {e}")
    return None
