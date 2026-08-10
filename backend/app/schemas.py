from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    created_at: datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=8000)
    session_id: str = Field(default="default", min_length=1, max_length=64)


class ChatResponse(BaseModel):
    answer: str
    sources: list[str] = []
    session_id: str = "default"


class ChatSessionOut(BaseModel):
    session_id: str
    title: str
    message_count: int
    updated_at: datetime


class UploadResponse(BaseModel):
    message: str
    document_id: int
    file_name: str
    chunks: int


class QuizRequest(BaseModel):
    topic: str = Field(min_length=1, max_length=255)
    num_questions: int = Field(default=5, ge=1, le=10)


class QuizScoreRequest(BaseModel):
    score: int = Field(ge=0, le=50)
    total: int = Field(ge=1, le=50)


class QuizOut(BaseModel):
    id: int
    topic: str
    questions_json: list
    score: int | None = None
    total_questions: int | None = None
    created_at: datetime


class DashboardStats(BaseModel):
    chat_count: int
    document_count: int
    quiz_count: int
    total_chunks: int
    recent_chats: list
    recent_documents: list
    recent_quizzes: list


class CourseCreate(BaseModel):
    topic: str = Field(min_length=2, max_length=255)


class LessonOut(BaseModel):
    id: int
    level: str
    order_index: int
    title: str
    content: str
    completed: bool


class LessonUpdate(BaseModel):
    completed: bool


class CourseOut(BaseModel):
    id: int
    topic: str
    title: str
    description: str | None = None
    created_at: datetime
    lessons: list[LessonOut] = []
    completed_lessons: int = 0
    total_lessons: int = 0
