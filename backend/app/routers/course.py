import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai import AIProvider, get_provider
from app.database import get_db
from app.deps import get_current_user
from app.models import Course, Lesson, User
from app.schemas import CourseCreate, CourseOut, LessonOut, LessonUpdate

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["course"])

COURSE_SYSTEM_PROMPT = (
    "You are an expert course designer. Produce only valid JSON, no markdown, no commentary. "
    "Lesson content must be plain text. Never use markdown symbols, headings, "
    "asterisks, backticks, or double quotation marks inside lesson content."
)

COURSE_TEMPLATE = (
    'Design a complete beginner-to-advanced course about "{topic}". '
    "Respond as a JSON object with exactly this structure:\n"
    '{"title": "<course title>", "description": "<one or two sentence course overview>", '
    '"levels": ['
    '{"level": "Beginner", "lessons": [{"title": "<lesson title>", "content": "<teaching content, 3-6 sentences, plain text, no markdown>"}]}, '
    '{"level": "Intermediate", "lessons": [...]}, '
    '{"level": "Advanced", "lessons": [...]}'
    "]}\n"
    "Rules: exactly 3 levels in this order: Beginner, Intermediate, Advanced. "
    "Each level must have exactly 3 lessons. Lessons within a level build on each other, "
    "and each level is harder than the previous one. Every lesson teaches the topic "
    "clearly, step by step, suitable for that level."
)


@router.post("/course", response_model=CourseOut, status_code=201)
def create_course(
    payload: CourseCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    provider: AIProvider = Depends(get_provider),
):
    data = provider.generate_json(
        COURSE_TEMPLATE.format(topic=payload.topic),
        system_prompt=COURSE_SYSTEM_PROMPT,
    )

    levels = data.get("levels")
    if not isinstance(levels, list) or not levels:
        raise HTTPException(
            status_code=502,
            detail="AI did not return a valid course. Try again.",
        )

    course = Course(
        user_id=user.id,
        topic=payload.topic,
        title=str(data.get("title") or payload.topic),
        description=str(data.get("description") or "") or None,
    )
    db.add(course)
    db.flush()

    order = 0
    for level in levels:
        if not isinstance(level, dict):
            continue
        level_name = str(level.get("level") or "Beginner")
        raw_lessons = level.get("lessons")
        if not isinstance(raw_lessons, list):
            continue
        for lesson in raw_lessons:
            if not isinstance(lesson, dict):
                continue
            title = lesson.get("title")
            content = lesson.get("content")
            if not title or not content:
                continue
            db.add(
                Lesson(
                    course_id=course.id,
                    user_id=user.id,
                    level=level_name,
                    order_index=order,
                    title=str(title),
                    content=str(content),
                )
            )
            order += 1

    db.commit()
    db.refresh(course)
    return _serialize_course(db, course, user.id)


@router.get("/courses", response_model=list[CourseOut])
def list_courses(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    courses = list(
        db.scalars(
            select(Course)
            .where(Course.user_id == user.id)
            .order_by(Course.created_at.desc())
        )
    )
    return [_serialize_course(db, c, user.id) for c in courses]


@router.get("/courses/{course_id}", response_model=CourseOut)
def get_course(
    course_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    course = db.scalar(
        select(Course).where(Course.id == course_id, Course.user_id == user.id)
    )
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found.")
    return _serialize_course(db, course, user.id)


@router.patch("/courses/{course_id}/lessons/{lesson_id}", response_model=LessonOut)
def update_lesson(
    course_id: int,
    lesson_id: int,
    payload: LessonUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    lesson = db.scalar(
        select(Lesson).where(
            Lesson.id == lesson_id,
            Lesson.course_id == course_id,
            Lesson.user_id == user.id,
        )
    )
    if lesson is None:
        raise HTTPException(status_code=404, detail="Lesson not found.")
    lesson.completed = payload.completed
    db.commit()
    db.refresh(lesson)
    return LessonOut.model_validate(lesson)


@router.delete("/courses/{course_id}", status_code=200)
def delete_course(
    course_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    course = db.scalar(
        select(Course).where(Course.id == course_id, Course.user_id == user.id)
    )
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found.")
    db.delete(course)
    db.commit()
    return {"message": "Course deleted."}


def _serialize_course(db: Session, course: Course, user_id: int) -> CourseOut:
    lessons = list(
        db.scalars(
            select(Lesson)
            .where(Lesson.course_id == course.id)
            .order_by(Lesson.order_index)
        )
    )
    return CourseOut(
        id=course.id,
        topic=course.topic,
        title=course.title,
        description=course.description,
        created_at=course.created_at,
        lessons=[LessonOut.model_validate(l) for l in lessons],
        completed_lessons=sum(1 for l in lessons if l.completed),
        total_lessons=len(lessons),
    )
