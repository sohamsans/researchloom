import json
import re
try:
    import fitz # PyMuPDF
except ImportError:
    fitz = None
from typing import Dict, Any, List, Optional, Tuple
from pathlib import Path
from app.services.llm_provider import UniversalLLMClient, clean_json_text
from app.services.cache_service import get_cached_synthesis

def extract_tables_and_text_from_pdf(pdf_path: str, max_pages: int = 12) -> Tuple[str, List[Dict[str, Any]]]:
    """
    Extract clean layout-aware text and Markdown tables from a local PDF file.
    Returns: (combined_context, list_of_table_metadata)
    """
    if fitz is None:
        return "", []
    doc = None
    try:
        doc = fitz.open(pdf_path)
        extracted_sections: List[str] = []
        tables_meta: List[Dict[str, Any]] = []

        total_pages = min(len(doc), max_pages)
        for page_idx in range(total_pages):
            page = doc[page_idx]
            page_num = page_idx + 1

            # 1. Layout-Aware Table Detection via PyMuPDF
            try:
                tabs = page.find_tables()
                if tabs and len(tabs.tables) > 0:
                    for tab in tabs:
                        # Extract table as Markdown
                        df_table = tab.extract()
                        if df_table and len(df_table) > 1:
                            header = " | ".join(str(c or "").strip() for c in df_table[0])
                            divider = " | ".join(["---"] * len(df_table[0]))
                            body_lines = [" | ".join(str(c or "").strip() for c in row) for row in df_table[1:]]
                            md_table = f"Table on Page {page_num}:\n| {header} |\n| {divider} |\n" + "\n".join(f"| {b} |" for b in body_lines)
                            extracted_sections.append(md_table)
                            tables_meta.append({
                                "page": page_num,
                                "bbox": list(tab.bbox), # [x0, y0, x1, y1]
                                "text": md_table
                            })
            except Exception as te:
                pass # Table extraction fallback

            # 2. Page body text (clean linebreaks)
            text = page.get_text("text")
            if text:
                # Strip excessive whitespace and running headers
                clean_lines = [l.strip() for l in text.split("\n") if l.strip() and not l.strip().isdigit()]
                extracted_sections.append(f"[Page {page_num}]\n" + "\n".join(clean_lines[:60]))

        return "\n\n".join(extracted_sections)[:14000], tables_meta
    except Exception as e:
        print(f"[PDF Extraction Error]: {e}")
        return "", []
    finally:
        if doc:
            doc.close()

async def extract_matrix_cell_value(
    paper_title: str,
    paper_doi: Optional[str],
    column_name: str,
    prompt: str,
    data_type: str,
    llm: UniversalLLMClient,
    pdf_path: Optional[str] = None,
    abstract: Optional[str] = None
) -> Dict[str, Any]:
    """
    Extract a single structured cell value with strict typing, confidence,
    'not_reported' anti-hallucination handling, and source sentence/bounding box.
    """
    context_text = ""
    tables_meta = []

    # Priority 1: Read full text from local PDF if available
    if pdf_path and Path(pdf_path).exists():
        context_text, tables_meta = extract_tables_and_text_from_pdf(pdf_path)

    # Priority 2: Use cached synthesis or abstract fallback
    if not context_text:
        if abstract:
            context_text = f"Title: {paper_title}\n\nAbstract:\n{abstract}"
        else:
            context_text = f"Title: {paper_title}"

    system_instruction = (
        "You are an expert scientific data extraction and evidence synthesis engine.\n"
        "Your task is to extract an exact factual data point from the provided academic paper context.\n\n"
        "STRICT EXTRACTION RULES:\n"
        "1. ANTI-HALLUCINATION: If the paper does NOT explicitly mention or report the required dimension, you MUST output:\n"
        '   "status": "not_reported", "confidence": "not_mentioned", "value": "Not reported in context"\n'
        "2. Do NOT fabricate numbers, dataset names, or sample sizes.\n"
        "3. Provide the exact verbatim sentence from the text as 'source_sentence'.\n"
        "4. If estimating or inferring from related text, set 'status': 'inferred' and 'confidence': 'low'.\n"
        "5. Output ONLY a valid JSON object matching the schema below."
    )

    schema_example = {
        "value": "Extracted string, number, or list conforming to data_type",
        "status": "reported", # "reported", "not_reported", or "inferred"
        "confidence": "high", # "high", "low", or "not_mentioned"
        "source_sentence": "Exact sentence extracted from context or null",
        "source_page": 1 # Integer page number if found, or null
    }

    user_prompt = (
        f"Paper Title: {paper_title}\n"
        f"Target Column: {column_name}\n"
        f"Extraction Prompt / Instruction: {prompt}\n"
        f"Required Data Type: {data_type}\n\n"
        f"Expected Output JSON Schema:\n{json.dumps(schema_example, indent=2)}\n\n"
        f"Paper Content Context:\n{context_text}"
    )

    try:
        raw_response = await llm.chat_completion(
            system_prompt=system_instruction,
            user_prompt=user_prompt,
            max_tokens=800,
            response_json=True
        )
        cleaned = clean_json_text(raw_response)
        parsed = json.loads(cleaned)

        val = parsed.get("value", "Not reported")
        # Format string representation
        if isinstance(val, (list, dict)):
            val_str = json.dumps(val)
        else:
            val_str = str(val)

        status = parsed.get("status", "reported")
        confidence = parsed.get("confidence", "high")
        source_sentence = parsed.get("source_sentence")
        source_page = parsed.get("source_page")

        # Fallback bounding box search if page is reported
        bbox = None
        if source_page and tables_meta:
            for t in tables_meta:
                if t.get("page") == source_page:
                    bbox = t.get("bbox")
                    break

        return {
            "value": val_str,
            "status": status,
            "confidence": confidence,
            "source_sentence": source_sentence,
            "source_page": source_page,
            "bounding_box": bbox
        }
    except Exception as e:
        print(f"[Matrix LLM Extraction Error]: {e}")
        return {
            "value": "Extraction error",
            "status": "not_reported",
            "confidence": "low",
            "source_sentence": str(e),
            "source_page": None,
            "bounding_box": None
        }
