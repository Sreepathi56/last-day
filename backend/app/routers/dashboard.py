from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import get_current_user
from app.models import Chat, Chunk, Document, Quiz, User
from app.schemas import DashboardStats

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard", response_model=DashboardStats)
def dashboard(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    chat_count = db.scalar(
        select(func.count(Chat.id)).where(Chat.user_id == user.id)
    ) or 0
    document_count = db.scalar(
        select(func.count(Document.id)).where(Document.user_id == user.id)
    ) or 0
    quiz_count = db.scalar(
        select(func.count(Quiz.id)).where(Quiz.user_id == user.id)
    ) or 0
    total_chunks = db.scalar(
        select(func.count(Chunk.id)).where(Chunk.user_id == user.id)
    ) or 0

    recent_chats = list(
        db.scalars(
            select(Chat)
            .where(Chat.user_id == user.id)
            .order_by(Chat.created_at.desc())
            .limit(5)
        )
    )
    recent_documents = list(
        db.scalars(
            select(Document)
            .where(Document.user_id == user.id)
            .order_by(Document.uploaded_at.desc())
            .limit(5)
        )
    )
    recent_quizzes = list(
        db.scalars(
            select(Quiz)
            .where(Quiz.user_id == user.id)
            .order_by(Quiz.created_at.desc())
            .limit(5)
        )
    )

    return DashboardStats(
        chat_count=chat_count,
        document_count=document_count,
        quiz_count=quiz_count,
        total_chunks=total_chunks,
        recent_chats=[
            {"id": c.id, "question": c.question, "answer": c.answer, "created_at": c.created_at.isoformat()}
            for c in recent_chats
        ],
        recent_documents=[
            {"id": d.id, "file_name": d.file_name, "uploaded_at": d.uploaded_at.isoformat()}
            for d in recent_documents
        ],
        recent_quizzes=[
            {"id": q.id, "topic": q.topic, "created_at": q.created_at.isoformat()}
            for q in recent_quizzes
        ],
    )
