import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.database import Base, engine
from app.routers import auth, chat, course, dashboard, quiz, upload

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Neon-AI – Smart Study Companion",
    version="1.0.0",
    description="Multi-user AI study platform: chat, PDF RAG, and quiz generation.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten for production, see docs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    _run_additive_migrations()
    logger.info("Database tables ready.")


def _run_additive_migrations() -> None:
    """Add new columns to tables created by older schema versions (SQLite dev)."""
    if not engine.url.drivername.startswith("sqlite"):
        return
    with engine.begin() as conn:
        _ensure_column(conn, "chats", "session_id", "VARCHAR(64) DEFAULT 'default'")
        _ensure_column(conn, "quizzes", "score", "INTEGER")
        _ensure_column(conn, "quizzes", "total_questions", "INTEGER")


def _ensure_column(conn, table: str, column: str, ddl: str) -> None:
    existing = {row[1] for row in conn.execute(text(f"PRAGMA table_info({table})"))}
    if column not in existing:
        conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))
        logger.info("Added column %s.%s", table, column)


@app.get("/api/health")
def health():
    return {"status": "ok", "app": "neon-ai"}


app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(upload.router)
app.include_router(quiz.router)
app.include_router(dashboard.router)
app.include_router(course.router)
