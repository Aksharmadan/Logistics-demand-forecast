from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./local.db"
    secret_key: str = "dev-secret-change-in-production"
    access_token_expire_minutes: int = 60 * 24 * 7
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"
    artifacts_dir: str = "artifacts"
    model_filename: str = "demand_model.joblib"
    metrics_filename: str = "training_metrics.json"


@lru_cache
def get_settings() -> Settings:
    return Settings()
