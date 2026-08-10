import { useEffect, useState, type ChangeEvent } from "react";

import {
  api,
  apiErrorMessage,
  type DocumentInfo,
  type UploadResponse,
} from "../lib/api";

export default function DocumentsPage() {
  const [docs, setDocs] = useState<DocumentInfo[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = () =>
    api
      .get<DocumentInfo[]>("/documents")
      .then(({ data }) => setDocs(data))
      .catch((err) => setError(apiErrorMessage(err)));

  useEffect(() => {
    load();
  }, []);

  async function onUpload(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setBusy(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const { data } = await api.post<UploadResponse>("/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setDocs((prev) => [
        {
          id: data.document_id,
          file_name: data.file_name,
          uploaded_at: new Date().toISOString(),
          chunks: data.chunks,
        },
        ...prev,
      ]);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDelete(id: number, name: string) {
    if (!window.confirm(`Delete ${name} and its indexed chunks?`)) return;
    setError("");
    setDeletingId(id);
    try {
      await api.delete(`/documents/${id}`);
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Documents</h1>
          <p className="mt-1 text-sm text-slate-400">
            Upload PDFs to build your personal knowledge base.
          </p>
        </div>
        <label
          className={`btn-primary cursor-pointer ${busy ? "pointer-events-none opacity-50" : ""}`}
        >
          {busy ? "Processing..." : "Upload PDF"}
          <input
            type="file"
            accept=".pdf"
            className="hidden"
            onChange={onUpload}
            disabled={busy}
          />
        </label>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      {docs.length === 0 ? (
        <div className="card p-12 text-center text-sm text-slate-500">
          No documents yet. Upload a PDF to get started.
        </div>
      ) : (
        <div className="card divide-y divide-white/5">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between px-5 py-4"
            >
              <div className="flex items-center gap-3">
                <span className="inline-block h-8 w-8 rounded-lg bg-purple-500/20 text-center leading-8 text-purple-300">
                  PDF
                </span>
                <div>
                  <p className="font-medium text-slate-200">{doc.file_name}</p>
                  <p className="text-xs text-slate-500">
                    {new Date(doc.uploaded_at).toLocaleString()} ·{" "}
                    {doc.chunks} chunk{doc.chunks === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => onDelete(doc.id, doc.file_name)}
                disabled={deletingId === doc.id}
                className="btn-ghost !px-3 !py-1.5 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-50"
              >
                {deletingId === doc.id ? "Deleting..." : "Delete"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
