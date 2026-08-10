from app.routers.quiz import _normalize_questions
from app.security import (
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)


def test_normalize_questions_keeps_valid():
    raw = [
        {
            "question": "What is 2+2?",
            "options": ["3", "4", "5", "6"],
            "correct_index": 1,
            "explanation": "Basic addition.",
        },
        {
            "question": "Broken item (no options)",
            "correct_index": 0,
        },
        {
            "question": "Bad index",
            "options": ["a", "b", "c", "d"],
            "correct_index": 9,
        },
    ]
    out = _normalize_questions(raw)
    assert len(out) == 1
    assert out[0]["question"] == "What is 2+2?"
    assert out[0]["correct_index"] == 1


def test_normalize_questions_empty():
    assert _normalize_questions([]) == []
    assert _normalize_questions(["not a dict"]) == []


def test_password_hash_and_verify():
    hashed = hash_password("s3cret")
    assert hashed != "s3cret"
    assert verify_password("s3cret", hashed)
    assert not verify_password("wrong", hashed)


def test_token_roundtrip():
    token = create_access_token(42)
    assert decode_access_token(token) == 42
    assert decode_access_token("not-a-jwt") is None
