import pytest
import httpx
from datetime import datetime, timezone
from sqlalchemy import select
from app.main import app
from app.db.database import AsyncSessionLocal
from app.db.models import ScreeningAuditLog
from app.services.academic_search import (
    RawPaperMetadata,
    fetch_arxiv_papers,
    deduplicate_papers
)

@pytest.mark.asyncio
async def test_prisma_stats_idempotent_no_double_counting():
    """
    Test that PRISMA flow statistics do not double-count papers when multiple
    screening decisions exist for the same paper in ScreeningAuditLog.
    When a paper is first excluded and then user changes decision to included,
    total_screened must count the paper once, and total_included must reflect the latest state.
    """
    workspace_id = f"test_prisma_ws_{datetime.now().timestamp()}"
    paper_id = "paper_double_count_test_123"

    async with AsyncSessionLocal() as session:
        # First decision: excluded (screen stage)
        rec1 = ScreeningAuditLog(
            workspace_id=workspace_id,
            paper_id=paper_id,
            paper_title="Multi-Agent Systems for Consensus",
            action="excluded",
            stage="title_abstract",
            exclusion_reason="Out of scope",
            created_at=datetime(2026, 1, 1, 10, 0, 0, tzinfo=timezone.utc)
        )
        session.add(rec1)
        # Second decision (later timestamp): included
        rec2 = ScreeningAuditLog(
            workspace_id=workspace_id,
            paper_id=paper_id,
            paper_title="Multi-Agent Systems for Consensus",
            action="included",
            stage="title_abstract",
            exclusion_reason=None,
            created_at=datetime(2026, 1, 1, 11, 0, 0, tzinfo=timezone.utc)
        )
        session.add(rec2)
        await session.commit()

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.get(f"/api/screening/prisma-flow/{workspace_id}")
        assert res.status_code == 200
        data = res.json()

        # The paper was ultimately included. It should NOT be counted as both excluded and included.
        # Total unique papers screened in this workspace is 1.
        assert data["total_screened"] == 1, (
            f"Expected total_screened to be 1 for single paper with updated decision, got {data['total_screened']}"
        )
        assert data["total_included"] == 1, (
            f"Expected total_included to be 1, got {data['total_included']}"
        )
        assert data["screen_excluded"] == 0, (
            f"Expected screen_excluded to be 0 since paper was updated to included, got {data['screen_excluded']}"
        )

@pytest.mark.asyncio
async def test_arxiv_301_follow_redirects():
    """
    Test that fetch_arxiv_papers follows HTTP 301 redirects and parses the returned XML.
    Many export.arxiv.org HTTP requests receive a 301 Moved Permanently to HTTPS.
    """
    sample_xml = """<?xml version="1.0" encoding="UTF-8"?>
    <feed xmlns="http://www.w3.org/2005/Atom">
      <entry>
        <id>http://arxiv.org/abs/2301.00001v1</id>
        <title>Attention In Large Language Models</title>
        <summary>A detailed empirical survey of multi-head attention.</summary>
        <author><name>Vaswani et al.</name></author>
        <published>2023-01-01T00:00:00Z</published>
      </entry>
    </feed>"""

    def mock_handler(request: httpx.Request) -> httpx.Response:
        url_str = str(request.url)
        if url_str.startswith("http://"):
            # Simulate arXiv redirecting http to https
            redirect_url = url_str.replace("http://", "https://")
            return httpx.Response(301, headers={"Location": redirect_url})
        elif url_str.startswith("https://"):
            return httpx.Response(200, content=sample_xml.encode("utf-8"), headers={"Content-Type": "application/atom+xml"})
        return httpx.Response(404)

    mock_transport = httpx.MockTransport(mock_handler)
    async with httpx.AsyncClient(transport=mock_transport) as client:
        papers = await fetch_arxiv_papers(topic="attention", max_results=5, client=client)
        assert len(papers) > 0, "Expected arXiv papers to be parsed following redirect, got empty list"
        assert papers[0].title == "Attention In Large Language Models"
        assert "arxiv" in papers[0].source

def test_deduplication_preserves_richer_metadata():
    """
    Test that deduplicate_papers does not discard a later record with full DOI and PDF URL
    in favor of an earlier stub record with identical title but missing DOI and PDF.
    """
    stub_paper = RawPaperMetadata(
        id="stub_1",
        title="Attention Is All You Need",
        authors=["Vaswani"],
        year=2017,
        venue="",
        abstract="Short abstract",
        source="semantic_scholar",
        doi=None,
        pdf_url=None,
        citation_count=1000
    )

    rich_paper = RawPaperMetadata(
        id="rich_2",
        title="Attention Is All You Need",
        authors=["Ashish Vaswani", "Noam Shazeer"],
        year=2017,
        venue="NeurIPS",
        abstract="The dominant sequence transduction models are based on complex recurrent or convolutional neural networks...",
        source="openalex",
        doi="10.5555/3295222.3295349",
        pdf_url="https://arxiv.org/pdf/1706.03762",
        citation_count=120000
    )

    deduped = deduplicate_papers([stub_paper, rich_paper])
    assert len(deduped) == 1, f"Expected 1 deduplicated paper, got {len(deduped)}"
    # The retained paper MUST have the valid DOI and PDF URL
    assert deduped[0].doi == "10.5555/3295222.3295349", (
        f"Expected deduplication to preserve the richer paper with DOI, got {deduped[0].doi}"
    )
    assert deduped[0].pdf_url == "https://arxiv.org/pdf/1706.03762", (
        f"Expected deduplication to preserve open access PDF link, got {deduped[0].pdf_url}"
    )

@pytest.mark.asyncio
async def test_screening_audit_log_record():
    """Test recording an audit log entry via POST /api/screening/decision."""
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "workspace_id": "test_audit_ws",
            "paper_id": "paper_test_audit_1",
            "paper_title": "Deep Residual Learning for Image Recognition",
            "action": "included",
            "stage": "title_abstract",
            "notes": "Fundamental baseline architecture"
        }
        res = await client.post("/api/screening/decision", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["paper_id"] == "paper_test_audit_1"
        assert data["action"] == "included"
