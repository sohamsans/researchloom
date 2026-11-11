import pytest
import httpx
from unittest.mock import patch
from app.main import app
from app.services.snowball_service import (
    resolve_seed_work,
    perform_citation_snowballing,
    reconstruct_abstract,
    extract_authors,
    parse_work_to_item
)

@pytest.mark.asyncio
async def test_snowball_backward_and_forward_exploration():
    """
    Test deterministic snowball exploration for both backward (references)
    and forward (citations) directions using mock transport.
    """
    seed_work = {
        "id": "https://openalex.org/W2741809807",
        "title": "Attention Is All You Need",
        "publication_year": 2017,
        "authorships": [{"author": {"display_name": "Ashish Vaswani"}}],
        "cited_by_count": 100000,
        "referenced_works": ["https://openalex.org/W1984422662"],
        "primary_location": {"source": {"display_name": "NeurIPS"}},
        "open_access": {"is_oa": True, "oa_url": "https://arxiv.org/pdf/1706.03762"},
        "abstract_inverted_index": {"The": [0], "dominant": [1], "sequence": [2]}
    }

    ref_work = {
        "id": "https://openalex.org/W1984422662",
        "title": "Neural Machine Translation by Jointly Learning to Align and Translate",
        "publication_year": 2014,
        "authorships": [{"author": {"display_name": "Dzmitry Bahdanau"}}],
        "cited_by_count": 30000,
        "referenced_works": [],
        "primary_location": {"source": {"display_name": "ICLR"}},
        "open_access": {"is_oa": True, "oa_url": "https://arxiv.org/pdf/1409.0473"},
        "abstract_inverted_index": {"Neural": [0], "machine": [1], "translation": [2]}
    }

    def mock_openalex_handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        if "filter=" in url_str:
            # Snowball query for references or citations
            return httpx.Response(200, json={"meta": {"count": 1}, "results": [ref_work]})
        elif "W2741809807" in url_str:
            return httpx.Response(200, json=seed_work)
        elif "W1984422662" in url_str:
            return httpx.Response(200, json=ref_work)
        return httpx.Response(404, json={"error": "Not found"})

    orig_client = httpx.AsyncClient
    mock_transport = httpx.MockTransport(mock_openalex_handler)
    with patch("httpx.AsyncClient", side_effect=lambda **kw: orig_client(transport=mock_transport)):
        # Test backward
        backward_res = await perform_citation_snowballing(
            seed_identifier="W2741809807",
            direction="backward",
            max_results=5
        )
        assert backward_res.seed.title == "Attention Is All You Need"
        assert len(backward_res.papers) >= 1
        assert backward_res.papers[0].title == "Neural Machine Translation by Jointly Learning to Align and Translate"
        assert backward_res.papers[0].relation == "predecessor"

        # Test forward
        forward_res = await perform_citation_snowballing(
            seed_identifier="W2741809807",
            direction="forward",
            max_results=5
        )
        assert forward_res.seed.title == "Attention Is All You Need"
        assert len(forward_res.papers) >= 1
        assert forward_res.papers[0].relation == "successor"

@pytest.mark.asyncio
async def test_snowball_seed_identifier_normalizer():
    """
    Test seed identifier normalization across diverse input styles:
    - Canonical OpenAlex ID: W123456
    - DOI: 10.1145/3295222
    - arXiv with underscore: arxiv_1706_03762
    - arXiv with version: 1706.03762v2
    """
    def mock_normalizer_handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        return httpx.Response(200, json={
            "id": "https://openalex.org/W999999",
            "title": "Normalized Seed Paper",
            "publication_year": 2020,
            "authorships": [],
            "referenced_works": []
        })

    mock_transport = httpx.MockTransport(mock_normalizer_handler)
    async with httpx.AsyncClient(transport=mock_transport) as client:
        # 1. Canonical W ID
        res_w = await resolve_seed_work(client, "W123456")
        assert res_w is not None and res_w["id"] == "https://openalex.org/W999999"

        # 2. arXiv with underscore
        res_arxiv = await resolve_seed_work(client, "arxiv_1706_03762")
        assert res_arxiv is not None

        # 3. arXiv with version
        res_arxiv_v = await resolve_seed_work(client, "1706.03762v2")
        assert res_arxiv_v is not None

@pytest.mark.asyncio
async def test_flow_canvas_crud_endpoints():
    """Test Flow Map canvas persistence endpoints: list, create, update, delete."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # Create canvas
        payload = {
            "title": "Neural Architecture Canvas",
            "topic": "Transformers",
            "nodes_json": '[{"id": "n1", "label": "Transformer"}]',
            "edges_json": "[]"
        }
        res = await client.post("/api/flow/canvases", json=payload)
        assert res.status_code == 200
        canvas_data = res.json()
        canvas_id = canvas_data["id"]
        assert canvas_data["title"] == "Neural Architecture Canvas"

        # List canvases
        res_list = await client.get("/api/flow/canvases")
        assert res_list.status_code == 200
        canvases = res_list.json()
        assert any(c["id"] == canvas_id for c in canvases)

        # Delete canvas
        res_del = await client.delete(f"/api/flow/canvases/{canvas_id}")
        assert res_del.status_code == 200
