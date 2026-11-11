import pytest
import httpx
from app.main import app

@pytest.mark.asyncio
async def test_manuscript_notes_crud_lifecycle():
    """
    Test full CRUD lifecycle for Writing Studio manuscripts via /api/notes.
    - Create a manuscript draft
    - Retrieve by note ID
    - List manuscripts and verify presence
    - Update manuscript content and word count
    - Delete manuscript
    """
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # 1. Create draft
        create_payload = {
            "title": "Quantum Error Correction Literature Survey",
            "mode": "rich",
            "content": "Surface codes offer an exceptionally high fault-tolerant error threshold approaching one percent.",
            "associated_topic": "Quantum Computing",
            "citations": ["Fowler2012Surface"]
        }
        res_create = await client.post("/api/notes", json=create_payload)
        assert res_create.status_code == 200
        note = res_create.json()
        note_id = note["id"]
        assert note["title"] == "Quantum Error Correction Literature Survey"
        assert note["word_count"] > 10

        # 2. Get by ID
        res_get = await client.get(f"/api/notes/{note_id}")
        assert res_get.status_code == 200
        assert res_get.json()["id"] == note_id

        # 3. List manuscripts
        res_list = await client.get("/api/notes")
        assert res_list.status_code == 200
        notes_list = res_list.json()
        assert any(n["id"] == note_id for n in notes_list["items"])

        # 4. Update draft
        update_payload = {
            "id": note_id,
            "title": "Updated Quantum Error Correction Review",
            "mode": "rich",
            "content": "Updated content with additional empirical benchmarks and decoder comparisons.",
            "citations": ["Fowler2012Surface", "Gidney2021Fault"]
        }
        res_update = await client.post("/api/notes", json=update_payload)
        assert res_update.status_code == 200
        assert res_update.json()["title"] == "Updated Quantum Error Correction Review"
        assert len(res_update.json()["citations"]) == 2

        # 5. Delete draft
        res_del = await client.delete(f"/api/notes/{note_id}")
        assert res_del.status_code == 200

        # 6. Verify 404 after deletion
        res_verify = await client.get(f"/api/notes/{note_id}")
        assert res_verify.status_code == 404

@pytest.mark.asyncio
async def test_statistics_t_test_endpoint():
    """
    Test /api/stats/t-test endpoint calculating Welch's two-sample t-test,
    effect size (Cohen's d), and 95% confidence intervals.
    """
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "group_a": [12.5, 14.2, 13.8, 15.1, 14.9, 16.0],
            "group_b": [9.1, 10.4, 10.0, 11.2, 9.8, 10.5],
            "paired": False,
            "equal_var": False,
            "alpha": 0.05
        }
        res = await client.post("/api/stats/t-test", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert "statistic" in data
        assert "p_value" in data
        assert "cohens_d" in data
        assert data["p_value"] < 0.01
        assert data["is_significant"] is True

@pytest.mark.asyncio
async def test_formula_calculator_offline_synthesis():
    """
    Test /api/calc/ai-synthesize endpoint returns deterministic curated formula block
    when offline keywords (e.g. 'reynolds', 'drag', 'cavitation') are queried.
    """
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        payload = {
            "prompt": "Calculate the Reynolds number for boundary layer flow"
        }
        res = await client.post("/api/calc/ai-synthesize", json=payload)
        assert res.status_code == 200
        data = res.json()
        assert data["name"] == "Reynolds Number"
        assert "Re" in data["outputSymbol"]
        assert len(data["variables"]) == 4
        assert r"\frac{\rho v L}{\mu}" in data["latex"]
