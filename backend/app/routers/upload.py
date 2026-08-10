import logging
import tempfile
import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import Chunk, Document, User
from app.rag.chroma_store import get_vector_store
from app.rag.pipeline import process_document
from app.schemas import UploadResponse

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["upload"])


@router.post("/upload", response_model=UploadResponse, status_code=status.HTTP_201_CREATED)
def upload_pdf(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    file_name = (file.filename or "document.pdf").strip()
    ext = Path(file_name).suffix.lower()
    if ext not in settings.ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Only PDF files are allowed.",
        )

    content = file.file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(content) > settings.MAX_FILE_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"File exceeds the {settings.MAX_FILE_MB_SIZE}MB limit.",
        )

    tmp_dir = Path(tempfile.gettempdir()) / "neon_uploads"
    tmp_dir.mkdir(parents=True, exist_ok=True)
    tmp_path = tmp_dir / f"{uuid.uuid4().hex}.pdf"
    tmp_path.write_bytes(content)

    try:
        document = process_document(db, user.id, tmp_path, file_name)
    except Exception as exc:
        logger.exception("PDF processing failed")
        raise HTTPException(
            status_code=422, detail=f"Failed to process PDF: {exc}"
        ) from exc
    finally:
        tmp_path.unlink(missing_ok=True)

    return UploadResponse(
        message="Document processed and indexed.",
        document_id=document.id,
        file_name=document.file_name,
        chunks=document.chunks.__len__(),
    )


@router.get("/documents", response_model=list[dict])
def list_documents(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    rows = db.execute(
        select(
            Document.id,
            Document.file_name,
            Document.uploaded_at,
            func.count(Chunk.id).label("chunks"),
        )
        .outerjoin(Chunk, Chunk.document_id == Document.id)
        .where(Document.user_id == user.id)
        .group_by(Document.id)
        .order_by(Document.uploaded_at.desc())
    ).all()
    return [
        {
            "id": r.id,
            "file_name": r.file_name,
            "uploaded_at": r.uploaded_at.isoformat(),
            "chunks": r.chunks,
        }
        for r in rows
    ]


@router.delete("/documents/{document_id}", status_code=status.HTTP_200_OK)
def delete_document(
    document_id: int,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    document = db.scalar(
        select(Document).where(
            Document.id == document_id,
            Document.user_id == user.id,
        )
    )
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document not found.",
        )

    chunk_count = db.scalar(
        select(func.count(Chunk.id)).where(Chunk.document_id == document.id)
    ) or 0

    store = get_vector_store()
    if store is not None:
        try:
            store.delete_by_document(user.id, document.id)
        except Exception as exc:  # pragma: no cover - depends on env
            logger.warning("Chroma delete failed (%s)", exc)

    db.delete(document)
    db.commit()
    return {"message": "Document deleted.", "removed_chunks": chunk_count}
