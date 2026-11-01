import json
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.database import get_db
from app.db.models import MatrixColumnDefinition, MatrixCell, PaperDocumentVault, PaperCache
from app.models.schemas import (
    MatrixColumnCreateRequest,
    MatrixColumnResponse,
    MatrixCellExtractRequest,
    MatrixCellUpdateRequest,
    MatrixCellResponse,
    MatrixFullDataResponse
)
from app.services.llm_provider import UniversalLLMClient
from app.services.matrix_service import extract_matrix_cell_value

router = APIRouter(prefix="/matrix", tags=["Evidence Matrix"])

@router.get("/workspace/{workspace_id}", response_model=MatrixFullDataResponse)
async def get_workspace_matrix(workspace_id: str = "default_workspace", db: AsyncSession = Depends(get_db)):
    """Fetch all custom column definitions and extracted matrix cells for a workspace."""
    # 1. Fetch columns
    cols_stmt = select(MatrixColumnDefinition).where(MatrixColumnDefinition.workspace_id == workspace_id).order_by(MatrixColumnDefinition.created_at.asc())
    cols_res = await db.execute(cols_stmt)
    db_cols = cols_res.scalars().all()

    # 2. Fetch cells
    cells_stmt = select(MatrixCell).where(MatrixCell.workspace_id == workspace_id)
    cells_res = await db.execute(cells_stmt)
    db_cells = cells_res.scalars().all()

    cols_out = [
        MatrixColumnResponse(
            id=c.id,
            workspace_id=c.workspace_id,
            column_name=c.column_name,
            prompt=c.prompt,
            data_type=c.data_type or "string",
            created_at=c.created_at.isoformat() if c.created_at else ""
        )
        for c in db_cols
    ]

    cells_out = [
        MatrixCellResponse(
            id=cell.id,
            workspace_id=cell.workspace_id,
            paper_id=cell.paper_id,
            column_id=cell.column_id,
            value=cell.value,
            status=cell.status,
            confidence=cell.confidence,
            source_sentence=cell.source_sentence,
            source_page=cell.source_page,
            bounding_box=json.loads(cell.bounding_box_json) if cell.bounding_box_json else None,
            is_human_edited=cell.is_human_edited,
            updated_at=cell.updated_at.isoformat() if cell.updated_at else ""
        )
        for cell in db_cells
    ]

    return MatrixFullDataResponse(columns=cols_out, cells=cells_out)

@router.post("/columns", response_model=MatrixColumnResponse)
async def create_matrix_column(req: MatrixColumnCreateRequest, db: AsyncSession = Depends(get_db)):
    """Create a new custom matrix column defined by a natural language extraction prompt."""
    col = MatrixColumnDefinition(
        workspace_id=req.workspace_id,
        column_name=req.column_name.strip(),
        prompt=req.prompt.strip(),
        data_type=req.data_type
    )
    db.add(col)
    await db.commit()
    await db.refresh(col)

    return MatrixColumnResponse(
        id=col.id,
        workspace_id=col.workspace_id,
        column_name=col.column_name,
        prompt=col.prompt,
        data_type=col.data_type,
        created_at=col.created_at.isoformat() if col.created_at else ""
    )

@router.delete("/columns/{column_id}")
async def delete_matrix_column(column_id: str, db: AsyncSession = Depends(get_db)):
    """Delete a column definition and its associated matrix cells."""
    col_stmt = select(MatrixColumnDefinition).where(MatrixColumnDefinition.id == column_id)
    res = await db.execute(col_stmt)
    col = res.scalar_one_or_none()
    if not col:
        raise HTTPException(status_code=404, detail="Column not found")

    await db.delete(col)
    # Delete associated cells
    del_cells_stmt = delete(MatrixCell).where(MatrixCell.column_id == column_id)
    await db.execute(del_cells_stmt)
    await db.commit()

    return {"status": "deleted", "id": column_id}

