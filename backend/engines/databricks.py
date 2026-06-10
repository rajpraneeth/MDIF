"""Databricks engine stub (PROJECT_SPEC §6)."""
from __future__ import annotations

from db.enums import PipelineEngine
from engines.base import BaseEngine, RunResult


class DatabricksEngine(BaseEngine):
    engine_type = PipelineEngine.databricks

    def trigger(self, pipeline) -> RunResult:
        return self._mock_success(pipeline)
