"""App settings, read from environment variables or a local .env file."""
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Local default: SQLite file next to the backend folder.
    # On Azure this is set to the Azure SQL connection string.
    database_url: str = "sqlite:///./inventory.db"


settings = Settings()
