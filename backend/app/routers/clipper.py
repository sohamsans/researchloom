import os
import hashlib
from typing import Optional, List
from fastapi import APIRouter, HTTPException, Header, Depends
from pydantic import BaseModel
from sqlalchemy import select
from app.db.database import AsyncSessionLocal
from app.db.models import PaperDocumentVault, PaperCache, ManuscriptNote
from app.services.bulk_download_service import fetch_and_vault_paper

router = APIRouter(prefix="/api/clipper", tags=["Loom Clipper Web Extension Bridge"])

# Callback reference to wake desktop pywebview window if registered
window_restore_callback = None

def register_window_restore_callback(cb):
    global window_restore_callback
    window_restore_callback = cb

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

class QuickNoteRequest(BaseModel):
    title: Optional[str] = "Clipper Quick Thought"
    content: str
    source_url: Optional[str] = None

@router.get("/status")
async def clipper_status():
    """Heartbeat endpoint for the browser extension to verify local app connectivity."""
    return {
        "status": "online",
        "app": "ResearchLoom",
        "version": "4.3.6",
        "vault_ready": True
    }

@router.post("/launch-app")
async def launch_desktop_app():
    """
    Called by the browser extension to wake and bring the ResearchLoom desktop window to the front.
    """
    global window_restore_callback
    if window_restore_callback:
        try:
            window_restore_callback()
            return {"status": "success", "message": "Desktop app window restored to front"}
        except Exception:
            return {"status": "error", "message": "Unable to restore window"}
    return {"status": "standalone", "message": "Backend running in server mode without pywebview window"}

@router.post("/quick-note")
async def save_quick_note(req: QuickNoteRequest):
    """
    Saves a quick scratchpad thought or quote directly from the browser extension into ResearchLoom notes.
    """
    if not req.content or not req.content.strip():
        raise HTTPException(status_code=400, detail="Note content cannot be empty")

    async with AsyncSessionLocal() as session:
        formatted_content = req.content.strip()
        if req.source_url:
            formatted_content += f"\n\n*Captured via Loom Clipper from: [{req.source_url}]({req.source_url})*"

        note = ManuscriptNote(
            title=req.title.strip() if req.title else "Clipper Quick Thought",
            mode="rich",
            content=formatted_content
        )
        session.add(note)
        await session.commit()
        await session.refresh(note)

        return {
            "status": "success",
            "note_id": note.id,
            "title": note.title,
            "message": "Note saved to ResearchLoom notes"
        }

@router.get("/search")
async def search_vault_mini(q: str = ""):
    """
    Fast mini vault search endpoint designed specifically for the browser extension popup.
    """
    async with AsyncSessionLocal() as session:
        stmt = select(PaperDocumentVault)
        res = await session.execute(stmt)
        all_papers = res.scalars().all()

        q_lower = q.strip().lower()
        results = []
        for p in all_papers:
            if not q_lower or (q_lower in p.title.lower()) or (p.doi and q_lower in p.doi.lower()):
                results.append({
                    "id": p.id,
                    "title": p.title,
                    "doi": p.doi,
                    "has_pdf": bool(p.file_path and len(p.file_path) > 0)
                })
                if len(results) >= 8:
                    break

        return {"query": q, "results": results}

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

        id_source = paper.doi.strip().lower() if paper.doi else paper.title.strip().lower()
        safe_id = hashlib.sha256(id_source.encode('utf-8')).hexdigest()[:32]

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
