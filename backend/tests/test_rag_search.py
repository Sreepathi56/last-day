import numpy as np

from app.models import Chunk, Document, User
from app.rag.chroma_store import search_in_db


def _user(db, email):
    user = User(email=email, password_hash="x")
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _embedding(vec):
    arr = np.asarray(vec, dtype=np.float32)
    return (arr / np.linalg.norm(arr)).tolist()


def test_search_in_db_returns_most_similar(db):
    user = _user(db, "rag@example.com")
    doc = Document(user_id=user.id, file_name="notes.pdf")
    db.add(doc)
    db.flush()

    e_sun = _embedding([1.0, 0.0])
    e_moon = _embedding([0.0, 1.0])
    db.add_all(
        [
            Chunk(
                document_id=doc.id,
                user_id=user.id,
                content="about the sun and light",
                embedding=e_sun,
            ),
            Chunk(
                document_id=doc.id,
                user_id=user.id,
                content="about the moon at night",
                embedding=e_moon,
            ),
        ]
    )
    db.commit()

    hits = search_in_db(db, _embedding([0.9, 0.1]), user.id, top_k=1)
    assert len(hits) == 1
    chunk_id, score = hits[0]
    assert chunk_id is not None
    assert score > 0.5

    content = db.get(Chunk, chunk_id).content
    assert "sun" in content


def test_search_in_db_respects_user_isolation(db):
    user_a = _user(db, "a@example.com")
    user_b = _user(db, "b@example.com")

    def make_doc(user):
        doc = Document(user_id=user.id, file_name="doc.pdf")
        db.add(doc)
        db.flush()
        return doc

    doc_a = make_doc(user_a)
    doc_b = make_doc(user_b)
    db.add(
        Chunk(
            document_id=doc_a.id,
            user_id=user_a.id,
            content="alpha",
            embedding=_embedding([1.0, 0.0]),
        )
    )
    db.add(
        Chunk(
            document_id=doc_b.id,
            user_id=user_b.id,
            content="beta",
            embedding=_embedding([1.0, 0.0]),
        )
    )
    db.commit()

    hits = search_in_db(db, _embedding([1.0, 0.0]), user_a.id, top_k=5)
    contents = [db.get(Chunk, cid).content for cid, _ in hits]
    assert "alpha" in contents
    assert "beta" not in contents
