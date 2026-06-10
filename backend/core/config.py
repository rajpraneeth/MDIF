"""Application configuration loaded from environment variables (PROJECT_SPEC §13)."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # Shared / environment scoping
    ENVIRONMENT_ID: str = ""
    ENVIRONMENT_NAME: str = "dev"

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://mdif:mdif@localhost:5432/mdif"

    # Auth / JWT
    JWT_SECRET: str = "change-me-minimum-32-chars-please-override"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # CORS
    CORS_ORIGINS: str = "http://localhost:5173"

    # Optional cloud engine credentials (real adapters wired in later phases)
    AZURE_TENANT_ID: str = ""
    AZURE_CLIENT_ID: str = ""
    AZURE_CLIENT_SECRET: str = ""
    DATABRICKS_TOKEN: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
