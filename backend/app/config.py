from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")


class Settings:
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "sqlite:///./neon_ai.db"
    )
    SECRET_KEY: str = os.getenv("SECRET_KEY", "dev-insecure-secret-key-change-me")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(
        os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440")
    )
    ALGORITHM: str = "HS256"

    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", "")
    MODEL: str = os.getenv("MODEL", "gemini-3.5-flash")

    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
    EMBEDDING_DIM: int = int(os.getenv("EMBEDDING_DIM", "384"))
    CHROMA_DIR: str = os.getenv("CHROMA_DIR", "./chroma_data")
    CHROMA_COLLECTION: str = "neon_chunks"

    MAX_FILE_SIZE_MB: int = 20
    MAX_FILE_BYTES: int = 20 * 1024 * 1024
    ALLOWED_EXTENSIONS: set[str] = {".pdf"}

    CHUNK_SIZE: int = 1200
    CHUNK_OVERLAP: int = 200
    RAG_TOP_K: int = 4

    @property
    def is_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")


settings = Settings()
