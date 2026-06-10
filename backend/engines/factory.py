"""Engine factory (PROJECT_SPEC §6): map a ``PipelineEngine`` to its adapter."""
from __future__ import annotations

from db.enums import PipelineEngine
from engines.adf import ADFEngine
from engines.base import BaseEngine
from engines.databricks import DatabricksEngine
from engines.script import ScriptEngine


class EngineFactory:
    @staticmethod
    def create(engine: PipelineEngine) -> BaseEngine:
        if engine is PipelineEngine.adf:
            return ADFEngine()
        if engine is PipelineEngine.databricks:
            return DatabricksEngine()
        if engine in (PipelineEngine.python_script, PipelineEngine.pyspark_script):
            return ScriptEngine(engine)
        raise ValueError(f"Unsupported engine: {engine}")
