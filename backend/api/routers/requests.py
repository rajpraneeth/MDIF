"""Ingestion-request routes + status machine (PROJECT_SPEC §5 Requests, §8 flow).

State machine: draft → submitted → under_review → approved / rejected →
in_progress → completed. This phase owns the human-driven transitions
(submit / approve / reject); in_progress/completed are driven by the pipeline
run flow in later phases.

RBAC:
- Any authenticated user creates & owns their own requests.
- Listing/visibility: a requester sees only their own; DE+ (data_engineer,
  architect, manager, admin) see all.
- approve / reject: architect+ (architect, manager, admin).
"""
from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.dependencies import get_current_user
from db.base import get_db
from db.crud.request import crud_request
from db.enums import RequestStatus, UserRole
from db.models.ingestion_request import IngestionRequest
from db.models.user import User
from schemas.common import Envelope, Page
from schemas.request import (
    RejectRequest,
    RequestCreate,
    RequestRead,
    RequestUpdate,
)

router = APIRouter(prefix="/requests", tags=["requests"])

# Roles that see every request (vs a requester, who sees only their own).
_DE_PLUS = {
    UserRole.data_engineer,
    UserRole.architect,
    UserRole.manager,
    UserRole.admin,
}
# Roles that may approve/reject.
_APPROVERS = {UserRole.architect, UserRole.manager, UserRole.admin}

# Source states from which approve/reject are legal.
_DECIDABLE = {RequestStatus.submitted, RequestStatus.under_review}


def _serialize(req: IngestionRequest) -> RequestRead:
    return RequestRead.model_validate(req)


def _can_view(user: User, req: IngestionRequest) -> bool:
    return user.role in _DE_PLUS or req.requested_by == user.id


async def _get_viewable_or_404(
    db: AsyncSession, req_id: uuid.UUID, user: User
) -> IngestionRequest:
    req = await crud_request.get(db, req_id)
    if req is None or not _can_view(user, req):
        # 404 (not 403) so a requester can't probe others' request ids.
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    return req


@router.get("", response_model=Envelope[Page[RequestRead]])
async def list_requests(
    status_filter: RequestStatus | None = Query(default=None, alias="status"),
    env_id: uuid.UUID | None = Query(default=None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Envelope[Page[RequestRead]]:
    # Requesters are scoped to their own rows; DE+ see all.
    owner = None if current_user.role in _DE_PLUS else current_user.id
    items, total = await crud_request.list_filtered(
        db,
        page=page,
        page_size=page_size,
        requested_by=owner,
        status=status_filter,
        env_id=env_id,
    )
    return Envelope(
        data=Page(
            items=[_serialize(r) for r in items],
            total=total,
            page=page,
            page_size=page_size,
        ),
        message="",
    )


@router.post("", response_model=Envelope[RequestRead], status_code=status.HTTP_201_CREATED)
async def create_request(
    body: RequestCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Envelope[RequestRead]:
    data = body.model_dump(mode="json")
    data["requested_by"] = current_user.id
    data["status"] = RequestStatus.draft
    req = await crud_request.create(db, data)
    await db.commit()
    return Envelope(data=_serialize(req), message="Request created")


@router.get("/{request_id}", response_model=Envelope[RequestRead])
async def get_request(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Envelope[RequestRead]:
    req = await _get_viewable_or_404(db, request_id, current_user)
    return Envelope(data=_serialize(req), message="")


@router.patch("/{request_id}", response_model=Envelope[RequestRead])
async def update_request(
    request_id: uuid.UUID,
    body: RequestUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Envelope[RequestRead]:
    req = await _get_viewable_or_404(db, request_id, current_user)
    # Only the owner (or a DE+) may edit, and only while still a draft.
    if req.requested_by != current_user.id and current_user.role not in _DE_PLUS:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted")
    if req.status != RequestStatus.draft:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Only draft requests can be edited",
        )
    req = await crud_request.update(db, req, body.model_dump(mode="json", exclude_unset=True))
    await db.commit()
    return Envelope(data=_serialize(req), message="Request updated")


@router.delete("/{request_id}", response_model=Envelope[None])
async def delete_request(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Envelope[None]:
    req = await _get_viewable_or_404(db, request_id, current_user)
    if req.requested_by != current_user.id and current_user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted")
    await crud_request.soft_delete(db, req)
    await db.commit()
    return Envelope(data=None, message="Request deleted")


@router.post("/{request_id}/submit", response_model=Envelope[RequestRead])
async def submit_request(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Envelope[RequestRead]:
    req = await _get_viewable_or_404(db, request_id, current_user)
    if req.requested_by != current_user.id and current_user.role not in _DE_PLUS:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not permitted")
    if req.status != RequestStatus.draft:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot submit a request in status '{req.status.value}'",
        )
    if not req.source_objects:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="A request needs at least one source object before submitting",
        )
    req = await crud_request.update(db, req, {"status": RequestStatus.submitted})
    await db.commit()
    return Envelope(data=_serialize(req), message="Request submitted")


@router.post("/{request_id}/approve", response_model=Envelope[RequestRead])
async def approve_request(
    request_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Envelope[RequestRead]:
    if current_user.role not in _APPROVERS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only architect and above can approve requests",
        )
    req = await crud_request.get(db, request_id)
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if req.status not in _DECIDABLE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot approve a request in status '{req.status.value}'",
        )
    req = await crud_request.update(
        db,
        req,
        {
            "status": RequestStatus.approved,
            "approved_by": current_user.id,
            "approved_at": datetime.now(timezone.utc),
            "rejection_reason": None,
        },
    )
    await db.commit()
    return Envelope(data=_serialize(req), message="Request approved")


@router.post("/{request_id}/reject", response_model=Envelope[RequestRead])
async def reject_request(
    request_id: uuid.UUID,
    body: RejectRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> Envelope[RequestRead]:
    if current_user.role not in _APPROVERS:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only architect and above can reject requests",
        )
    req = await crud_request.get(db, request_id)
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    if req.status not in _DECIDABLE:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot reject a request in status '{req.status.value}'",
        )
    req = await crud_request.update(
        db,
        req,
        {"status": RequestStatus.rejected, "rejection_reason": body.reason},
    )
    await db.commit()
    return Envelope(data=_serialize(req), message="Request rejected")
