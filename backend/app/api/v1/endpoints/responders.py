"""
Responders CRUD endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List
from uuid import UUID

from app.core.database import get_db
from app.db.models.models import Responder
from app.schemas.responder import ResponderCreate, ResponderResponse

router = APIRouter()


@router.get("/", response_model=List[ResponderResponse], summary="List all responders")
async def list_responders(
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
):
    query = select(Responder)
    if active_only:
        query = query.where(Responder.is_active == True)
    result = await db.execute(query.order_by(Responder.name))
    return result.scalars().all()


@router.get("/{responder_id}", response_model=ResponderResponse, summary="Get responder by ID")
async def get_responder(responder_id: UUID, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Responder).where(Responder.id == responder_id))
    responder = result.scalar_one_or_none()
    if not responder:
        raise HTTPException(status_code=404, detail="Responder not found")
    return responder


@router.post("/", response_model=ResponderResponse, status_code=status.HTTP_201_CREATED)
async def create_responder(payload: ResponderCreate, db: AsyncSession = Depends(get_db)):
    responder = Responder(**payload.model_dump())
    db.add(responder)
    await db.commit()
    await db.refresh(responder)
    return responder


@router.get("/badge/{badge_id}", response_model=ResponderResponse)
async def get_by_badge(badge_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Responder).where(Responder.badge_id == badge_id))
    responder = result.scalar_one_or_none()
    if not responder:
        raise HTTPException(status_code=404, detail="Responder not found")
    return responder
