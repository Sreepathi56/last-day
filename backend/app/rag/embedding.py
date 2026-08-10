import logging
import math
import re
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)

_TOKEN_RE = re.compile(r"[a-z0-9]+")


class EmbeddingService:
    """Sentence embeddings.

    Uses sentence-transformers when available. If the heavy ML stack is not
    installed, falls back to a deterministic feature-hashing embedding so the
    RAG pipeline still works end to end (vector search remains functional).
    """

    _model = None
    _model_failed = False
    _dim = settings.EMBEDDING_DIM

    @classmethod
    def _load_model(cls):
        if cls._model is not None or cls._model_failed:
            return cls._model
        try:
            from sentence_transformers import SentenceTransformer

            cls._model = SentenceTransformer(settings.EMBEDDING_MODEL)
            cls._dim = cls._model.get_sentence_embedding_dimension()
            logger.info("Loaded embedding model %s", settings.EMBEDDING_MODEL)
        except Exception as exc:  # pragma: no cover - depends on env
            cls._model_failed = True
            logger.warning(
                "sentence-transformers unavailable (%s); using hashed embeddings",
                exc,
            )
        return cls._model

    @classmethod
    def embed(cls, texts: list[str]) -> list[list[float]]:
        model = cls._load_model()
        if model is not None:
            vectors = model.encode(texts, normalize_embeddings=True)
            return [list(map(float, vec)) for vec in vectors]
        return [cls._hash_embed(t) for t in texts]

    @classmethod
    def _hash_embed(cls, text: str) -> list[float]:
        """Deterministic hashing embedding (fallback). 384-dim unit vector."""
        dim = cls._dim
        vec = [0.0] * dim
        tokens = _TOKEN_RE.findall(text.lower())
        for tok in tokens:
            h = abs(hash(tok)) % (2**32)
            idx = h % dim
            sign = 1.0 if (h // dim) % 2 == 0 else -1.0
            vec[idx] += sign
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]


def embed_texts(texts: list[str]) -> list[list[float]]:
    return EmbeddingService.embed(texts)


def embed_one(text: str) -> list[float]:
    return EmbeddingService.embed([text])[0]
