from typing import Optional, List
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from sqlalchemy import select
from app.db.database import AsyncSessionLocal
from app.db.models import PaperDocumentVault, PaperCache
from app.services.bulk_download_service import fetch_and_vault_paper

router = APIRouter(prefix="/api/clipper", tags=["Loom Clipper Web Extension Bridge"])

class CheckPaperRequest(BaseModel):
    doi: Optional[str] = None
    title: Optional[str] = None
    url: Optional[str] = None

class IngestPaperRequest(BaseModel):
    title: str
    authors: List[str] = []
    year: Optional[int] = None
    abstract: Optional[str] = None
    doi: Optional[str] = None
    venue: Optional[str] = None
    pdf_url: Optional[str] = None
    source_url: Optional[str] = None
    tags: List[str] = []

@router.get("/status")
async def clipper_status():
    """Heartbeat endpoint for the browser extension to verify local app connectivity."""
    return {
        "status": "online",
        "app": "ResearchLoom",
        "version": "4.3.6",
        "vault_ready": True
    }

@router.post("/check")
async def check_paper_exists(req: CheckPaperRequest):
    """
    Check if a paper is already in the user's vault or discovery cache by DOI or normalized title.
    Returns status badge info for the extension popup.
    """
    doi_norm = req.doi.strip().lower() if req.doi else None
    title_norm = req.title.strip().lower() if req.title else None

    if not doi_norm and not title_norm:
        return {"exists": False, "in_vault": False}

    async with AsyncSessionLocal() as session:
        # Check vault
        stmt = select(PaperDocumentVault)
        res = await session.execute(stmt)
        vault_items = res.scalars().all()
        for v in vault_items:
            if doi_norm and v.doi and v.doi.strip().lower() == doi_norm:
                return {
                    "exists": True,
                    "in_vault": True,
                    "paper_id": v.id,
                    "title": v.title,
                    "has_pdf": bool(v.file_path)
                }
            if title_norm and v.title and v.title.strip().lower() == title_norm:
                return {
                    "exists": True,
                    "in_vault": True,
                    "paper_id": v.id,
                    "title": v.title,
                    "has_pdf": bool(v.file_path)
                }

        # Check Tier 2 PaperCache
        stmt_p = select(PaperCache)
        res_p = await session.execute(stmt_p)
        cached_items = res_p.scalars().all()
        for c in cached_items:
            if doi_norm and c.doi and c.doi.strip().lower() == doi_norm:
                return {
                    "exists": True,
                    "in_vault": False,
                    "paper_id": c.cache_key,
                    "title": c.title,
                    "has_pdf": False
                }
            if title_norm and c.title and c.title.strip().lower() == title_norm:
                return {
                    "exists": True,
                    "in_vault": False,
                    "paper_id": c.cache_key,
                    "title": c.title,
                    "has_pdf": False
                }

    return {"exists": False, "in_vault": False}

@router.post("/ingest")
async def ingest_paper(paper: IngestPaperRequest):
    """
    Ingest a paper clipped directly from an academic webpage into the ResearchLoom vault.
    Triggers automated PDF resolution and background caching if a direct PDF URL is provided.
    """
    if not paper.title or not paper.title.strip():
        raise HTTPException(status_code=400, detail="Paper title is required")

    async with AsyncSessionLocal() as session:
        # Prevent exact duplicates
        stmt = select(PaperDocumentVault)
        res = await session.execute(stmt)
        existing_vault = res.scalars().all()
        for v in existing_vault:
            if paper.doi and v.doi and v.doi.strip().lower() == paper.doi.strip().lower():
                return {
                    "status": "already_exists",
                    "paper_id": v.id,
                    "title": v.title,
                    "message": "Paper already in vault"
                }

        # Generate safe unique ID
        import hashlib
        id_source = paper.doi.strip().lower() if paper.doi else paper.title.strip().lower()
        safe_id = hashlib.sha256(id_source.encode('utf-8')).hexdigest()[:32]

        # Create vault record
        new_entry = PaperDocumentVault(
            id=safe_id,
            title=paper.title.strip(),
            doi=paper.doi.strip() if paper.doi else None,
            file_path="",
            file_size_bytes=0,
            file_sha256="",
            source_resolved="loom_clipper"
        )
        session.add(new_entry)
        await session.commit()
        await session.refresh(new_entry)

        # Trigger background PDF download if a direct or Open Access URL is supplied
        pdf_status = "no_url"
        if paper.pdf_url:
            try:
                download_res = await fetch_and_vault_paper(
                    paper_id=str(new_entry.id),
                    doi=paper.doi,
                    pdf_url=paper.pdf_url,
                    title=paper.title
                )
                if download_res and download_res.get("file_path"):
                    new_entry.file_path = download_res.get("file_path")
                    await session.commit()
                    pdf_status = "downloaded"
                else:
                    pdf_status = "queued"
            except Exception:
                pdf_status = "failed"

        return {
            "status": "success",
            "paper_id": new_entry.id,
            "title": new_entry.title,
            "pdf_status": pdf_status,
            "message": f"Successfully clipped '{new_entry.title}' into ResearchLoom"
        }
