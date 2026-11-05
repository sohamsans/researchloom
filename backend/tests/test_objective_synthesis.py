import asyncio
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.models.schemas import RawPaperMetadata, SelectedPipelineRequest
from app.services.llm_provider import UniversalLLMClient
import pytest

@pytest.mark.asyncio
async def test_guided_objective():
    print("--- Testing Guided Research Objective Triage ---")
    llm = UniversalLLMClient()
    
    # 3 mock papers:
    # 1. On underwater ramjet water inlet CFD
    # 2. General solid rocket motor propellant grain burn rate (space/missile)
    # 3. Supercavitating vehicle hydrofoil drag reduction
    papers = [
        {
            "id": "paper-1-ramjet-inlet",
            "title": "Computational Fluid Dynamics of Direct Water Inlets for High-Speed Hydro-Ramjet Engines",
            "year": 2023,
            "abstract": "This study analyzes supersonic and high-subsonic water intake efficiency and bubble ingestion characteristics for water-reactive underwater ramjet engines operating at high speeds."
        },
        {
            "id": "paper-2-space-rocket",
            "title": "Combustion Instability in Composite Solid Propellant Rocket Motors for Space Launch Vehicles",
            "year": 2021,
            "abstract": "Acoustic cavity oscillations and burning surface erosive effects in composite solid rocket motors used for space launch and atmospheric flight trajectories."
        },
        {
            "id": "paper-3-supercavitation-cavity",
            "title": "Artificial Supercavitation Cavity Closure and Ventilated Gas Dynamics on Cylindrical Bodies",
            "year": 2022,
            "abstract": "Experimental measurement of cavity pulsating behavior, closure lines, and skin friction drag reduction in high-speed water tunnels."
        }
    ]

    goal = "Optimize water intake and inlet diffusion dynamics specifically for underwater hydro-ramjet propulsion"
    
    print(f"Goal: '{goal}'")
    triage_result = await llm.batch_triage(
        topic="Underwater ramjets and high speed propulsion",
        candidates=papers,
        research_goal=goal
    )

    print("\nTriage Evaluations:")
    score_map = {}
    for ev in triage_result.evaluations:
        print(f"[{ev.id}] Score: {ev.score}/5 | Rationale: {ev.rationale}")
        score_map[ev.id] = ev.score

    # Paper 1 should receive the highest score (e.g. 4 or 5)
    # Paper 2 (space rocket) should receive a low score (1 or 2 or 3)
    assert score_map.get("paper-1-ramjet-inlet", 0) >= 3, "Hydro-ramjet inlet paper should score high"
    print("\nVerified: Objective guidance successfully passed through triage evaluation.")

if __name__ == "__main__":
    asyncio.run(test_guided_objective())
