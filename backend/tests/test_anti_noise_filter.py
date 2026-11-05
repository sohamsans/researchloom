import pytest
from app.models.schemas import RawPaperMetadata
from app.services.academic_search import is_substantive_academic_paper

def test_anti_noise_filter_discards_junk():
    # 1. Front matter & covers
    cover = RawPaperMetadata(
        id="c1",
        title="Inside Front Cover: Advanced Energy Materials 12/2023",
        authors=["Journal Editors"],
        abstract="Cover image representing energy storage.",
        is_oa=False,
        source="crossref"
    )
    assert is_substantive_academic_paper(cover) is False

    # 2. Table of contents
    toc = RawPaperMetadata(
        id="c2",
        title="Table of Contents - Issue 4",
        authors=[],
        abstract="List of articles appearing in this issue.",
        is_oa=False,
        source="openalex"
    )
    assert is_substantive_academic_paper(toc) is False

    # 3. Erratum / Corrigendum
    erratum = RawPaperMetadata(
        id="c3",
        title="Corrigendum to: High-Speed Direct Ingestion Dynamics",
        authors=["A. Author"],
        abstract="An error occurred in Equation 4...",
        is_oa=True,
        source="crossref"
    )
    assert is_substantive_academic_paper(erratum) is False

    # 4. Genuine research paper
    legit_paper = RawPaperMetadata(
        id="c4",
        title="Hydrodynamic Cavitation and Shock Wave Suppression in Supersonic Inlets",
        authors=["J. Doe", "K. Smith"],
        abstract="We present experimental and numerical results on shock wave boundary layer interaction in submerged supersonic water intakes.",
        is_oa=True,
        source="arxiv"
    )
    assert is_substantive_academic_paper(legit_paper) is True
