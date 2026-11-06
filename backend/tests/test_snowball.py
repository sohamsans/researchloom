import pytest
from app.services.snowball_service import reconstruct_abstract, extract_authors, parse_work_to_item
from app.services.bulk_download_service import normalize_citation_key, escape_latex_text

def test_reconstruct_abstract():
    inverted = {
        "Attention": [0],
        "is": [1],
        "all": [2],
        "you": [3],
        "need.": [4]
    }
    result = reconstruct_abstract(inverted)
    assert result == "Attention is all you need."

def test_reconstruct_abstract_cap():
    inverted = {f"word{i}": [i] for i in range(300)}
    result = reconstruct_abstract(inverted)
    words = result.split()
    assert len(words) == 250

def test_extract_authors():
    work = {
        "authorships": [
            {"author": {"display_name": "Ashish Vaswani"}},
            {"author": {"display_name": "Noam Shazeer"}}
        ]
    }
    authors = extract_authors(work)
    assert authors == ["Ashish Vaswani", "Noam Shazeer"]

def test_parse_work_to_item():
    work = {
        "id": "https://openalex.org/W3035965352",
        "title": "Attention Is All You Need",
        "publication_year": 2017,
        "cited_by_count": 120000,
        "doi": "https://doi.org/10.48550/arxiv.1706.03762",
        "authorships": [{"author": {"display_name": "Ashish Vaswani"}}],
        "primary_location": {"source": {"display_name": "NeurIPS"}},
        "open_access": {"is_oa": True, "oa_url": "https://arxiv.org/pdf/1706.03762"}
    }
    item = parse_work_to_item(work, relation="predecessor")
    assert item.id == "W3035965352"
    assert item.title == "Attention Is All You Need"
    assert item.year == 2017
    assert item.relation == "predecessor"
    assert item.is_oa is True
