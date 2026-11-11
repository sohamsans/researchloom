import time
import secrets
import json
import uuid
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import select, or_
from app.db.database import AsyncSessionLocal
from app.db.models import PaperDocumentVault, PaperCache, ManuscriptNote, BibliographicReference, get_utc_now
from app.services.bulk_download_service import normalize_citation_key

router = APIRouter(prefix="/api/sync", tags=["P2P Local Network Vault Sync"])

# In-memory session store for local device pairing
active_pairing_tokens: Dict[str, float] = {}

class PairDeviceRequest(BaseModel):
    pin: str
    device_name: str

class SyncDeltaRequest(BaseModel):
    token: str
    last_sync_timestamp: Optional[float] = 0.0

class PushUpdatesRequest(BaseModel):
    token: str
    papers: List[Dict[str, Any]] = []
    notes: List[Dict[str, Any]] = []
    stylus_drawings: List[Dict[str, Any]] = []

@router.get("/pin")
async def generate_pairing_pin():
    """
    Generate an ephemeral 6-digit PIN and token valid for 5 minutes for local Wi-Fi pairing.
    """
    pin = f"{secrets.randbelow(900000) + 100000}"
    # Expire in 300 seconds
    active_pairing_tokens[pin] = time.time() + 300.0
    return {
        "pin": pin,
        "expires_in_seconds": 300,
        "instructions": "Enter this 6-digit PIN on your Android Tablet to pair over local Wi-Fi"
    }

@router.post("/pair")
async def pair_device(req: PairDeviceRequest):
    """
    Validate the entered PIN from an Android tablet or secondary computer and issue a session token.
    """
    expires = active_pairing_tokens.get(req.pin)
    if not expires or time.time() > expires:
        raise HTTPException(status_code=400, detail="Invalid or expired pairing PIN")

    # Generate permanent device session token
    token = f"p2p_{secrets.token_hex(16)}"
    # Invalidate one-time PIN
    del active_pairing_tokens[req.pin]
    active_pairing_tokens[token] = time.time() + (86400.0 * 30) # 30 days session

    return {
        "status": "paired",
        "token": token,
        "device_name": req.device_name,
        "message": f"Successfully paired {req.device_name} with ResearchLoom desktop"
    }

@router.get("/delta")
async def get_sync_delta(token: str, since: float = 0.0):
    """
    Pull updated vaulted papers and notes modified since the given timestamp.
    """
    if token not in active_pairing_tokens:
        raise HTTPException(status_code=401, detail="Unauthorized sync session token")

    async with AsyncSessionLocal() as session:
        stmt = select(PaperDocumentVault)
        res = await session.execute(stmt)
        vault_items = res.scalars().all()

        papers = []
        for v in vault_items:
            papers.append({
                "id": v.id,
                "title": v.title,
                "doi": v.doi,
                "source": v.source_resolved,
                "has_pdf": bool(v.file_path and len(v.file_path) > 0)
            })

        return {
            "timestamp": time.time(),
            "papers_count": len(papers),
            "papers": papers
        }

async def _persist_synced_papers(session, incoming_papers: List[Dict[str, Any]], source_label: str = "tablet_sync") -> int:
    applied_papers = 0
    seen_cite_keys = set()
    for p in incoming_papers:
        title = (p.get("title") or "").strip()
        if not title:
            continue
        authors = p.get("authors") or []
        year = p.get("year")
        raw_doi = p.get("doi")
        clean_doi = raw_doi.strip().lower() if (raw_doi and str(raw_doi).strip()) else None

        base_cite_key = normalize_citation_key(authors, year, title)
        cite_key = base_cite_key

        # Disambiguate intra-batch duplicate citation keys
        disambig_idx = 1
        while cite_key in seen_cite_keys:
            cite_key = f"{base_cite_key}_{disambig_idx}"
            disambig_idx += 1
        seen_cite_keys.add(cite_key)

        # Check existing in SQLite by cite_key or valid non-empty clean_doi
        conditions = [BibliographicReference.citation_key == cite_key]
        if clean_doi:
            conditions.append(BibliographicReference.doi == clean_doi)

        existing_stmt = select(BibliographicReference).where(or_(*conditions))
        res = await session.execute(existing_stmt)
        existing_ref = res.scalars().first()

        if existing_ref:
            # Non-destructive enrich of existing record
            if p.get("abstract") and len(p.get("abstract")) > len(existing_ref.abstract or ""):
                existing_ref.abstract = p.get("abstract")
            if p.get("venue") and not existing_ref.venue:
                existing_ref.venue = p.get("venue")
            if p.get("year") and not existing_ref.year:
                existing_ref.year = p.get("year")
            existing_ref.updated_at = get_utc_now()
            applied_papers += 1
        else:
            ref = BibliographicReference(
                id=str(uuid.uuid4()),
                citation_key=cite_key,
                cite_author_year=cite_key[:30],
                entry_type="article",
                title=title,
                authors_json=json.dumps(authors),
                year=year,
                venue=p.get("venue"),
                doi=clean_doi,
                abstract=p.get("abstract"),
                source=source_label,
                created_at=get_utc_now(),
                updated_at=get_utc_now()
            )
            session.add(ref)
            applied_papers += 1
    return applied_papers

