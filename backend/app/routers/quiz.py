import json
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai import AIProvider, get_provider
from app.database import get_db
from app.deps import get_current_user
from app.models import Quiz, User
from app.schemas import QuizOut, QuizRequest, QuizScoreRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["quiz"])

QUIZ_SYSTEM_PROMPT = (
    "You are a quiz generator. Produce only valid JSON, no markdown, no commentary."
)

QUIZ_TEMPLATE = (
    'Generate a quiz about the topic "{topic}" with exactly {num} multiple-choice '
    "questions. Respond as a JSON object with exactly this structure:\n"
    '{{"topic": "<topic>", "questions": ['
    '{{"question": "<the question>", "options": ["a", "b", "c", "d"], '
    '"correct_index": <0-3>, "explanation": "<one sentence>"}}'
    "]}}"
    "\nEach question must have exactly 4 options, correct_index must be the index "
    "of the correct option, and include a short explanation."
)


@router.post("/quiz", response_model=QuizOut, status_code=201)
def create_quiz(
    payload: QuizRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    provider: AIProvider = Depends(get_provider),
):
    data = provider.generate_json(
        QUIZ_TEMPLATE.format(topic=payload.topic, num=payload.num_questions),
        system_prompt=QUIZ_SYSTEM_PROMPT,
    )

    questions = _normalize_questions(data.get("questions", []))
    if not questions:
        raise HTTPException(
            status_code=502,
            detail="AI did not return valid quiz questions. Try again.",
        )

    quiz = Quiz(
        user_id=user.id,
        topic=payload.topic,
        questions_json=questions,
    )
    db.add(quiz)
    db.commit()
    db.refresh(quiz)
    return quiz


@router.get("/quiz/history", response_model=list[QuizOut])
def quiz_history(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return list(
        db.scalars(
            select(Quiz)
            .where(Quiz.user_id == user.id)
            .order_by(Quiz.created_at.desc())
            .limit(20)
        )
    )


@router.post("/quiz/{quiz_id}/submit", response_model=QuizOut)
def submit_quiz_score(
    quiz_id: int,
    payload: QuizScoreRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    quiz = db.scalar(
        select(Quiz).where(Quiz.id == quiz_id, Quiz.user_id == user.id)
    )
    if quiz is None:
        raise HTTPException(status_code=404, detail="Quiz not found.")
    quiz.score = payload.score
    quiz.total_questions = payload.total
    db.commit()
    db.refresh(quiz)
    return quiz


def _normalize_questions(raw: list) -> list[dict]:
    questions = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        q = item.get("question")
        options = item.get("options")
        correct = item.get("correct_index")
        if not q or not isinstance(options, list) or len(options) != 4:
            continue
        if not isinstance(correct, int) or not (0 <= correct < 4):
            continue
        questions.append(
            {
                "question": str(q),
                "options": [str(o) for o in options],
                "correct_index": int(correct),
                "explanation": str(item.get("explanation", "")),
            }
        )
    return questions
