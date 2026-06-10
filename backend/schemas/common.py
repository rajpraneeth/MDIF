"""Shared response envelope and pagination schemas (PRD decision 4).

Every endpoint returns ``{ success, data, message }``. List endpoints set
``data`` to a :class:`Page` — ``{ items, total, page, page_size }``.
"""
from __future__ import annotations

from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Envelope(BaseModel, Generic[T]):
    """Uniform success envelope wrapping a typed ``data`` payload."""

    success: bool = True
    data: T | None = None
    message: str = ""


class Page(BaseModel, Generic[T]):
    """Paginated list payload carried inside :class:`Envelope.data`."""

    items: list[T]
    total: int
    page: int
    page_size: int
