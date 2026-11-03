import json
import logging
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, desc
import httpx
from app.db.database import AsyncSessionLocal
from app.db.models import FlowCanvas

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/flow", tags=["Flow Map Canvas Studio"])

class CreateCanvasRequest(BaseModel):
    title: str = "Untitled Flow Map"
    topic: str = "General Research"
    nodes_json: str = "[]"
    edges_json: str = "[]"
    viewport_json: str = '{"x": 0, "y": 0, "zoom": 1}'

class UpdateCanvasRequest(BaseModel):
    title: Optional[str] = None
    topic: Optional[str] = None
    nodes_json: Optional[str] = None
    edges_json: Optional[str] = None
    viewport_json: Optional[str] = None

@router.get("/canvases")
async def list_canvases():
    """List all flow map canvases saved by the researcher."""
    async with AsyncSessionLocal() as session:
        stmt = select(FlowCanvas).order_by(desc(FlowCanvas.updated_at))
        result = await session.execute(stmt)
        canvases = result.scalars().all()
        return [
            {
                "id": c.id,
                "title": c.title,
                "topic": c.topic,
                "nodes_json": c.nodes_json,
                "edges_json": c.edges_json,
                "viewport_json": c.viewport_json,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None
            }
            for c in canvases
        ]

@router.post("/canvases")
async def create_canvas(req: CreateCanvasRequest):
    """Create a new dedicated canvas for a research topic."""
    async with AsyncSessionLocal() as session:
        new_canvas = FlowCanvas(
            title=req.title,
            topic=req.topic,
            nodes_json=req.nodes_json,
            edges_json=req.edges_json,
            viewport_json=req.viewport_json
        )
        session.add(new_canvas)
        await session.commit()
        await session.refresh(new_canvas)
        return {
            "id": new_canvas.id,
            "title": new_canvas.title,
            "topic": new_canvas.topic,
            "nodes_json": new_canvas.nodes_json,
            "edges_json": new_canvas.edges_json,
            "viewport_json": new_canvas.viewport_json,
            "created_at": new_canvas.created_at.isoformat() if new_canvas.created_at else None,
            "updated_at": new_canvas.updated_at.isoformat() if new_canvas.updated_at else None
        }

@router.put("/canvases/{canvas_id}")
async def update_canvas(canvas_id: str, req: UpdateCanvasRequest):
    """Update title, topic, nodes, edges, or camera viewport for a canvas."""
    async with AsyncSessionLocal() as session:
        stmt = select(FlowCanvas).where(FlowCanvas.id == canvas_id)
        result = await session.execute(stmt)
        canvas = result.scalar_one_or_none()
        if not canvas:
            raise HTTPException(status_code=404, detail="Canvas not found")

        if req.title is not None:
            canvas.title = req.title
        if req.topic is not None:
            canvas.topic = req.topic
        if req.nodes_json is not None:
            canvas.nodes_json = req.nodes_json
        if req.edges_json is not None:
            canvas.edges_json = req.edges_json
        if req.viewport_json is not None:
            canvas.viewport_json = req.viewport_json

        await session.commit()
        await session.refresh(canvas)
        return {
            "id": canvas.id,
            "title": canvas.title,
            "topic": canvas.topic,
            "nodes_json": canvas.nodes_json,
            "edges_json": canvas.edges_json,
            "viewport_json": canvas.viewport_json,
            "updated_at": canvas.updated_at.isoformat() if canvas.updated_at else None
        }

@router.delete("/canvases/{canvas_id}")
async def delete_canvas(canvas_id: str):
    """Delete a flow map canvas."""
    async with AsyncSessionLocal() as session:
        stmt = select(FlowCanvas).where(FlowCanvas.id == canvas_id)
        result = await session.execute(stmt)
        canvas = result.scalar_one_or_none()
        if not canvas:
            raise HTTPException(status_code=404, detail="Canvas not found")

        await session.delete(canvas)
        await session.commit()
        return {"status": "deleted", "id": canvas_id}