@router.post("/extract-cell", response_model=MatrixCellResponse)
async def extract_matrix_cell(req: MatrixCellExtractRequest, db: AsyncSession = Depends(get_db)):
    """Extract a single matrix cell using LLM on the paper's local PDF full-text or cached abstract."""
    # Find local PDF path if paper is vaulted
    pdf_path = None
    abstract = None

    if req.paper_doi:
        v_stmt = select(PaperDocumentVault).where(PaperDocumentVault.doi == req.paper_doi)
        v_res = await db.execute(v_stmt)
        vault_entry = v_res.scalar_one_or_none()
        if vault_entry and vault_entry.file_path:
            pdf_path = vault_entry.file_path

    # Check synthesis cache for abstract
    c_stmt = select(PaperCache).where(PaperCache.title.ilike(f"%{req.paper_title[:40]}%"))
    c_res = await db.execute(c_stmt)
    cache_entry = c_res.scalars().first()
    if cache_entry and cache_entry.abstract:
        abstract = cache_entry.abstract

    llm = UniversalLLMClient(
        provider=req.model_provider,
        model_name=req.model_name,
        groq_key=req.groq_api_key,
        gemini_key=req.gemini_api_key
    )

    extracted = await extract_matrix_cell_value(
        paper_title=req.paper_title,
        paper_doi=req.paper_doi,
        column_name=req.column_name,
        prompt=req.prompt,
        data_type=req.data_type,
        llm=llm,
        pdf_path=pdf_path,
        abstract=abstract
    )

    # Upsert cell in database
    cell_stmt = select(MatrixCell).where(
        MatrixCell.workspace_id == req.workspace_id,
        MatrixCell.paper_id == req.paper_id,
        MatrixCell.column_id == req.column_id
    )
    cell_res = await db.execute(cell_stmt)
    existing_cell = cell_res.scalar_one_or_none()

    bbox_json = json.dumps(extracted.get("bounding_box")) if extracted.get("bounding_box") else None

    if existing_cell:
        existing_cell.value = extracted["value"]
        existing_cell.status = extracted["status"]
        existing_cell.confidence = extracted["confidence"]
        existing_cell.source_sentence = extracted["source_sentence"]
        existing_cell.source_page = extracted["source_page"]
        existing_cell.bounding_box_json = bbox_json
        existing_cell.is_human_edited = False
        target_cell = existing_cell
    else:
        new_cell = MatrixCell(
            workspace_id=req.workspace_id,
            paper_id=req.paper_id,
            column_id=req.column_id,
            value=extracted["value"],
            status=extracted["status"],
            confidence=extracted["confidence"],
            source_sentence=extracted["source_sentence"],
            source_page=extracted["source_page"],
            bounding_box_json=bbox_json,
            is_human_edited=False
        )
        db.add(new_cell)
        target_cell = new_cell

    await db.commit()
    await db.refresh(target_cell)

    return MatrixCellResponse(
        id=target_cell.id,
        workspace_id=target_cell.workspace_id,
        paper_id=target_cell.paper_id,
        column_id=target_cell.column_id,
        value=target_cell.value,
        status=target_cell.status,
        confidence=target_cell.confidence,
        source_sentence=target_cell.source_sentence,
        source_page=target_cell.source_page,
        bounding_box=json.loads(target_cell.bounding_box_json) if target_cell.bounding_box_json else None,
        is_human_edited=target_cell.is_human_edited,
        updated_at=target_cell.updated_at.isoformat() if target_cell.updated_at else ""
    )

@router.put("/cells/{cell_id}", response_model=MatrixCellResponse)
async def update_matrix_cell_manually(cell_id: str, req: MatrixCellUpdateRequest, db: AsyncSession = Depends(get_db)):
    """Human edit / cell override with audit marker."""
    cell_stmt = select(MatrixCell).where(MatrixCell.id == cell_id)
    cell_res = await db.execute(cell_stmt)
    cell = cell_res.scalar_one_or_none()
    if not cell:
        raise HTTPException(status_code=404, detail="Matrix cell not found")

    cell.value = req.value
    if req.status:
        cell.status = req.status
    if req.confidence:
        cell.confidence = req.confidence
    if req.source_sentence is not None:
        cell.source_sentence = req.source_sentence
    if req.source_page is not None:
        cell.source_page = req.source_page
    if req.bounding_box is not None:
        cell.bounding_box_json = json.dumps(req.bounding_box)

    cell.is_human_edited = True
    await db.commit()
    await db.refresh(cell)

    return MatrixCellResponse(
        id=cell.id,
        workspace_id=cell.workspace_id,
        paper_id=cell.paper_id,
        column_id=cell.column_id,
        value=cell.value,
        status=cell.status,
        confidence=cell.confidence,
        source_sentence=cell.source_sentence,
        source_page=cell.source_page,
        bounding_box=json.loads(cell.bounding_box_json) if cell.bounding_box_json else None,
        is_human_edited=cell.is_human_edited,
        updated_at=cell.updated_at.isoformat() if cell.updated_at else ""
    )
