import re
import urllib.parse
import xml.etree.ElementTree as ET
from typing import List, Optional
import asyncio
import httpx

from app.models.schemas import RawPaperMetadata
from app.config import get_settings
from app.services.rate_shield import polite_delay, rate_limit_shield

def normalize_title(title: str) -> str:
    """Normalize paper title for deduplication."""
    return re.sub(r'[^a-zA-Z0-9]', '', title.lower()).strip()

# Patterns identifying non-research noise: journal covers, editorial boards, issue front/back matter, tables of contents, errata
NON_PAPER_TITLE_PATTERNS = re.compile(
    r"(?i)\b("
    r"cover\s*page|front\s*matter|back\s*matter|table\s*of\s*contents|contents\s*page|"
    r"editorial\s*board|masthead|inside\s*front\s*cover|inside\s*back\s*cover|"
    r"author\s*index|subject\s*index|corrigendum|erratum|retraction\s*notice|"
    r"announcement|call\s*for\s*papers|preface|in\s*memoriam|reviewer\s*acknowledg(e)?ments|"
    r"abstracts\s*of\s*the|session\s*\d+|poster\s*presentations|proceedings\s*brief|"
    r"journal\s*cover|issue\s*information|title\s*page|preliminary\s*matter"
    r")\b"
)

def is_substantive_academic_paper(paper: RawPaperMetadata) -> bool:
    """
    Robust Academic Anti-Noise Filter.
    Excludes journal cover pages, editorial boards, tables of contents, errata, and stub articles.
    """
    title = (paper.title or "").strip()
    if not title or len(title) < 8:
        return False

    # 1. Match title against non-paper blacklist regex
    if NON_PAPER_TITLE_PATTERNS.search(title):
        return False

    # 2. Check for stub titles like "Contents", "Cover", "Index", "Index to Volume X"
    norm = title.lower()
    if norm in ("contents", "cover", "front matter", "back matter", "editorial board", "index", "preface"):
        return False

    # 3. Discard if abstract is solely a generic publisher or paywall placeholder
    abstract = (paper.abstract or "").strip()
    if abstract:
        norm_abs = abstract.lower()
        if re.search(r"(?i)^(this issue contains the following articles|full text available to subscribers|no abstract available\b)", norm_abs):
            return False

    return True

def reconstruct_openalex_abstract(inverted_index: Optional[dict]) -> str:
    """Reconstruct plain-text abstract from OpenAlex inverted index."""
    if not inverted_index or not isinstance(inverted_index, dict):
        return ""
    word_map = {}
    for word, positions in inverted_index.items():
        if isinstance(positions, list):
            for pos in positions:
                word_map[pos] = word
    if not word_map:
        return ""
    return " ".join([word_map[i] for i in sorted(word_map.keys())])

