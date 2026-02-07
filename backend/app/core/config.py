from pydantic_settings import BaseSettings
from functools import lru_cache
from supabase import create_client, Client


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_key: str = ""
    openai_api_key: str = ""

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()


def get_supabase_client() -> Client:
    settings = get_settings()
    if not settings.supabase_url or not settings.supabase_key:
        raise ValueError(
            "SUPABASE_URL and SUPABASE_KEY must be set in the .env file"
        )
    return create_client(settings.supabase_url, settings.supabase_key)
