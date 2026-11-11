import pytest
from app.services.reference_ingestion_service import (
    parse_bibtex_entries,
    parse_csl_json
)
from app.services.bulk_download_service import escape_latex_text

def test_bibtex_parser_unquoted_integers():
    """
    Test that BibTeX parser captures unquoted integer values (e.g. `year = 2024` or `volume = 12`)
    frequently exported by Google Scholar, Zotero, and Mendeley.
    Currently, the parser regex requires braces or quotes, causing year to become None
    and citation keys to end with 'Nd'.
    """
    bibtex_raw = """
    @article{vaswani2017attention,
      author = {Vaswani, Ashish and Shazeer, Noam},
      title = {Attention Is All You Need},
      year = 2017,
      volume = 30,
      journal = {NeurIPS}
    }
    """
    records = parse_bibtex_entries(bibtex_raw, collection_name="test_collection")
    assert len(records) == 1, f"Expected 1 record, got {len(records)}"
    rec = records[0]

    # Year must be parsed as integer 2017
    assert rec["year"] == 2017, f"Expected year 2017, but got {rec['year']}"
    # Citation key must end with 2017, NOT 'Nd'
    assert "2017" in rec["citation_key"], f"Expected citation_key to contain 2017, got {rec['citation_key']}"
    assert not rec["citation_key"].endswith("Nd"), f"Citation key erroneously ended with 'Nd': {rec['citation_key']}"

def test_bibtex_parser_nested_braces_with_commas():
    """
    Test that BibTeX parser correctly extracts titles containing nested braces with internal commas,
    such as `{Evaluating {AI, ML}, and DL models}`.
    Currently, the regex non-greedily stops at the internal comma after `{AI, ML}`,
    truncating the title to `Evaluating {AI, {ML}`.
    """
    bibtex_raw = """
    @article{smith2021evaluating,
      author = {Smith, John},
      title = {Evaluating {AI, ML}, and DL models in production},
      year = {2021},
      journal = {IEEE Software}
    }
    """
    records = parse_bibtex_entries(bibtex_raw, collection_name="test_collection")
    assert len(records) == 1
    rec = records[0]

    # Title must be completely preserved
    assert "and DL models in production" in rec["title"], (
        f"Title was truncated at nested brace comma! Got: '{rec['title']}'"
    )

def test_csl_json_ingestion():
    """Test standard CSL-JSON parsing and field extraction."""
    csl_raw = """[
      {
        "id": "ITEM-1",
        "type": "article-journal",
        "title": "Scaling Laws for Neural Language Models",
        "author": [
          {"family": "Kaplan", "given": "Jared"},
          {"family": "McCandlish", "given": "Sam"}
        ],
        "issued": {
          "date-parts": [[2020, 1, 23]]
        },
        "container-title": "arXiv preprint arXiv:2001.08361",
        "DOI": "10.48550/arXiv.2001.08361"
      }
    ]"""
    records = parse_csl_json(csl_raw, collection_name="csl_test")
    assert len(records) == 1
    rec = records[0]
    assert rec["title"] == "Scaling Laws for Neural Language Models"
    assert rec["year"] == 2020
    import json
    assert len(json.loads(rec["authors_json"])) == 2
    assert "Kaplan" in rec["citation_key"]

def test_latex_special_character_escaping():
    """Test escaping of LaTeX special characters while protecting math delimiters."""
    # Plain text with %, _, &, #
    raw_text = "Achieved 95% accuracy on dataset_v1 with P&L improvements #1"
    escaped = escape_latex_text(raw_text)
    assert r"95\%" in escaped
    assert r"dataset\_v1" in escaped
    assert r"P\&L" in escaped
    assert r"\#1" in escaped

    # Math mode preservation: $x_i \le 0.05$
    math_text = r"Threshold of $x_i \le 0.05$ achieved with 99% confidence"
    escaped_math = escape_latex_text(math_text)
    assert "$x_i \\le 0.05$" in escaped_math
    assert r"99\%" in escaped_math
