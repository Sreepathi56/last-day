import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";

import {
  api,
  apiErrorMessage,
  type ChatMessage,
  type ChatResponse,
  type ChatSession,
} from "../lib/api";

function newSessionId(): string {
  return crypto.randomUUID();
}

export default function ChatPage() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadSessions = useCallback(async () => {
    try {
      const { data } = await api.get<ChatSession[]>("/chat/sessions");
      setSessions(data);
      return data;
    } catch (err) {
      setError(apiErrorMessage(err));
      return [];
    }
  }, []);

  const loadHistory = useCallback(async (sessionId: string) => {
    try {
      const { data } = await api.get<ChatMessage[]>("/chat/history", {
        params: { session_id: sessionId },
      });
      setMessages(data);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const data = await loadSessions();
      if (cancelled) return;
      if (data.length > 0) {
        setActiveId(data[0].session_id);
        await loadHistory(data[0].session_id);
      } else {
        const fresh = newSessionId();
        setActiveId(fresh);
        setMessages([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSessions, loadHistory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function openSession(sessionId: string) {
    if (sessionId === activeId) return;
    setActiveId(sessionId);
    setError("");
    await loadHistory(sessionId);
  }

  async function startNewChat() {
    const fresh = newSessionId();
    setActiveId(fresh);
    setMessages([]);
    setError("");
    setQuestion("");
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (!q || busy || !activeId) return;
    setQuestion("");
    setBusy(true);
    setError("");
    try {
      const { data } = await api.post<ChatResponse>("/chat", {
        question: q,
        session_id: activeId,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          question: q,
          answer: data.answer,
          created_at: new Date().toISOString(),
        },
      ]);
      await loadSessions();
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-4 lg:flex-row">
      <aside className="card flex flex-col p-3 lg:w-64 lg:self-start">
        <button
          onClick={startNewChat}
          className="btn-primary mb-3 w-full"
          disabled={busy}
        >
          New chat
        </button>
        <div className="flex flex-col gap-1 overflow-y-auto lg:max-h-[65vh]">
          {sessions.length === 0 && (
            <p className="px-2 py-4 text-center text-sm text-slate-500">
              No conversations yet.
            </p>
          )}
          {sessions.map((s) => (
            <button
              key={s.session_id}
              onClick={() => openSession(s.session_id)}
              className={`rounded-xl px-3 py-2 text-left text-sm transition ${
                s.session_id === activeId
                  ? "bg-white/10 text-cyan-300"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="block truncate font-medium">{s.title}</span>
              <span className="block text-xs text-slate-500">
                {s.message_count} message{s.message_count === 1 ? "" : "s"}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Study Chat</h1>
          <button
            onClick={() => setMessages([])}
            className="btn-ghost !px-3 !py-1.5 text-sm"
          >
            Clear view
          </button>
        </div>

        <div className="card flex min-h-[60vh] flex-col overflow-hidden">
          <div className="flex-1 space-y-4 overflow-y-auto p-5">
            {messages.length === 0 && (
              <p className="pt-16 text-center text-sm text-slate-500">
                Ask anything about your study material. Uploaded PDFs are used as
                context automatically.
              </p>
            )}
            {messages.map((m) => (
              <div key={m.id} className="space-y-2">
                <Bubble kind="user">{m.question}</Bubble>
                <Bubble kind="assistant">{m.answer}</Bubble>
              </div>
            ))}
            {busy && <Bubble kind="assistant">Thinking...</Bubble>}
            {error && (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                {error}
              </p>
            )}
            <div ref={bottomRef} />
          </div>

          <form
            onSubmit={onSubmit}
            className="flex gap-2 border-t border-white/10 p-3"
          >
            <input
              className="input flex-1"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Type your question..."
              disabled={busy}
            />
            <button
              type="submit"
              disabled={busy || !question.trim()}
              className="btn-primary"
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Bubble({
  kind,
  children,
}: {
  kind: "user" | "assistant";
  children: React.ReactNode;
}) {
  const align = kind === "user" ? "items-end" : "items-start";
  const style =
    kind === "user"
      ? "bg-gradient-to-r from-cyan-600/80 to-purple-600/80 text-white"
      : "bg-white/5 text-slate-200";
  return (
    <div className={`flex flex-col ${align}`}>
      <div
        className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-relaxed ${style}`}
      >
        {children}
      </div>
    </div>
  );
}
