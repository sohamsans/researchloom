import pytest
import httpx
from unittest.mock import patch, AsyncMock
from app.main import app
from app.services.council_service import CouncilConsensusResult, CouncilEvaluation

@pytest.mark.asyncio
async def test_council_deliberation_passes_query():
    """
    Test that POST /api/assistant/council correctly forwards the user's `query`
    parameter to `MultiLLMCouncilService.deliberate`, rather than silently discarding it.
    """
    mock_consensus = CouncilConsensusResult(
        consensus_synthesis="The council concludes that the proposed architecture achieves significant throughput gains.",
        unanimous_findings=["Throughput increases by 2.4x on edge accelerators."],
        contested_claims=["Quantization impact on tail-latency remains debated."],
        member_deliberations=[
            CouncilEvaluation(
                member="Gemini Fast",
                model="gemini-3.8-flash",
                vote="Endorse",
                confidence=0.92,
                key_arguments=["Empirical speedup confirmed on Jetson Orin."],
                potential_hallucinations=[]
            )
        ],
        confidence_score=0.88
    )

    with patch("app.routers.assistant.MultiLLMCouncilService.deliberate", new_callable=AsyncMock) as mock_deliberate:
        mock_deliberate.return_value = mock_consensus

        payload = {
            "topic": "Edge LLM Acceleration",
            "paper_title": "Quantized Speculative Decoding",
            "text_slice": "We evaluate on embedded devices with INT4 weights.",
            "query": "Does the evaluation include energy consumption metrics per token?",
            "active_members": ["gemini", "groq"]
        }

        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
            res = await client.post("/api/assistant/council", json=payload)
            assert res.status_code == 200, f"Expected 200, got {res.status_code}: {res.text}"

            # Verify deliberate was called
            mock_deliberate.assert_called_once()
            call_kwargs = mock_deliberate.call_args[1]

            # The user query MUST be passed to deliberate!
            assert "query" in call_kwargs and call_kwargs["query"] == "Does the evaluation include energy consumption metrics per token?", (
                f"Council endpoint dropped the `query` parameter! kwargs: {call_kwargs}"
            )

@pytest.mark.asyncio
async def test_clipper_ingest_and_check_endpoints():
    """
    Test clipper ingestion and duplicate checking:
    - POST /api/clipper/ingest with title, DOI, authors, and pdf_url
    - POST /api/clipper/check verifying paper is detected as existing
    - POST /api/clipper/quick-note creating an annotated scratchpad note
    """
    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        # 1. Ingest paper
        ingest_payload = {
            "title": "FlashAttention: Fast and Memory-Efficient Exact Attention",
            "authors": ["Tri Dao", "Daniel Y. Fu"],
            "year": 2022,
            "doi": "10.48550/arXiv.2205.14135",
            "venue": "NeurIPS",
            "pdf_url": "https://arxiv.org/pdf/2205.14135.pdf",
            "source_url": "https://arxiv.org/abs/2205.14135",
            "tags": ["attention", "io-aware"]
        }
        res_ingest = await client.post("/api/clipper/ingest", json=ingest_payload)
        assert res_ingest.status_code == 200
        ingest_data = res_ingest.json()
        assert ingest_data["status"] in ("success", "already_exists")

        # 2. Check paper exists
        check_payload = {
            "doi": "10.48550/arXiv.2205.14135",
            "title": "FlashAttention: Fast and Memory-Efficient Exact Attention"
        }
        res_check = await client.post("/api/clipper/check", json=check_payload)
        assert res_check.status_code == 200
        check_data = res_check.json()
        assert check_data["exists"] is True

        # 3. Quick Note
        note_payload = {
            "title": "Key Insight from FlashAttention",
            "content": "IO complexity is quadratic in SRAM but linear in HBM transfers.",
            "source_url": "https://arxiv.org/abs/2205.14135"
        }
        res_note = await client.post("/api/clipper/quick-note", json=note_payload)
        assert res_note.status_code == 200
        assert res_note.json()["status"] == "success"
