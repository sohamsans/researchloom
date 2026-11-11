import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query
from app.models.schemas import SnowballResponse
from app.services.snowball_service import perform_citation_snowballing

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/snowball", tags=["Citation Snowballing"])

@router.get("/backward/{paper_id:path}", response_model=SnowballResponse)
async def get_backward_snowballing(
    paper_id: str,
    max_results: int = Query(default=25, ge=5, le=100, description="Max predecessor papers to retrieve"),
    title: Optional[str] = Query(default=None, description="Optional title fallback for seed matching")
):
    """Retrieve foundational antecedents (works cited by the seed paper) via OpenAlex polite pool."""
    try:
        res = await perform_citation_snowballing(paper_id, direction="backward", max_results=max_results, title=title)
        return res
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error in backward snowballing: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to execute backward snowballing: {str(e)}")

@router.get("/forward/{paper_id:path}", response_model=SnowballResponse)
async def get_forward_snowballing(
    paper_id: str,
    max_results: int = Query(default=25, ge=5, le=100, description="Max successor papers to retrieve"),
    title: Optional[str] = Query(default=None, description="Optional title fallback for seed matching")
):
    """Retrieve emerging successors (works that cite the seed paper) via OpenAlex polite pool."""
    try:
        res = await perform_citation_snowballing(paper_id, direction="forward", max_results=max_results, title=title)
        return res
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"Error in forward snowballing: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to execute forward snowballing: {str(e)}")
