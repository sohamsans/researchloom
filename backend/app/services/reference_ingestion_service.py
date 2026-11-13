import re
import json
import logging
import asyncio
from typing import List, Dict, Any, Optional, Tuple
import httpx
from sqlalchemy import select
from app.db.database import AsyncSessionLocal
from app.db.models import BibliographicReference
from app.models.schemas import (
    ReferenceImportRequest,
    ReferenceImportResponse,
    BibliographicReferenceItem,
    VerifyDOIResponse
)
from app.services.bulk_download_service import (
    normalize_citation_key,
    escape_latex_text,
    LATIN_SPECIAL_MAP
)

logger = logging.getLogger(__name__)

CROSSREF_SEMAPHORE = asyncio.Semaphore(5)

def parse_csl_json(content: str, collection_name: str) -> List[Dict[str, Any]]:
    """Parse CSL-JSON text into standard bibliographic records."""
    try:
        raw_data = json.loads(content)
        items = raw_data if isinstance(raw_data, list) else [raw_data]
    except Exception as e:
        logger.error(f"[CSL-JSON] Parse error: {e}")
        return []

    records = []
    for item in items:
        if not isinstance(item, dict):
            continue

        # Extract authors
        authors = []
        for a in item.get("author", []):
            if isinstance(a, dict):
                family = a.get("family", "")
                given = a.get("given", "")
                name = f"{family}, {given}".strip(", ") if family or given else a.get("literal", "")
                if name:
                    authors.append(name)
            elif isinstance(a, str):
                authors.append(a)

        # Extract year
        year = None
        issued = item.get("issued", {})
        date_parts = issued.get("date-parts", [])
        if date_parts and isinstance(date_parts[0], list) and date_parts[0]:
            try:
                year = int(date_parts[0][0])
            except (ValueError, TypeError):
                year = None

        title = item.get("title") or "Untitled"
        venue = item.get("container-title") or item.get("publisher")
        doi = item.get("DOI")
        if doi:
            doi = doi.replace("https://doi.org/", "").replace("http://dx.doi.org/", "").strip()

        cite_key = normalize_citation_key(authors, year, title)

        records.append({
            "citation_key": cite_key,
            "cite_author_year": cite_key[:30],
            "entry_type": item.get("type") or "article",
            "title": escape_latex_text(title),
            "authors_json": json.dumps(authors),
            "year": year,
            "venue": escape_latex_text(venue) if venue else None,
            "volume": str(item.get("volume")) if item.get("volume") is not None else None,
            "issue": str(item.get("issue")) if item.get("issue") is not None else None,
            "pages": str(item.get("page")) if item.get("page") is not None else None,
            "publisher": item.get("publisher"),
            "doi": doi,
            "url": item.get("URL"),
            "abstract": item.get("abstract"),
            "collection_name": collection_name,
            "source": "csl_json_import"
        })

    return records

def _extract_bibtex_fields(body: str) -> Dict[str, str]:
    """Extract BibTeX key-value fields with balance-aware nested brace support and unquoted numbers."""
    fields = {}
    i = 0
    n = len(body)

    while i < n:
        # Find next field assignment: key = ...
        eq_match = re.search(r'(\b\w+)\s*=', body[i:])
        if not eq_match:
            break

        f_name = eq_match.group(1).lower()
        val_start = i + eq_match.end()
        # Skip leading whitespace
        while val_start < n and body[val_start].isspace():
            val_start += 1

        if val_start >= n:
            break

        f_val = ""
        next_i = val_start

        if body[val_start] == '{':
            # Count balanced curly braces
            brace_depth = 1
            idx = val_start + 1
            while idx < n and brace_depth > 0:
                if body[idx] == '\\' and idx + 1 < n:
                    idx += 2
                    continue
                elif body[idx] == '{':
                    brace_depth += 1
                elif body[idx] == '}':
                    brace_depth -= 1
                idx += 1
            f_val = body[val_start + 1:idx - 1] if brace_depth == 0 else body[val_start + 1:idx]
            next_i = idx
        elif body[val_start] == '"':
            # Captures double-quoted string
            idx = val_start + 1
            while idx < n and body[idx] != '"':
                if body[idx] == '\\' and idx + 1 < n:
                    idx += 2
                else:
                    idx += 1
            f_val = body[val_start + 1:idx]
            next_i = idx + 1 if idx < n else n
        else:
            # Captures unquoted integer, year, volume, or identifier until comma or newline or closing brace
            match_bare = re.match(r'([^,\n\}]+)', body[val_start:])
            if match_bare:
                f_val = match_bare.group(1).strip()
                next_i = val_start + len(match_bare.group(1))
            else:
                next_i = val_start + 1

        fields[f_name] = f_val.strip()
        i = next_i

    return fields

