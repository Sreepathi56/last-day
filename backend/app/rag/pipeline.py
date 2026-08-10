"""RAG pipeline: extract -> clean -> chunk -> embed -> store -> retrieve."""

import logging
import re
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Chunk, Document
from app.rag.chroma_store import search_in_db
from app.rag.embedding import embed_texts

logger = logging.getLogger(__name__)

_SECTION_SPLIT = re.compile(r"\n{2,}|\r\n{2,}")
_WHITESPACE = re.compile(r"[ \t]+")
_JUNK = re.compile(r"[\u0000-\u0008\u000b\u000c\u000e-\u001f]")


def extract_text(file_path: str | Path) -> str:
    import fitz  # PyMuPDF

    doc = fitz.open(str(file_path))
    try:
        pages = [page.get_text("text") for page in doc]
    finally:
        doc.close()
    return "\n\n".join(pages)


def clean_text(text: str) -> str:
    text = _JUNK.sub("", text)
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    lines = [_WHITESPACE.sub(" ", line).strip() for line in text.split("\n")]
    text = "\n".join(line for line in lines if line)
    return text.strip()


def chunk_text(text: str, size: int = None, overlap: int = None) -> list[str]:
    size = size or settings.CHUNK_SIZE
    overlap = overlap or settings.CHUNK_OVERLAP
    text = clean_text(text)
    if not text:
        return []
    paragraphs = [p.strip() for p in _SECTION_SPLIT.split(text) if p.strip()]
    chunks: list[str] = []
    current = ""

    def flush() -> None:
        nonlocal current
        if current.strip():
            chunks.append(current.strip())
        current = ""

    for para in paragraphs:
        if len(para) > size:
            flush()
            start = 0
            while start < len(para):
                piece = para[start : start + size]
                if piece.strip():
                    chunks.append(piece.strip())
                start += size - overlap
        elif len(current) + len(para) + 1 <= size:
            current = f"{current}\n{para}" if current else para
        else:
            flush()
            current = para
    flush()
    return chunks or [text[:size]]


def process_document(db: Session, user_id: int, file_path: str | Path, file_name: str) -> Document:
    from app.rag.chroma_store import get_vector_store

    text = extract_text(file_path)
    chunks = chunk_text(text)
    embeddings = embed_texts(chunks)

    document = Document(user_id=user_id, file_name=file_name)
    db.add(document)
    db.flush()  # get document.id

    for content, embedding in zip(chunks, embeddings):
        db.add(
            Chunk(
                document_id=document.id,
                user_id=user_id,
                content=content,
                embedding=embedding,
            )
        )
    db.flush()

    store = get_vector_store()
    if store is not None:
        store.add(
            ids=[f"{document.id}-{i}" for i in range(len(chunks))],
            embeddings=embeddings,
            metadatas=[
                {
                    "user_id": str(user_id),
                    "document_id": str(document.id),
                    "chunk_id": i,
                }
                for i in range(len(chunks))
            ],
            documents=chunks,
        )
    db.commit()
    db.refresh(document)
    return document


def retrieve_context(
    db: Session, query: str, user_id: int, top_k: int = None
) -> list[tuple[int, str, float]]:
    """Return (chunk_id, content, score) limited to the user's own chunks."""
    top_k = top_k or settings.RAG_TOP_K
    query_embedding = embed_texts([query])[0]

    from app.rag.chroma_store import get_vector_store

    store = get_vector_store()
    hits: list[tuple[int, float]] = []
    if store is not None:
        try:
            results = store.query(query_embedding, user_id, top_k=top_k)
            chunk_ids = [int(item[0].split("-")[1]) for item in results]
            scores = dict(zip(chunk_ids, [item[1] for item in results]))
            hits = [(cid, scores[cid]) for cid in chunk_ids]
        except Exception as exc:  # pragma: no cover - depends on env
            logger.warning("Chroma query failed (%s); falling back to DB search", exc)
            hits = search_in_db(db, query_embedding, user_id, top_k=top_k)
    else:
        hits = search_in_db(db, query_embedding, user_id, top_k=top_k)

    if not hits:
        return []

    rows = {
        chunk.id: chunk
        for chunk in db.scalars(
            select(Chunk).where(Chunk.id.in_([h[0] for h in hits]))
        ).all()
    }
    return [
        (chunk_id, rows[chunk_id].content, score)
        for chunk_id, score in hits
        if chunk_id in rows
    ]