@router.get("/paper-trail")
async def get_paper_trail(doi: str = Query(..., description="DOI of the paper to parse citations for")):
    """
    Genuine Paper Trail: Query OpenAlex / Crossref to extract the real reference list
    and cited works of a paper, returning real academic records for the canvas.
    """
    clean_doi = doi.strip().replace("https://doi.org/", "").replace("http://doi.org/", "").strip()
    if not clean_doi:
        raise HTTPException(status_code=400, detail="Invalid DOI provided")

    headers = {"User-Agent": "LitBuddy/5.2 (mailto:team@litbuddy.ai; academic research assistant)"}
    
    # 1. Fetch work details from OpenAlex polite pool
    openalex_url = f"https://api.openalex.org/works/https://doi.org/{clean_doi}"
    cited_records = []
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(openalex_url, headers=headers)
            if resp.status_code == 200:
                work_data = resp.json()
                referenced_works = work_data.get("referenced_works", [])
                
                # Fetch metadata for the top 10-15 referenced works in a single batch
                if referenced_works:
                    top_refs = referenced_works[:12]
                    # Filter IDs to form batch query
                    clean_ids = "|".join([ref.split("/")[-1] for ref in top_refs])
                    batch_url = f"https://api.openalex.org/works?filter=openalex_id:{clean_ids}&per-page=15"
                    
                    batch_resp = await client.get(batch_url, headers=headers)
                    if batch_resp.status_code == 200:
                        batch_data = batch_resp.json()
                        for item in batch_data.get("results", []):
                            authors = [a.get("author", {}).get("display_name", "") for a in item.get("authorships", [])]
                            authors = [a for a in authors if a]
                            primary_loc = item.get("primary_location") or {}
                            pdf_url = primary_loc.get("pdf_url") or ""
                            source_name = primary_loc.get("source", {}).get("display_name", "") if primary_loc.get("source") else ""
                            
                            cited_records.append({
                                "id": item.get("id", "").split("/")[-1] or f"oa_{abs(hash(item.get('title')))}",
                                "title": item.get("title", "Untitled Reference"),
                                "authors": authors[:5],
                                "year": item.get("publication_year"),
                                "venue": source_name,
                                "doi": item.get("doi", "").replace("https://doi.org/", ""),
                                "pdf_url": pdf_url,
                                "cited_by_count": item.get("cited_by_count", 0),
                                "is_oa": item.get("open_access", {}).get("is_oa", False)
                            })
    except Exception as e:
        logger.warning(f"OpenAlex reference lookup error for DOI {clean_doi}: {e}")

    # Fallback to Crossref if OpenAlex did not yield results
    if not cited_records:
        try:
            crossref_url = f"https://api.crossref.org/works/{clean_doi}"
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(crossref_url, headers=headers)
                if resp.status_code == 200:
                    data = resp.json().get("message", {})
                    references = data.get("reference", [])
                    for idx, ref in enumerate(references[:10]):
                        ref_doi = ref.get("DOI")
                        authors = [ref.get("author")] if ref.get("author") else []
                        cited_records.append({
                            "id": f"ref_{idx}_{clean_doi[-6:]}",
                            "title": ref.get("article-title") or ref.get("volume-title") or ref.get("unstructured", f"Reference {idx+1}"),
                            "authors": authors,
                            "year": int(ref.get("year")) if ref.get("year") and str(ref.get("year")).isdigit() else None,
                            "venue": ref.get("journal-title", ""),
                            "doi": ref_doi,
                            "pdf_url": "",
                            "cited_by_count": 0,
                            "is_oa": False
                        })
        except Exception as e:
            logger.warning(f"Crossref fallback lookup error for DOI {clean_doi}: {e}")

    return {
        "source_doi": clean_doi,
        "count": len(cited_records),
        "references": cited_records
    }

class GenerateAIFlowMapRequest(BaseModel):
    topic: str
    papers: Optional[List[dict]] = None
    clusters_count: int = 4
    model_provider: Optional[str] = "groq"
    model_name: Optional[str] = None
    groq_api_key: Optional[str] = None
    gemini_api_key: Optional[str] = None
    claude_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    openrouter_api_key: Optional[str] = None
    deepseek_api_key: Optional[str] = None
    nvidia_api_key: Optional[str] = None
    custom_api_key: Optional[str] = None
    custom_base_url: Optional[str] = None

