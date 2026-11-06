import pytest
from app.services.bulk_download_service import normalize_citation_key, escape_latex_text
from app.services.reference_ingestion_service import parse_bibtex_entries, parse_csl_json

def test_latex_character_escaping():
    raw = "Analysis of BERT & GPT with 99% accuracy in $O(N^2)$ space."
    escaped = escape_latex_text(raw)
    assert "\\&" in escaped
    assert "\\%" in escaped
    assert "$O(N^2)$" in escaped # Math mode intact
    assert "{BERT}" in escaped
    assert "{GPT}" in escaped

def test_latex_acronym_not_double_braced():
    raw = "Comparing {BERT} and GPT models"
    escaped = escape_latex_text(raw)
    assert "{{BERT}}" not in escaped
    assert "{BERT}" in escaped
    assert "{GPT}" in escaped

def test_citation_key_normalization():
    key = normalize_citation_key(["Ashish Vaswani", "Noam Shazeer"], 2017, "Attention Is All You Need")
    assert key == "Vaswani2017Attention"

def test_latin_special_transliteration():
    key1 = normalize_citation_key(["Jan Łukasiewicz"], 1951, "Aristotle's Syllogistic")
    assert key1 == "Lukasiewicz1951Aristotle"

    key2 = normalize_citation_key(["Øystein Ore"], 1962, "Theory of Graphs")
    assert key2 == "Ore1962Theory"

def test_bibtex_parsing():
    bibtex = """
    @article{Vaswani2017,
      title = {Attention is all you need},
      author = {Vaswani, Ashish and Shazeer, Noam},
      year = {2017},
      journal = {NeurIPS},
      doi = {10.48550/arXiv.1706.03762}
    }
    """
    records = parse_bibtex_entries(bibtex, "Test Collection")
    assert len(records) == 1
    r = records[0]
    assert r["citation_key"] == "Vaswani2017Attention"
    assert r["year"] == 2017
    assert r["doi"] == "10.48550/arXiv.1706.03762"

def test_csl_json_parsing():
    csl = """[
      {
        "id": "item1",
        "type": "article-journal",
        "title": "Deep Residual Learning for Image Recognition",
        "author": [{"family": "He", "given": "Kaiming"}],
        "issued": {"date-parts": [[2016, 6, 1]]},
        "container-title": "CVPR",
        "DOI": "10.1109/CVPR.2016.90"
      }
    ]"""
    records = parse_csl_json(csl, "CSL Test")
    assert len(records) == 1
    r = records[0]
    assert r["citation_key"] == "He2016Deep"
    assert r["year"] == 2016
    assert r["doi"] == "10.1109/CVPR.2016.90"
