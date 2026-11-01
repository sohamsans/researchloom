from typing import List, Dict
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import ScreeningAuditLog
from app.models.schemas import (
    ScreeningDecisionRequest,
    ScreeningAuditItemResponse,
    PRISMAStatsResponse
)

router = APIRouter(prefix="/api/screening", tags=["PRISMA Screening"])

@router.post("/decision", response_model=ScreeningAuditItemResponse)
async def log_screening_decision(req: ScreeningDecisionRequest, db: AsyncSession = Depends(get_db)):
    """Log an immutable screening decision with reviewer ID, timestamp, and exclusion reason."""
    audit_entry = ScreeningAuditLog(
        workspace_id=req.workspace_id,
        paper_id=req.paper_id,
        paper_title=req.paper_title,
        paper_doi=req.paper_doi,
        action=req.action.lower(),
        exclusion_reason=req.exclusion_reason,
        stage=req.stage.lower(),
        reviewer_id=req.reviewer_id,
        notes=req.notes
    )
    db.add(audit_entry)
    await db.commit()
    await db.refresh(audit_entry)

    return ScreeningAuditItemResponse(
        id=audit_entry.id,
        workspace_id=audit_entry.workspace_id,
        paper_id=audit_entry.paper_id,
        paper_title=audit_entry.paper_title,
        paper_doi=audit_entry.paper_doi,
        action=audit_entry.action,
        exclusion_reason=audit_entry.exclusion_reason,
        stage=audit_entry.stage,
        reviewer_id=audit_entry.reviewer_id,
        notes=audit_entry.notes,
        created_at=audit_entry.created_at.isoformat() if audit_entry.created_at else ""
    )

@router.get("/prisma-flow/{workspace_id}", response_model=PRISMAStatsResponse)
async def get_prisma_flow_stats(workspace_id: str = "default_workspace", db: AsyncSession = Depends(get_db)):
    """Compute mathematical PRISMA 2020 stage metrics directly from the immutable audit log."""
    stmt = select(ScreeningAuditLog).where(ScreeningAuditLog.workspace_id == workspace_id).order_by(desc(ScreeningAuditLog.created_at))
    res = await db.execute(stmt)
    records = res.scalars().all()

    screen_excluded_reasons: Dict[str, int] = {}
    eligibility_excluded_reasons: Dict[str, int] = {}

    screen_excluded = 0
    eligibility_excluded = 0
    total_included = 0
    duplicates_removed = 0

    seen_papers = set()
    for r in records:
        seen_papers.add(r.paper_id)
        if r.action == "excluded":
            reason = r.exclusion_reason or "Unspecified Reason"
            if reason.lower() == "duplicate":
                duplicates_removed += 1
            elif r.stage == "eligibility":
                eligibility_excluded += 1
                eligibility_excluded_reasons[reason] = eligibility_excluded_reasons.get(reason, 0) + 1
            else:
                screen_excluded += 1
                screen_excluded_reasons[reason] = screen_excluded_reasons.get(reason, 0) + 1
        elif r.action == "included":
            total_included += 1

    total_screened = screen_excluded + eligibility_excluded + total_included
    total_identified = total_screened + duplicates_removed
    eligibility_assessed = eligibility_excluded + total_included

    recent_audit = [
        ScreeningAuditItemResponse(
            id=r.id,
            workspace_id=r.workspace_id,
            paper_id=r.paper_id,
            paper_title=r.paper_title,
            paper_doi=r.paper_doi,
            action=r.action,
            exclusion_reason=r.exclusion_reason,
            stage=r.stage,
            reviewer_id=r.reviewer_id,
            notes=r.notes,
            created_at=r.created_at.isoformat() if r.created_at else ""
        )
        for r in records[:50]
    ]

    return PRISMAStatsResponse(
        total_identified=total_identified,
        duplicates_removed=duplicates_removed,
        total_screened=total_screened,
        screen_excluded=screen_excluded,
        screen_excluded_by_reason=screen_excluded_reasons,
        eligibility_assessed=eligibility_assessed,
        eligibility_excluded=eligibility_excluded,
        eligibility_excluded_by_reason=eligibility_excluded_reasons,
        total_included=total_included,
        recent_audit_log=recent_audit
    )
