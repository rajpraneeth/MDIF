"""Engine adapters (PROJECT_SPEC §6).

v1 ships stubs only: ``BaseEngine`` ABC + ADF / Databricks / Script adapters that
log the call and return a mock ``RunResult`` (PRD decision 3), wired through
``EngineFactory``. Real engine connectivity is a v2 item.
"""
from engines.base import BaseEngine, LogEntry, RunResult
from engines.factory import EngineFactory

__all__ = ["BaseEngine", "LogEntry", "RunResult", "EngineFactory"]