def parse_bibtex_entries(content: str, collection_name: str) -> List[Dict[str, Any]]:
    """Parse raw BibTeX string into standard bibliographic records using non-backtracking scanner."""
    records = []
    if not content or not content.strip():
        return records

    # Scan sequentially for @entry_type{...} blocks to completely eliminate polynomial ReDoS
    i = 0
    n = len(content)
    while i < n:
        at_pos = content.find("@", i)
        if at_pos == -1:
            break

        # Match entry type: e.g. @article, @inproceedings
        brace_pos = content.find("{", at_pos)
        if brace_pos == -1:
            i = at_pos + 1
            continue

        header = content[at_pos + 1:brace_pos].strip()
        if not header.isalnum() and "_" not in header:
            i = at_pos + 1
            continue
        entry_type = header.lower()

        # Find balanced closing brace for this entry
        depth = 1
        curr = brace_pos + 1
        in_quote = False
        while curr < n and depth > 0:
            c = content[curr]
            if c == '"' and content[curr - 1] != '\\':
                in_quote = not in_quote
            elif not in_quote:
                if c == '{':
                    depth += 1
                elif c == '}':
                    depth -= 1
            curr += 1

        entry_body = content[brace_pos + 1:curr - 1]
        comma_pos = entry_body.find(",")
        if comma_pos != -1:
            original_key = entry_body[:comma_pos].strip()
            body = entry_body[comma_pos + 1:]
        else:
            original_key = entry_body.strip()
            body = ""

        fields = _extract_bibtex_fields(body)

        title = fields.get("title") or original_key
        raw_authors = fields.get("author") or ""
        authors = [a.strip() for a in raw_authors.split(" and ") if a.strip()] if raw_authors else []

        year = None
        if "year" in fields:
            year_match = re.search(r"\d{4}", fields["year"])
            if year_match:
                year = int(year_match.group(0))

        venue = fields.get("journal") or fields.get("booktitle")
        doi = fields.get("doi")
        if doi:
            doi = doi.replace("https://doi.org/", "").replace("http://dx.doi.org/", "").strip()

        std_key = normalize_citation_key(authors, year, title)

        records.append({
            "original_key": original_key,
            "citation_key": std_key,
            "cite_author_year": std_key[:30],
            "entry_type": entry_type,
            "title": title,
            "authors": authors,
            "authors_json": json.dumps(authors),
            "year": year,
            "venue": venue,
            "volume": fields.get("volume"),
            "issue": fields.get("number") or fields.get("issue"),
            "pages": fields.get("pages"),
            "publisher": fields.get("publisher"),
            "doi": doi,
            "url": fields.get("url"),
            "abstract": fields.get("abstract"),
            "collection_name": collection_name,
            "source": "bibtex_import",
            "raw_bibtex": content[at_pos:curr]
        })
        i = curr

    return records

