from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.ai import AIProvider, get_provider
from app.database import get_db
from app.deps import get_current_user
from app.models import Chat, Chunk, Document, User
from app.rag.pipeline import retrieve_context
from app.schemas import ChatRequest, ChatResponse, ChatSessionOut

router = APIRouter(prefix="/api", tags=["chat"])

SYSTEM_PROMPT = (
    "You are Neon-AI, a smart study companion. Answer clearly and concisely. "
    "When the user provides document context, answer ONLY from that context and "
    "say when the answer is not found in the documents. Be encouraging to learners. "
    "Teach step by step from beginner to advanced when the user asks. "
    "IMPORTANT FORMATTING RULES: write in plain text only. Never use markdown, "
    "headings, ###, ##, asterisks, backticks, or double quotation marks. Use plain "
    "numbered lists such as 1. 2. 3. for steps."
)


@router.post("/chat", response_model=ChatResponse)
def chat(
    payload: ChatRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    provider: AIProvider = Depends(get_provider),
):
    # 1. Retrieve the user's own document context (RAG)
    context = retrieve_context(db, payload.question, user.id)

    # 2. Personalize with the recent history for this session
    recent = db.scalars(
        select(Chat)
        .where(
            Chat.user_id == user.id,
            Chat.session_id == payload.session_id,
        )
        .order_by(Chat.created_at.desc())
        .limit(6)
    ).all()
    recent = list(reversed(recent))

    history = "\n".join(
        f"User: {c.question}\nAssistant: {c.answer}" for c in recent
    )

    context_block = ""
    if context:
        parts = "\n".join(f"- {content}" for _, content, _ in context)
        context_block = (
            "\n\nDOCUMENT CONTEXT (from the user's own uploaded files):\n"
            f"{parts}"
        )

    prompt = (
        f"USER HISTORY:\n{history or '(no history yet)'}\n\n"
        f"USER QUESTION:\n{payload.question}"
        f"{context_block}"
    )

    answer = provider.generate_text(prompt, system_prompt=SYSTEM_PROMPT)

    # 3. Persist chat
    chat = Chat(
        user_id=user.id,
        session_id=payload.session_id,
        question=payload.question,
        answer=answer,
    )
    db.add(chat)
    db.commit()

    sources = [file_name for file_name in _source_names(db, user.id, context)]
    return ChatResponse(
        answer=answer, sources=sources, session_id=payload.session_id
    )


@router.get("/chat/sessions", response_model=list[ChatSessionOut])
def chat_sessions(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = db.execute(
        select(
            Chat.session_id,
            func.min(Chat.question).label("title"),
            func.count(Chat.id).label("message_count"),
            func.max(Chat.created_at).label("updated_at"),
        )
        .where(Chat.user_id == user.id)
        .group_by(Chat.session_id)
        .order_by(func.max(Chat.created_at).desc())
    ).all()
    return [
        ChatSessionOut(
            session_id=r.session_id,
            title=(r.title or "New chat")[:60],
            message_count=r.message_count,
            updated_at=r.updated_at,
        )
        for r in rows
    ]


@router.get("/chat/history", response_model=list[dict])
def chat_history(
    session_id: str = "default",
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = db.scalars(
        select(Chat)
        .where(
            Chat.user_id == user.id,
            Chat.session_id == session_id,
        )
        .order_by(Chat.created_at.desc())
        .limit(50)
    ).all()
    return [
        {
            "id": c.id,
            "question": c.question,
            "answer": c.answer,
            "created_at": c.created_at.isoformat(),
        }
        for c in reversed(rows)
    ]


def _source_names(db: Session, user_id: int, context: list[tuple[int, str, float]]):
    if not context:
        return []
    doc_ids = {
        chunk.document_id
        for chunk in db.scalars(
            select(Chunk).where(Chunk.id.in_([c[0] for c in context]))
        )
    }
    docs = db.scalars(
        select(Document).where(Document.id.in_(doc_ids), Document.user_id == user_id)
    ).all()
    return [d.file_name for d in docs]
