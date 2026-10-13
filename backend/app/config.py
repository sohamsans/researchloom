from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache

class Settings(BaseSettings):
    groq_api_key: str = ""
    gemini_api_key: str = ""
    academic_contact_email: str = "autolit@research.local"
    
    # Lightweight, high-speed, 100% free cloud models
    groq_model: str = "llama-3.3-70b-versatile"
    gemini_model: str = "gemini-3.8-flash"
    
    # Defaults for pipeline
    default_max_results: int = 20
    default_relevance_threshold: int = 4
    max_top_papers: int = 8
    max_pdf_bytes: int = 25 * 1024 * 1024 # 25 MB
    max_pdf_chars: int = 12000

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore"
    )

@lru_cache()
def get_settings() -> Settings:
    return Settings()
