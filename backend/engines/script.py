"""Script (python/pyspark) engine stub (PROJECT_SPEC §6).

Covers both ``python_script`` and ``pyspark_script`` engine types.
"""
from __future__ import annotations

from db.enums import PipelineEngine
from engines.base import BaseEngine, RunResult


class ScriptEngine(BaseEngine):
    def __init__(self, engine_type: PipelineEngine = PipelineEngine.python_script) -> None:
        self.engine_type = engine_type

    def trigger(self, pipeline) -> RunResult:
        return self._mock_success(pipeline)
