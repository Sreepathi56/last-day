"""Vector storage with per-user isolation.

Preferred store is ChromaDB (persistent). If ChromaDB is unavailable the
system transparently falls back to an in-database cosine search over the
`chunks.embedding` JSON column. Either way a user only ever sees rows
tagged with their own user_id.
"""

import logging
from abc import ABC, abstractmethod

import numpy as np
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models import Chunk

logger = logging.getLogger(__name__)


class VectorStore(ABC):
    @abstractmethod
    def add(
        self,
        ids: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict],
        documents: list[str],
    ) -> None: ...

    @abstractmethod
    def query(
        self,
        embedding: list[float],
        user_id: int,
        top_k: int = 4,
    ) -> list[tuple[str, float]]: ...

    @abstractmethod
    def delete_by_user(self, user_id: int) -> None: ...

    @abstractmethod
    def delete_by_document(self, user_id: int, document_id: int) -> None: ...


class ChromaStore(VectorStore):
    def __init__(self) -> None:
        try:
            import chromadb
        except ImportError as exc:  # pragma: no cover - depends on env
            raise RuntimeError("chromadb not installed") from exc

        self._client = chromadb.PersistentClient(path=settings.CHROMA_DIR)
        self._collection = self._client.get_or_create_collection(
            name=settings.CHROMA_COLLECTION, metadata={"hnsw:space": "cosine"}
        )

    def add(
        self,
        ids: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict],
        documents: list[str],
    ) -> None:
        self._collection.add(ids=ids, embeddings=embeddings, metadatas=metadatas, documents=documents)

    def query(
        self,
        embedding: list[float],
        user_id: int,
        top_k: int = 4,
    ) -> list[tuple[str, float]]:
        res = self._collection.query(
            query_embeddings=[embedding],
            n_results=top_k,
            where={"user_id": str(user_id)},
            include=["metadatas", "distances"],
        )
        ids = res.get("ids", [[]])[0]
        distances = res.get("distances", [[]])[0]
        scores = [1.0 - d for d in distances]  # cosine similarity
        return list(zip(ids, scores))

    def delete_by_user(self, user_id: int) -> None:
        self._collection.delete(where={"user_id": str(user_id)})

    def delete_by_document(self, user_id: int, document_id: int) -> None:
        self._collection.delete(
            where={
                "$and": [
                    {"user_id": str(user_id)},
                    {"document_id": str(document_id)},
                ]
            }
        )


class DatabaseStore(VectorStore):
    """Fallback: cosine similarity over chunks stored in PostgreSQL/SQLite."""

    def add(
        self,
        ids: list[str],
        embeddings: list[list[float]],
        metadatas: list[dict],
        documents: list[str],
    ) -> None:
        # Chunks are persisted by the pipeline via SQLAlchemy; nothing extra here.
        return None

    def query(
        self,
        embedding: list[float],
        user_id: int,
        top_k: int = 4,
    ) -> list[tuple[str, float]]:
        raise NotImplementedError("DatabaseStore needs a session; use search_in_db()")

    def delete_by_user(self, user_id: int) -> None:
        raise NotImplementedError("DatabaseStore deletes via DB session")

    def delete_by_document(self, user_id: int, document_id: int) -> None:
        raise NotImplementedError("DatabaseStore deletes via DB session")


def search_in_db(
    db: Session, embedding: list[float], user_id: int, top_k: int = 4
) -> list[tuple[int, float]]:
    rows = db.execute(
        select(Chunk).where(Chunk.user_id == user_id)
    ).scalars().all()

    query_vec = np.asarray(embedding, dtype=np.float32)
    query_norm = np.linalg.norm(query_vec) or 1.0
    query_vec = query_vec / query_norm

    results: list[tuple[int, float]] = []
    for chunk in rows:
        if not chunk.embedding:
            continue
        vec = np.asarray(chunk.embedding, dtype=np.float32)
        norm = np.linalg.norm(vec) or 1.0
        sim = float(np.dot(query_vec, vec / norm))
        results.append((chunk.id, sim))

    results.sort(key=lambda item: item[1], reverse=True)
    return results[:top_k]


def get_vector_store() -> VectorStore | None:
    try:
        store = ChromaStore()
        logger.info("ChromaDB vector store ready")
        return store
    except Exception as exc:  # pragma: no cover - depends on env
        logger.warning("ChromaDB unavailable (%s); using in-DB search", exc)
        return None
