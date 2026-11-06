import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_council_deliberation_general_query():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {
            "topic": "Quantum Computing Error Mitigation",
            "query": "Evaluate surface code vs bosonic code resilience"
        }
        res = await ac.post("/api/assistant/council", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "consensus_synthesis" in data
        assert "confidence_score" in data
        assert "member_deliberations" in data
        assert isinstance(data["member_deliberations"], list)
        assert len(data["member_deliberations"]) >= 1

@pytest.mark.asyncio
async def test_council_deliberation_paper_slice():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {
            "topic": "Graph Neural Networks",
            "paper_title": "Inductive Representation Learning on Large Graphs",
            "text_slice": "GraphSAGE generates low-dimensional vector representations for unseen nodes by sampling and aggregating local neighborhoods.",
            "active_members": ["groq", "gemini"]
        }
        res = await ac.post("/api/assistant/council", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "consensus_synthesis" in data
        assert "unanimous_findings" in data
        assert "contested_claims" in data
        assert 0.0 <= data["confidence_score"] <= 1.0
