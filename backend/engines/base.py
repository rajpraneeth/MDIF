"""Engine adapter base contract (PROJECT_SPEC §6).

``BaseEngine`` is a pure (DB-free) adapter: ``trigger`` computes a :class:`RunResult`
from a pipeline; the API/service layer persists it as a ``PipelineRun``. v1 stubs
complete immediately as ``succeeded`` with mock metrics (PRD decision 3).

``LogEntry`` fixes the log shape (gap #3) so every adapter — and the frontend log
viewer — sees a consistent structure from day one.
"""
from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from db.enums import PipelineEngine, RunStatus

logger = logging.getLogger("mdif.engines")


def LogEntry(level: str, message: str) -> dict[str, Any]:
    """Build one structured log line (§6 ``LogEntry``)."""
    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "message": message,
    }


@dataclass
class RunResult:
    """Outcome of a trigger, persisted as a ``PipelineRun`` by the caller."""

    status: RunStatus
    started_at: datetime
    ended_at: datetime
    duration_seconds: int
    rows_processed: int | None = None
    bytes_processed: int | None = None
    error_message: str | None = None
    logs: list[dict[str, Any]] = field(default_factory=list)
    run_metadata: dict[str, Any] = field(default_factory=dict)


class BaseEngine(ABC):
    """Abstract engine adapter (§6)."""

    engine_type: PipelineEngine

    @abstractmethod
    def trigger(self, pipeline) -> RunResult:
        """Start a run for ``pipeline`` and return its (stub) result."""

    def get_status(self, run) -> RunStatus:
        """Echo the stored run status (PRD decision 3: stubs don't poll)."""
        return run.status

    def _mock_success(self, pipeline) -> RunResult:
        """Shared stub: log the call and complete immediately with mock metrics."""
        logger.info(
            "[%s stub] trigger pipeline id=%s name=%s",
            self.engine_type.value,
            getattr(pipeline, "id", "?"),
            getattr(pipeline, "name", "?"),
        )
        now = datetime.now(timezone.utc)
        return RunResult(
            status=RunStatus.succeeded,
            started_at=now,
            ended_at=now,
            duration_seconds=0,
            rows_processed=1000,
            bytes_processed=524288,
            logs=[
                LogEntry("INFO", f"{self.engine_type.value} stub: run started"),
                LogEntry("INFO", "processed 1000 rows (524288 bytes)"),
                LogEntry("INFO", "run completed: succeeded"),
            ],
            run_metadata={"stub": True, "engine": self.engine_type.value},
        )