@rate_limit_shield(max_retries=2, base_delay=1.0)
async def fetch_openalex_papers(
    topic: str,
    max_results: int = 50,
    offset: int = 0,
    year_min: Optional[int] = None,
    year_max: Optional[int] = None,
    no_year_constraint: bool = False,
    client: Optional[httpx.AsyncClient] = None
) -> List[RawPaperMetadata]:
    """Fetch literature from OpenAlex with paged retrieval and rate-limit protection."""
    settings = get_settings()
    url = "https://api.openalex.org/works"
    papers: List[RawPaperMetadata] = []

    # Configure date filter
    filters = []
    if not no_year_constraint:
        if year_min and year_max:
            filters.append(f"publication_year:{year_min}-{year_max}")
        elif year_min:
            filters.append(f"publication_year:>{year_min - 1}")
        elif year_max:
            filters.append(f"publication_year:<{year_max + 1}")

    page_size = min(max_results, 50)
    start_page = (offset // page_size) + 1
    total_pages = max(1, min((max_results + page_size - 1) // page_size, 4)) # Cap at 4 pages (200 max)

    should_close = False
    if client is None:
        client = httpx.AsyncClient(timeout=14.0)
        should_close = True

    try:
        for page_idx in range(total_pages):
            page = start_page + page_idx
            params = {
                "search": topic,
                "per_page": page_size,
                "page": page,
                "select": "id,doi,title,publication_year,authorships,primary_location,open_access,abstract_inverted_index",
                "mailto": settings.academic_contact_email
            }
            if filters:
                params["filter"] = ",".join(filters)

            response = await client.get(url, params=params)
            if response.status_code != 200:
                break

            data = response.json()
            results = data.get("results", [])
            if not results:
                break

            for item in results:
                title = item.get("title") or ""
                if not title:
                    continue

                abstract = reconstruct_openalex_abstract(item.get("abstract_inverted_index"))
                
                authors = []
                for auth in item.get("authorships", []):
                    author_name = auth.get("author", {}).get("display_name")
                    if author_name:
                        authors.append(author_name)

                oa_info = item.get("open_access", {})
                is_oa = bool(oa_info.get("is_oa", False))
                pdf_url = oa_info.get("oa_url")
                primary_loc = item.get("primary_location") or {}
                if not pdf_url:
                    pdf_url = primary_loc.get("pdf_url")

                venue = None
                source_info = primary_loc.get("source") or {}
                if source_info:
                    venue = source_info.get("display_name")

                doi = item.get("doi")
                if doi and doi.startswith("https://doi.org/"):
                    doi = doi.replace("https://doi.org/", "")

                paper_id = item.get("id") or doi or title
                papers.append(RawPaperMetadata(
                    id=str(paper_id),
                    title=title.strip(),
                    authors=authors[:8],
                    year=item.get("publication_year"),
                    venue=venue or "OpenAlex Index",
                    doi=doi,
                    abstract=abstract.strip(),
                    is_oa=is_oa,
                    pdf_url=pdf_url,
                    source="openalex"
                ))

            if len(papers) >= max_results:
                break
            # Polite delay between pages
            if page < total_pages:
                await polite_delay(200, 350)

    except Exception as e:
        print(f"[OpenAlex Warning] Error fetching papers: {e}")
    finally:
        if should_close:
            await client.aclose()

    return papers[:max_results]

@rate_limit_shield(max_retries=2, base_delay=1.0)
async def fetch_crossref_papers(
    topic: str,
    max_results: int = 50,
    offset: int = 0,
    year_min: Optional[int] = None,
    year_max: Optional[int] = None,
    no_year_constraint: bool = False,
    client: Optional[httpx.AsyncClient] = None
) -> List[RawPaperMetadata]:
    """Fetch publisher registered DOIs directly from Crossref with offset pagination."""
    settings = get_settings()
    url = "https://api.crossref.org/works"
    papers: List[RawPaperMetadata] = []
    
    rows = min(max_results, 50)
    total_pages = max(1, min((max_results + rows - 1) // rows, 4))

    should_close = False
    if client is None:
        client = httpx.AsyncClient(timeout=14.0)
        should_close = True

    headers = {"User-Agent": f"AutoLit/1.0 (mailto:{settings.academic_contact_email})"}

    try:
        for page in range(total_pages):
            params = {
                "query": topic,
                "rows": rows,
                "offset": offset + (page * rows),
                "select": "DOI,title,author,published-print,published-online,container-title,abstract,link"
            }

            response = await client.get(url, params=params, headers=headers)
            if response.status_code != 200:
                break

            data = response.json()
            items = data.get("message", {}).get("items", [])
            if not items:
                break

            for item in items:
                title_list = item.get("title", [])
                title = title_list[0] if title_list else ""
                if not title:
                    continue

                doi = item.get("DOI")
                
                year = None
                pub_online = item.get("published-online") or item.get("published-print") or {}
                date_parts = pub_online.get("date-parts", [])
                if date_parts and date_parts[0]:
                    year = int(date_parts[0][0])

                if not no_year_constraint:
                    if year_min and year and year < year_min:
                        continue
                    if year_max and year and year > year_max:
                        continue

                authors = []
                for a in item.get("author", []):
                    given = a.get("given", "")
                    family = a.get("family", "")
                    full_name = f"{given} {family}".strip()
                    if full_name:
                        authors.append(full_name)

                raw_abstract = item.get("abstract", "")
                abstract_clean = re.sub(r'<[^>]+>', '', raw_abstract).strip()

                container = item.get("container-title", [])
                venue = container[0] if container else "Publisher Journal"

                papers.append(RawPaperMetadata(
                    id=doi or title,
                    title=title.strip(),
                    authors=authors[:8],
                    year=year,
                    venue=venue,
                    doi=doi,
                    abstract=abstract_clean,
                    is_oa=False,
                    pdf_url=None,
                    source="crossref"
                ))

            if len(papers) >= max_results:
                break
            if page < total_pages - 1:
                await polite_delay(200, 350)

    except Exception as e:
        print(f"[Crossref Warning] Error fetching papers: {e}")
    finally:
        if should_close:
            await client.aclose()

    return papers[:max_results]

@rate_limit_shield(max_retries=2, base_delay=1.0)
async def fetch_europe_pmc_papers(
    topic: str,
    max_results: int = 50,
    offset: int = 0,
    year_min: Optional[int] = None,
    year_max: Optional[int] = None,
    no_year_constraint: bool = False,
    client: Optional[httpx.AsyncClient] = None
) -> List[RawPaperMetadata]:
    """Fetch biomedical, life sciences, and PubMed papers from Europe PMC."""
    url = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"
    query_str = topic
    if not no_year_constraint:
        start_y = year_min or 1990
        end_y = year_max or 2026
        query_str = f"{topic} AND (FIRST_PDATE:[{start_y} TO {end_y}])"

    page_size = min(max_results, 50)
    page_num = (offset // page_size) + 1
    papers: List[RawPaperMetadata] = []

    should_close = False
    if client is None:
        client = httpx.AsyncClient(timeout=14.0)
        should_close = True

    try:
        params = {
            "query": query_str,
            "format": "json",
            "pageSize": page_size,
            "page": page_num,
            "resultType": "core"
        }
        response = await client.get(url, params=params)
        if response.status_code == 200:
            data = response.json()
            results = data.get("resultList", {}).get("result", [])
            for item in results:
                title = item.get("title") or ""
                if not title:
                    continue

                abstract = item.get("abstractText") or ""
                doi = item.get("doi")
                year = item.get("pubYear")
                if year and isinstance(year, str) and year.isdigit():
                    year = int(year)

                author_str = item.get("authorString") or ""
                authors = [a.strip() for a in author_str.split(",") if a.strip()][:8]
                is_oa = item.get("isOpenAccess") == "Y"

                pdf_url = None
                full_text_list = item.get("fullTextUrlList", {}).get("fullTextUrl", [])
                for ft in full_text_list:
                    if ft.get("documentStyle") == "pdf" or "pdf" in ft.get("url", "").lower():
                        pdf_url = ft.get("url")
                        break

                papers.append(RawPaperMetadata(
                    id=doi or item.get("id") or title,
                    title=title.strip().rstrip("."),
                    authors=authors,
                    year=year if isinstance(year, int) else None,
                    venue=item.get("journalTitle") or "Europe PMC",
                    doi=doi,
                    abstract=abstract.strip(),
                    is_oa=is_oa,
                    pdf_url=pdf_url,
                    source="europe_pmc"
                ))
    except Exception as e:
        print(f"[Europe PMC Warning] Error fetching papers: {e}")
    finally:
        if should_close:
            await client.aclose()

    return papers[:max_results]

@rate_limit_shield(max_retries=2, base_delay=1.0)
async def fetch_semantic_scholar_papers(
    topic: str,
    max_results: int = 30,
    offset: int = 0,
    year_min: Optional[int] = None,
    year_max: Optional[int] = None,
    no_year_constraint: bool = False,
    client: Optional[httpx.AsyncClient] = None
) -> List[RawPaperMetadata]:
    """Fetch literature from Semantic Scholar with rate-limit shield."""
    url = "https://api.semanticscholar.org/graph/v1/paper/search"
    params = {
        "query": topic,
        "offset": offset,
        "limit": min(max_results, 30),
        "fields": "paperId,externalIds,title,abstract,year,authors,venue,openAccessPdf"
    }

    papers: List[RawPaperMetadata] = []
    should_close = False
    if client is None:
        client = httpx.AsyncClient(timeout=10.0)
        should_close = True

    try:
        response = await client.get(url, params=params)
        if response.status_code == 200:
            data = response.json()
            items = data.get("data", [])
            for item in items:
                title = item.get("title") or ""
                if not title:
                    continue

                year = item.get("year")
                if not no_year_constraint:
                    if year_min and year and year < year_min:
                        continue
                    if year_max and year and year > year_max:
                        continue

                ext_ids = item.get("externalIds") or {}
                doi = ext_ids.get("DOI")

                authors = []
                for a in item.get("authors", []):
                    if a.get("name"):
                        authors.append(a.get("name"))

                oa_pdf = item.get("openAccessPdf") or {}
                pdf_url = oa_pdf.get("url")

                papers.append(RawPaperMetadata(
                    id=item.get("paperId") or doi or title,
                    title=title.strip(),
                    authors=authors[:8],
                    year=year,
                    venue=item.get("venue") or "Semantic Scholar",
                    doi=doi,
                    abstract=(item.get("abstract") or "").strip(),
                    is_oa=bool(pdf_url),
                    pdf_url=pdf_url,
                    source="semanticscholar"
                ))
    except Exception as e:
        print(f"[Semantic Scholar Warning] Error: {e}")
    finally:
        if should_close:
            await client.aclose()

    return papers[:max_results]

@rate_limit_shield(max_retries=2, base_delay=1.0)
async def fetch_arxiv_papers(
    topic: str,
    max_results: int = 30,
    offset: int = 0,
    client: Optional[httpx.AsyncClient] = None
) -> List[RawPaperMetadata]:
    """Fetch preprints from arXiv API."""
    # Whitelist and sanitize search query to prevent partial SSRF
    clean_topic = re.sub(r"[^\w\s:\"-]", " ", topic).strip()
    encoded_topic = urllib.parse.quote(clean_topic or "science")
    safe_offset = max(0, int(offset))
    safe_max_results = min(max(1, int(max_results)), 100)
    url = f"https://export.arxiv.org/api/query?search_query=all:{encoded_topic}&start={safe_offset}&max_results={safe_max_results}&sortBy=relevance&sortOrder=descending"
    
    papers: List[RawPaperMetadata] = []
    should_close = False
    if client is None:
        client = httpx.AsyncClient(timeout=12.0, follow_redirects=True)
        should_close = True

    try:
        response = await client.get(url, follow_redirects=True)
        if response.status_code == 200:
            root = ET.fromstring(response.text)
            ns = {
                "atom": "http://www.w3.org/2005/Atom",
                "arxiv": "http://arxiv.org/schemas/atom"
            }
            entries = root.findall("atom:entry", ns)
            for entry in entries:
                title_elem = entry.find("atom:title", ns)
                title = title_elem.text.strip().replace("\n", " ") if title_elem is not None and title_elem.text else ""
                if not title:
                    continue

                summary_elem = entry.find("atom:summary", ns)
                abstract = summary_elem.text.strip().replace("\n", " ") if summary_elem is not None and summary_elem.text else ""

                published_elem = entry.find("atom:published", ns)
                year = None
                if published_elem is not None and published_elem.text:
                    year_match = re.match(r"^(\d{4})", published_elem.text)
                    if year_match:
                        year = int(year_match.group(1))

                authors = []
                for author_elem in entry.findall("atom:author", ns):
                    name_elem = author_elem.find("atom:name", ns)
                    if name_elem is not None and name_elem.text:
                        authors.append(name_elem.text.strip())

                id_elem = entry.find("atom:id", ns)
                raw_id = id_elem.text.strip() if id_elem is not None and id_elem.text else ""
                
                pdf_url = None
                for link in entry.findall("atom:link", ns):
                    if link.attrib.get("title") == "pdf" or link.attrib.get("type") == "application/pdf":
                        pdf_url = link.attrib.get("href")
                        break
                
                if not pdf_url and raw_id:
                    arxiv_code = raw_id.split("/abs/")[-1]
                    pdf_url = f"https://arxiv.org/pdf/{arxiv_code}.pdf"

                papers.append(RawPaperMetadata(
                    id=raw_id or title,
                    title=title,
                    authors=authors[:8],
                    year=year,
                    venue="arXiv",
                    doi=None,
                    abstract=abstract,
                    is_oa=True,
                    pdf_url=pdf_url,
                    source="arxiv"
                ))
    except Exception as e:
        print(f"[arXiv Warning] Error fetching papers: {e}")
    finally:
        if should_close:
            await client.aclose()

    return papers[:max_results]

def deduplicate_papers(papers: List[RawPaperMetadata]) -> List[RawPaperMetadata]:
    """Deduplicate papers across all sources by normalized DOI and title, merging richer metadata."""
    title_map: Dict[str, RawPaperMetadata] = {}
    doi_map: Dict[str, str] = {}  # doi -> title_key

    for p in papers:
        doi_clean = (p.doi or "").lower().strip()
        title_key = normalize_title(p.title)

        if not title_key:
            continue

        existing_key = doi_map.get(doi_clean) if doi_clean else None
        target_key = existing_key or (title_key if title_key in title_map else None)

        if target_key:
            existing = title_map[target_key]
            # Monotonically coalesce metadata so DOIs and PDFs are NEVER lost
            if not existing.doi and p.doi:
                existing.doi = p.doi
                doi_map[p.doi.lower().strip()] = target_key
            if not existing.pdf_url and p.pdf_url:
                existing.pdf_url = p.pdf_url
                existing.is_oa = existing.is_oa or p.is_oa
            if len(p.abstract or "") > len(existing.abstract or ""):
                existing.abstract = p.abstract
            if len(p.authors) > len(existing.authors):
                existing.authors = p.authors
            if not existing.venue and p.venue:
                existing.venue = p.venue
            if existing.year is None and p.year is not None:
                existing.year = p.year
        else:
            title_map[title_key] = p
            if doi_clean:
                doi_map[doi_clean] = title_key

    return list(title_map.values())

async def discover_academic_papers(
    topic: str,
    max_results: int = 50,
    offset: int = 0,
    exclude_dois: Optional[List[str]] = None,
    year_min: Optional[int] = None,
    year_max: Optional[int] = None,
    no_year_constraint: bool = False
) -> List[RawPaperMetadata]:
    """Orchestrate deep multi-source discovery with rate-limit protection, pagination offset, and Tier 1 caching."""
    from app.services.cache_service import compute_query_hash, get_cached_discovery, save_discovery_cache

    exclude_set = {d.lower().strip() for d in (exclude_dois or []) if d}

    query_hash = compute_query_hash(
        topic=topic,
        year_min=year_min,
        year_max=year_max,
        no_year_constraint=no_year_constraint,
        max_results=max_results,
        offset=offset
    )

    # 1. Check Tier 1 Cache (if not paginating or if cached with offset)
    cached_papers = await get_cached_discovery(query_hash)
    if cached_papers is not None and len(cached_papers) > 0:
        filtered_cached = [
            p for p in cached_papers
            if not (p.doi and p.doi.lower().strip() in exclude_set) and not (p.id.lower().strip() in exclude_set)
        ]
        if filtered_cached:
            print(f"[Cache Hit: Tier 1 Discovery (offset={offset})] Loaded {len(filtered_cached)} candidate papers in 0ms (0 API calls).")
            return filtered_cached[:max_results]

    headers = {
        "User-Agent": f"AutoLit/1.0 (academic literature review tool; mailto:{get_settings().academic_contact_email})"
    }
    
    openalex_quota = max(20, int(max_results * 0.5))
    crossref_quota = max(15, int(max_results * 0.3))
    europepmc_quota = max(15, int(max_results * 0.25))
    arxiv_quota = max(10, int(max_results * 0.2))
    s2_quota = min(15, max(10, int(max_results * 0.15)))

    async with httpx.AsyncClient(timeout=20.0, headers=headers) as client:
        t_openalex = fetch_openalex_papers(
            topic, max_results=openalex_quota, offset=offset, year_min=year_min, year_max=year_max,
            no_year_constraint=no_year_constraint, client=client
        )
        t_crossref = fetch_crossref_papers(
            topic, max_results=crossref_quota, offset=offset, year_min=year_min, year_max=year_max,
            no_year_constraint=no_year_constraint, client=client
        )
        t_europepmc = fetch_europe_pmc_papers(
            topic, max_results=europepmc_quota, offset=offset, year_min=year_min, year_max=year_max,
            no_year_constraint=no_year_constraint, client=client
        )
        t_arxiv = fetch_arxiv_papers(topic, max_results=arxiv_quota, offset=offset, client=client)
        t_s2 = fetch_semantic_scholar_papers(
            topic, max_results=s2_quota, offset=offset, year_min=year_min, year_max=year_max,
            no_year_constraint=no_year_constraint, client=client
        )

        results = await asyncio.gather(t_openalex, t_crossref, t_europepmc, t_arxiv, t_s2, return_exceptions=True)

    combined: List[RawPaperMetadata] = []
    for res in results:
        if isinstance(res, list):
            combined.extend(res)

    unique = deduplicate_papers(combined)
    
    # Prune non-research items (journal covers, table of contents, errata, front matter)
    substantive = [p for p in unique if is_substantive_academic_paper(p)]

    # Filter out papers already present in exclude_set
    if exclude_set:
        substantive = [
            p for p in substantive
            if not (p.doi and p.doi.lower().strip() in exclude_set) and not (p.id.lower().strip() in exclude_set)
        ]

    final_papers = substantive[:max_results]

    # 2. Save into Tier 1 Cache
    if final_papers:
        filters_dict = {
            "year_min": year_min,
            "year_max": year_max,
            "no_year_constraint": no_year_constraint,
            "max_results": max_results,
            "offset": offset
        }
        await save_discovery_cache(query_hash, topic, filters_dict, final_papers)

    return final_papers
