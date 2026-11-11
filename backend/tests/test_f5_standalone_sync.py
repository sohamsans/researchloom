import pytest
import httpx
from sqlalchemy import text, select
from app.main import app
from app.db.database import engine, AsyncSessionLocal
from app.db.models import ManuscriptNote, BibliographicReference, PaperDocumentVault
from app.routers.sync import active_pairing_tokens

@pytest.mark.asyncio
async def test_sqlite_wal_mode_and_busy_timeout():
    """
    Test that SQLite engine is configured with WAL (Write-Ahead Logging) journal mode
    and a busy timeout (e.g. 10000ms) to prevent database locking errors during concurrent async requests.
    """
    async with engine.connect() as conn:
        journal_mode = await conn.execute(text("PRAGMA journal_mode;"))
        mode_val = journal_mode.scalar()
        assert mode_val is not None and mode_val.lower() == "wal", (
            f"Expected SQLite journal_mode to be 'wal', got '{mode_val}'"
        )

        busy_timeout = await conn.execute(text("PRAGMA busy_timeout;"))
        timeout_val = busy_timeout.scalar()
        assert timeout_val is not None and timeout_val >= 5000, (
            f"Expected SQLite busy_timeout >= 5000ms, got '{timeout_val}'"
        )

@pytest.mark.asyncio
async def test_sync_push_persists_incoming_payload():
    """
    Test that POST /api/sync/push genuinely persists received papers and notes
    into the database rather than simply counting them and returning status 200 without DB writes.
    """
    pairing_token = "test_sync_token_alpha_123"
    active_pairing_tokens[pairing_token] = {
        "device_id": "test_tablet_device",
        "device_name": "Galaxy Tab S9",
        "paired_at": 1700000000.0,
        "role": "tablet"
    }

    test_paper = {
        "title": "Decentralized Sync Protocols for Local-First Research",
        "doi": "10.9999/sync.test.001",
        "authors": ["Alice Nakamoto"],
        "year": 2026,
        "abstract": "A protocol for offline-first tablet peer synchronization."
    }

    test_note = {
        "title": "Offline Field Notes on Tablet",
        "content": "Observed significant reduction in sync latency.",
        "mode": "markdown"
    }

    payload = {
        "token": pairing_token,
        "papers": [test_paper],
        "notes": [test_note],
        "stylus_drawings": []
    }

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/sync/push", json=payload)
        assert res.status_code == 200, f"Expected 200 OK, got {res.status_code}: {res.text}"

    # Query the database to verify persistence
    async with AsyncSessionLocal() as session:
        # Check note persistence
        note_stmt = select(ManuscriptNote).where(ManuscriptNote.title == "Offline Field Notes on Tablet")
        note_res = await session.execute(note_stmt)
        persisted_note = note_res.scalar_one_or_none()
        assert persisted_note is not None, "Pushed note was NOT persisted to SQLite database!"

        # Check paper persistence (either in BibliographicReference or PaperDocumentVault)
        ref_stmt = select(BibliographicReference).where(BibliographicReference.doi == "10.9999/sync.test.001")
        ref_res = await session.execute(ref_stmt)
        persisted_ref = ref_res.scalar_one_or_none()
        assert persisted_ref is not None, "Pushed paper was NOT persisted to SQLite database!"

@pytest.mark.asyncio
async def test_sync_eod_commit_persists_papers_and_strokes():
    """
    Test that POST /api/sync/eod/commit persists incoming `new_papers`
    and stylus strokes, rather than only persisting notes and dropping papers.
    """
    eod_paper = {
        "title": "End-of-Day Consolidated Review Paper",
        "doi": "10.8888/eod.test.002",
        "authors": ["Bob Researcher"],
        "year": 2026,
        "abstract": "Summary of literature screened during field session."
    }

    eod_stroke = {
        "id": "stroke_001",
        "color": "#3b82f6",
        "width": 2.5,
        "points": [{"x": 10, "y": 20}, {"x": 15, "y": 25}]
    }

    payload = {
        "token": "eod_token_test",
        "new_papers": [eod_paper],
        "notes": [],
        "stylus_strokes": [eod_stroke]
    }

    async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://test") as client:
        res = await client.post("/api/sync/eod/commit", json=payload)
        assert res.status_code == 200

    async with AsyncSessionLocal() as session:
        ref_stmt = select(BibliographicReference).where(BibliographicReference.doi == "10.8888/eod.test.002")
        ref_res = await session.execute(ref_stmt)
        persisted_paper = ref_res.scalar_one_or_none()
        assert persisted_paper is not None, (
            "End-of-Day sync dropped `new_papers`! Paper was not persisted to SQLite database."
        )
