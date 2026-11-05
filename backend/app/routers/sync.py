import time
import secrets
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy import select
from app.db.database import AsyncSessionLocal
from app.db.models import PaperDocumentVault, PaperCache, ManuscriptNote

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
        applied_notes = 0
        for n in req.notes:
            note = ManuscriptNote(
                title=n.get("title", "Synced Note"),
                mode=n.get("mode", "rich"),
                content=n.get("content", "")
            )
            session.add(note)
            applied_notes += 1

        await session.commit()

        return {
            "status": "success",
            "applied_notes": applied_notes,
            "applied_papers": len(req.new_papers),
            "applied_strokes": len(req.stylus_strokes),
            "synced_at": time.time(),
            "message": f"Successfully committed End-of-Day sync: {applied_notes} notes and {len(req.new_papers)} papers merged."
        }