async def ingest_reference_records(
    records: List[Dict[str, Any]]
) -> Tuple[int, int, List[BibliographicReferenceItem]]:
    """Insert or merge references into SQLite with collision cascade and DOI deduplication."""
    imported_items: List[BibliographicReferenceItem] = []
    duplicates_merged = 0

    async with AsyncSessionLocal() as session:
        for r_data in records:
            clean_doi = r_data.get("doi")
            base_key = r_data["citation_key"]

            # 1. DOI Matching: Merge into existing if DOI matches
            existing = None
            if clean_doi:
                stmt = select(BibliographicReference).where(BibliographicReference.doi == clean_doi)
                res = await session.execute(stmt)
                existing = res.scalar_one_or_none()

            if existing:
                duplicates_merged += 1
                # Enrich existing fields without overwriting
                for k, v in r_data.items():
                    if v and not getattr(existing, k, None):
                        setattr(existing, k, v)
                target_ref = existing
            else:
                # 2. Key Collision Disambiguation
                k_stmt = select(BibliographicReference).where(BibliographicReference.citation_key == base_key)
                k_res = await session.execute(k_stmt)
                if k_res.scalar_one_or_none():
                    # Key collision with different paper -> append suffix cascade
                    letters = "abcdefghijklmnopqrstuvwxyz"
                    collision_idx = 1
                    candidate_key = f"{base_key}{letters[0]}"
                    while True:
                        chk_stmt = select(BibliographicReference).where(BibliographicReference.citation_key == candidate_key)
                        chk_res = await session.execute(chk_stmt)
                        if not chk_res.scalar_one_or_none():
                            break
                        collision_idx += 1
                        if collision_idx <= 26:
                            candidate_key = f"{base_key}{letters[collision_idx-1]}"
                        else:
                            f = letters[(collision_idx-1) // 26 - 1]
                            s = letters[(collision_idx-1) % 26]
                            candidate_key = f"{base_key}{f}{s}"

                    r_data["citation_key"] = candidate_key

                target_ref = BibliographicReference(**r_data)
                session.add(target_ref)

            await session.commit()
            await session.refresh(target_ref)

            authors_list = []
            try:
                authors_list = json.loads(target_ref.authors_json) if target_ref.authors_json else []
            except Exception:
                authors_list = [target_ref.authors_json] if target_ref.authors_json else []

            imported_items.append(BibliographicReferenceItem(
                id=target_ref.id,
                citation_key=target_ref.citation_key,
                cite_author_year=target_ref.cite_author_year,
                entry_type=target_ref.entry_type or "article",
                title=target_ref.title,
                authors=authors_list,
                year=target_ref.year,
                venue=target_ref.venue,
                volume=target_ref.volume,
                issue=target_ref.issue,
                pages=target_ref.pages,
                publisher=target_ref.publisher,
                doi=target_ref.doi,
                doi_verified=bool(target_ref.doi_verified),
                url=target_ref.url,
                abstract=target_ref.abstract,
                bibtex_raw=target_ref.bibtex_raw,
                collection_name=target_ref.collection_name or "Default Library",
                source=target_ref.source or "import",
                is_vaulted=bool(target_ref.is_vaulted),
                created_at=target_ref.created_at.isoformat() if target_ref.created_at else None,
                updated_at=target_ref.updated_at.isoformat() if target_ref.updated_at else None
            ))

    return len(imported_items), duplicates_merged, imported_items

async def verify_doi_crossref(doi: str) -> VerifyDOIResponse:
    """Validate DOI against Crossref REST API under public polite pool rate limits."""
    clean_doi = doi.replace("https://doi.org/", "").replace("http://dx.doi.org/", "").strip()
    if not clean_doi:
        return VerifyDOIResponse(doi=doi, verified=False, error="Invalid empty DOI")

    # Guard against partial SSRF and path traversal in Crossref endpoint
    if not re.match(r"^10\.\d{4,9}/[-._;()/:A-Za-z0-9]+$", clean_doi):
        return VerifyDOIResponse(doi=doi, verified=False, error="Invalid DOI format for Crossref query")

    safe_doi = urllib.parse.quote(clean_doi, safe="/")
    url = f"https://api.crossref.org/works/{safe_doi}"
    headers = {
        "User-Agent": "ResearchLoom/4.3.1 (mailto:autolit@research.local)",
        "Accept": "application/json"
    }

    async with CROSSREF_SEMAPHORE:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json()
                    msg = data.get("message", {})

                    # Safely unpack list fields
                    raw_title = msg.get("title")
                    title = raw_title[0] if isinstance(raw_title, list) and raw_title else (raw_title or "Untitled")

                    raw_venue = msg.get("container-title")
                    venue = raw_venue[0] if isinstance(raw_venue, list) and raw_venue else (raw_venue or None)

                    # Extract year
                    year = None
                    issued = msg.get("issued", {})
                    d_parts = issued.get("date-parts", [])
                    if d_parts and isinstance(d_parts[0], list) and d_parts[0]:
                        try:
                            year = int(d_parts[0][0])
                        except Exception:
                            year = None

                    c_count = msg.get("is-referenced-by-count")

                    # Update local database if present
                    async with AsyncSessionLocal() as session:
                        stmt = select(BibliographicReference).where(BibliographicReference.doi == clean_doi)
                        res = await session.execute(stmt)
                        b_ref = res.scalar_one_or_none()
                        if b_ref:
                            b_ref.doi_verified = True
                            b_ref.crossref_meta_json = json.dumps({
                                "title": title,
                                "venue": venue,
                                "year": year,
                                "citation_count": c_count
                            })
                            await session.commit()

                    return VerifyDOIResponse(
                        doi=clean_doi,
                        verified=True,
                        title=title,
                        venue=venue,
                        year=year,
                        citation_count=c_count
                    )
                elif resp.status_code == 404:
                    return VerifyDOIResponse(doi=clean_doi, verified=False, error="DOI not found in Crossref registry")
                else:
                    return VerifyDOIResponse(doi=clean_doi, verified=False, error=f"Crossref returned HTTP {resp.status_code}")
            except Exception as e:
                sanitized_doi = clean_doi.replace("\r", "").replace("\n", "")
                logger.error(f"[Crossref Verification] Failed for {sanitized_doi}: {e}")
                return VerifyDOIResponse(doi=clean_doi, verified=False, error=f"Network error: {str(e)}")
