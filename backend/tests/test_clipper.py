import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app

@pytest.mark.asyncio
async def test_clipper_status():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.get("/api/clipper/status")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "online"
        assert data["app"] == "ResearchLoom"

@pytest.mark.asyncio
async def test_clipper_check_nonexistent():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        res = await ac.post("/api/clipper/check", json={"doi": "10.9999/nonexistent.paper", "title": "Random Nonexistent Paper"})
        assert res.status_code == 200
        data = res.json()
        assert data["exists"] is False
        assert data["in_vault"] is False

@pytest.mark.asyncio
async def test_clipper_ingest_paper():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        payload = {
            "title": "Quantum Attention Architectures for Synthesis",
            "authors": ["A. Einstein", "N. Bohr"],
            "year": 2026,
            "venue": "Nature Quantum",
            "doi": "10.1038/s41586-026-9999",
            "abstract": "A novel formulation unifying attention mechanisms and quantum state spaces.",
            "tags": ["Clipped", "Quantum"]
        }
        res = await ac.post("/api/clipper/ingest", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["status"] in ["success", "already_exists"]
        assert "paper_id" in data
