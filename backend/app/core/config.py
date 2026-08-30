from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "PackMetrix API"
    api_prefix: str = "/api/v1"
    database_url: str = "sqlite:///./packmetrix.db"
    cors_origins: list[str] = ["http://127.0.0.1:5173", "http://localhost:5173"]
    auth_secret: str = "local-development-change-this-secret"
    access_token_minutes: int = 480

    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="PACKMETRIX_",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    return Settings()