@router.post("/generate-ai-map")
async def generate_ai_flow_map(req: GenerateAIFlowMapRequest):
    """
    Generate an AI-structured Flow Map (Knowledge Graph) with central thesis,
    clusters (Foundations, Methodology, Benchmarks, Open Gaps), and semantic edges.
    """
    from app.services.llm_provider import UniversalLLMClient, clean_json_text

    llm = UniversalLLMClient(
        provider=req.model_provider,
        model_name=req.model_name,
        groq_key=req.groq_api_key,
        gemini_key=req.gemini_api_key,
        claude_key=req.claude_api_key,
        openai_key=req.openai_api_key,
        openrouter_key=req.openrouter_api_key,
        deepseek_key=req.deepseek_api_key,
        nvidia_key=req.nvidia_api_key,
        custom_key=req.custom_api_key,
        custom_base_url=req.custom_base_url
    )

    paper_context = ""
    if req.papers:
        paper_context = "\n".join([
            f"- Title: {p.get('title', '')} | Year: {p.get('year', '')} | Abstract: {p.get('abstract', '')[:120]}"
            for p in req.papers[:10]
        ])

    system_prompt = (
        "You are an expert academic research graph architect. Given a research topic and optional papers, "
        "synthesize a structured knowledge graph for an interactive canvas. "
        "Return ONLY a clean JSON object with keys: 'canvas_title', 'clusters', and 'edges'.\n"
        "Schema:\n"
        "{\n"
        "  \"canvas_title\": \"string\",\n"
        "  \"central_node\": {\"title\": \"string\", \"subtitle\": \"string\"},\n"
        "  \"clusters\": [\n"
        "    {\n"
        "      \"id\": \"cluster_1\",\n"
        "      \"title\": \"string (e.g. Theoretical Foundations, Core Methodologies, Empirical Benchmarks, Open Research Gaps)\",\n"
        "      \"color\": \"amber|emerald|blue|purple|rose|zinc\",\n"
        "      \"notes\": [\n"
        "        {\"title\": \"string\", \"content\": \"1-2 sentence key takeaway or finding\"}\n"
        "      ]\n"
        "    }\n"
        "  ],\n"
        "  \"edges\": [\n"
        "    {\"source\": \"cluster_id or center\", \"target\": \"cluster_id\", \"label\": \"implements|cites|contrasts|builds_upon\"}\n"
        "  ]\n"
        "}"
    )

    user_prompt = f"Research Topic: {req.topic}\n\nAvailable Literature:\n{paper_context}"

    try:
        raw_res = await llm.chat_completion(
            system_prompt=system_prompt,
            user_prompt=user_prompt,
            max_tokens=2500,
            response_json=True
        )
        cleaned = clean_json_text(raw_res)
        graph_data = json.loads(cleaned)
    except Exception as e:
        logger.warning(f"AI Flow Map generation fallback triggered: {e}")
        # Deterministic architectural fallback
        graph_data = {
            "canvas_title": f"Synthesis Map: {req.topic[:35]}",
            "central_node": {"title": req.topic, "subtitle": "Core Research Objective"},
            "clusters": [
                {
                    "id": "c_foundations",
                    "title": "Theoretical Foundations",
                    "color": "blue",
                    "notes": [{"title": "Baseline Paradigms", "content": "Classical mechanisms and foundational mathematical principles."}]
                },
                {
                    "id": "c_methods",
                    "title": "Core Methodologies",
                    "color": "emerald",
                    "notes": [{"title": "Algorithmic Innovations", "content": "Modern computational implementations and architectural backbones."}]
                },
                {
                    "id": "c_benchmarks",
                    "title": "Empirical Benchmarks",
                    "color": "amber",
                    "notes": [{"title": "Quantitative Metrics", "content": "SOTA evaluation results and comparative ablation studies."}]
                },
                {
                    "id": "c_gaps",
                    "title": "Open Research Gaps",
                    "color": "rose",
                    "notes": [{"title": "Unresolved Limitations", "content": "Scalability bottlenecks and unaddressed edge cases."}]
                }
            ],
            "edges": [
                {"source": "center", "target": "c_foundations", "label": "builds_upon"},
                {"source": "c_foundations", "target": "c_methods", "label": "implements"},
                {"source": "c_methods", "target": "c_benchmarks", "label": "evaluates"},
                {"source": "c_benchmarks", "target": "c_gaps", "label": "contrasts"}
            ]
        }

    # Layout nodes across 2D plane with hierarchical coordinates
    nodes = []
    edges = []

    # 1. Central Core Node
    central = graph_data.get("central_node", {})
    center_id = "node_center"
    nodes.append({
        "id": center_id,
        "type": "folder",
        "title": central.get("title", req.topic),
        "subtitle": central.get("subtitle", "Central Research Node"),
        "x": 480,
        "y": 80,
        "isCollapsed": False,
        "childPaperIds": [],
        "childPapers": []
    })

    # 2. Clustered Tiers
    clusters = graph_data.get("clusters", [])
    col_spacing = 330
    start_x = max(80, 480 - ((len(clusters) - 1) * col_spacing) // 2)

    for c_idx, cluster in enumerate(clusters):
        c_id = cluster.get("id", f"cluster_{c_idx}")
        cx = start_x + c_idx * col_spacing
        cy = 280

        # Cluster Hub Folder
        nodes.append({
            "id": c_id,
            "type": "folder",
            "title": cluster.get("title", f"Cluster {c_idx+1}"),
            "subtitle": f"{len(cluster.get('notes', []))} Synthesis Notes",
            "x": cx,
            "y": cy,
            "isCollapsed": False,
            "childPaperIds": [],
            "childPapers": []
        })

        # Link central node to cluster
        edges.append({
            "id": f"edge_center_{c_id}",
            "source": center_id,
            "target": c_id,
            "label": "synthesizes",
            "type": "trail"
        })

        # Child Sticky Notes under each cluster
        note_y = cy + 140
        for n_idx, note in enumerate(cluster.get("notes", [])):
            note_id = f"note_{c_id}_{n_idx}"
            nodes.append({
                "id": note_id,
                "type": "note",
                "title": note.get("title", "Insight"),
                "content": note.get("content", ""),
                "color": cluster.get("color", "amber"),
                "x": cx,
                "y": note_y + n_idx * 160
            })
            edges.append({
                "id": f"edge_{c_id}_{note_id}",
                "source": c_id,
                "target": note_id,
                "label": "note",
                "type": "user_connection"
            })

    # Return clean synthesized Canvas JSON
    return {
        "title": graph_data.get("canvas_title", f"AI Flow Map: {req.topic[:30]}"),
        "nodes": nodes,
        "edges": edges
    }