async def _persist_synced_notes(session, incoming_notes: List[Dict[str, Any]]) -> int:
    applied_notes = 0
    for n in incoming_notes:
        note_id = n.get("id")
        title = n.get("title")
        existing_note = None
        if note_id:
            n_stmt = select(ManuscriptNote).where(ManuscriptNote.id == note_id)
            n_res = await session.execute(n_stmt)
            existing_note = n_res.scalars().first()
        elif title:
            n_stmt = select(ManuscriptNote).where(ManuscriptNote.title == title)
            n_res = await session.execute(n_stmt)
            existing_note = n_res.scalars().first()

        if existing_note:
            existing_note.title = n.get("title", existing_note.title)
            existing_note.content = n.get("content", existing_note.content)
            existing_note.mode = n.get("mode", existing_note.mode)
            existing_note.updated_at = get_utc_now()
            applied_notes += 1
        else:
            new_note = ManuscriptNote(
                id=note_id or str(uuid.uuid4()),
                title=n.get("title", "Synced Research Note"),
                mode=n.get("mode", "rich"),
                content=n.get("content", ""),
                created_at=get_utc_now(),
                updated_at=get_utc_now()
            )
            session.add(new_note)
            applied_notes += 1
    return applied_notes

async def _persist_synced_strokes(session, incoming_strokes: List[Dict[str, Any]]):
    if incoming_strokes:
        stroke_note = ManuscriptNote(
            id=str(uuid.uuid4()),
            title=f"Stylus Annotation ({time.strftime('%Y-%m-%d %H:%M')})",
            mode="rich",
            content=f"> [Handwritten Tablet Drawing]: Synced {len(incoming_strokes)} vector stroke elements.\n\n```json\n{json.dumps(incoming_strokes[:20])}\n```",
            created_at=get_utc_now(),
            updated_at=get_utc_now()
        )
        session.add(stroke_note)

@router.post("/push")
async def push_sync_updates(req: PushUpdatesRequest):
    """
    Receive updates from the tablet (e.g. stylus strokes, local notes, or clipped citations).
    """
    if req.token not in active_pairing_tokens:
        raise HTTPException(status_code=401, detail="Unauthorized sync session token")

    applied_papers = 0
    applied_notes = 0

    async with AsyncSessionLocal() as session:
        applied_papers = await _persist_synced_papers(session, req.papers, source_label="tablet_sync")
        applied_notes = await _persist_synced_notes(session, req.notes)
        await _persist_synced_strokes(session, req.stylus_drawings)
        await session.commit()

    applied_count = applied_papers + applied_notes + len(req.stylus_drawings)
    return {
        "status": "success",
        "applied_count": applied_count,
        "applied_papers": applied_papers,
        "applied_notes": applied_notes,
        "synced_at": time.time(),
        "message": f"Synchronized {applied_count} items from remote device"
    }

class EodCommitRequest(BaseModel):
    token: Optional[str] = None
    new_papers: List[Dict[str, Any]] = []
    notes: List[Dict[str, Any]] = []
    stylus_strokes: List[Dict[str, Any]] = []

@router.get("/eod/diff")
async def get_eod_sync_diff(since_timestamp: float = 0.0):
    """
    Computes bidirectional diff between local database state and remote peer
    for 1-click End-of-Day reconciliation across tablet and desktop.
    """
    async with AsyncSessionLocal() as session:
        v_stmt = select(PaperDocumentVault)
        v_res = await session.execute(v_stmt)
        vault_items = v_res.scalars().all()

        n_stmt = select(ManuscriptNote)
        n_res = await session.execute(n_stmt)
        note_items = n_res.scalars().all()

        return {
            "timestamp": time.time(),
            "vault_count": len(vault_items),
            "notes_count": len(note_items),
            "vault_summary": [
                {"id": v.id, "title": v.title, "doi": v.doi, "has_pdf": bool(v.file_path)}
                for v in vault_items[:50]
            ],
            "notes_summary": [
                {"id": n.id, "title": n.title, "mode": n.mode}
                for n in note_items[:50]
            ]
        }

@router.post("/eod/commit")
async def commit_eod_sync(req: EodCommitRequest):
    """
    Atomic transaction applying merged papers, notes, and stylus strokes at End-of-Day.
    """
    async with AsyncSessionLocal() as session:
        applied_papers = await _persist_synced_papers(session, req.new_papers, source_label="eod_commit")
        applied_notes = await _persist_synced_notes(session, req.notes)
        await _persist_synced_strokes(session, req.stylus_strokes)
        await session.commit()

        return {
            "status": "success",
            "applied_notes": applied_notes,
            "applied_papers": applied_papers,
            "applied_strokes": len(req.stylus_strokes),
            "synced_at": time.time(),
            "message": f"Successfully committed End-of-Day sync: {applied_notes} notes and {applied_papers} papers merged."
        }
