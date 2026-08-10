import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";

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

const SUGGESTIONS = [
  "Teach me Python from zero",
  "Explain photosynthesis simply",
  "What is machine learning?",
  "Summarize my uploaded documents",
];

export default function ChatPage() {
  const [searchParams, setSearchParams] = useSearchParams();
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
      if (searchParams.get("new") === "1") {
        setActiveId(newSessionId());
        setMessages([]);
        setSearchParams({}, { replace: true });
      } else if (data.length > 0) {
        setActiveId(data[0].session_id);
        await loadHistory(data[0].session_id);
      } else {
        setActiveId(newSessionId());
        setMessages([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadSessions, loadHistory, searchParams, setSearchParams]);

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
    setActiveId(newSessionId());
    setMessages([]);
    setError("");
    setQuestion("");
  }

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy || !activeId) return;
    setQuestion("");
    setError("");
    setBusy(true);
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

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void send(question);
  }

  return (
    <div className="flex h-full">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-white/5 bg-night-900/60 p-3 lg:flex">
        <button
          onClick={startNewChat}
          className="mb-3 flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
        >
          <svg
            className="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          New chat
        </button>
        <div className="flex-1 space-y-1 overflow-y-auto">
          {sessions.length === 0 && (
            <p className="px-2 py-6 text-center text-xs text-slate-500">
              No conversations yet
            </p>
          )}
          {sessions.map((s) => (
            <button
              key={s.session_id}
              onClick={() => openSession(s.session_id)}
              className={`block w-full rounded-xl px-3 py-2.5 text-left transition ${
                s.session_id === activeId
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span className="block truncate text-sm font-medium">
                {s.title}
              </span>
            </button>
          ))}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full max-w-3xl flex-col px-4 py-6">
            {messages.length === 0 ? (
              <EmptyState
                busy={busy}
                onPick={(text) => void send(text)}
              />
            ) : (
              <div className="space-y-6">
                {messages.map((m) => (
                  <MessageRow key={m.id} message={m} />
                ))}
                {busy && <ThinkingRow />}
                {error && (
                  <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                    {error}
                  </p>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-white/5 p-4">
          <div className="mx-auto max-w-3xl">
            <form
              onSubmit={onSubmit}
              className="flex items-end gap-2 rounded-3xl border border-white/15 bg-night-900 p-2 pl-4 transition focus-within:border-cyan-400/50"
            >
              <input
                className="flex-1 bg-transparent py-2 text-slate-100 placeholder-slate-500 outline-none"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask anything about your study material..."
                disabled={busy}
              />
              <button
                type="submit"
                disabled={busy || !question.trim()}
                aria-label="Send message"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 text-white transition enabled:hover:opacity-90 disabled:opacity-30"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 19V5M5 12l7-7 7 7" />
                </svg>
              </button>
            </form>
            <p className="mt-2 text-center text-xs text-slate-600">
              Neon-AI can make mistakes. Check important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({
  busy,
  onPick,
}: {
  busy: boolean;
  onPick: (text: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-gradient-to-br from-cyan-400 to-purple-600">
        <svg
          className="h-7 w-7 text-white"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
        </svg>
      </div>
      <h1 className="text-2xl font-semibold text-white">
        What can I help you learn?
      </h1>
      <p className="mt-2 text-sm text-slate-400">
        Ask questions, study with your PDFs, or learn any topic from beginner to advanced.
      </p>
      <div className="mt-8 grid w-full gap-2 sm:grid-cols-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            disabled={busy}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-left text-sm text-slate-300 transition hover:border-cyan-400/40 hover:bg-white/10 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageRow({ message }: { message: ChatMessage }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <div className="rounded-2xl rounded-br-md bg-white/10 px-4 py-2.5 text-sm leading-relaxed text-slate-100">
          {message.question}
        </div>
      </div>
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-purple-600">
          <svg
            className="h-4 w-4 text-white"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
          </svg>
        </div>
        <div className="min-w-0 whitespace-pre-wrap pt-1 text-[15px] leading-relaxed text-slate-200">
          {message.answer}
        </div>
      </div>
    </div>
  );
}

function ThinkingRow() {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-purple-600">
        <svg
          className="h-4 w-4 text-white"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8z" />
        </svg>
      </div>
      <div className="flex items-center gap-1 pt-3">
        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500 [animation-delay:0.15s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-slate-500 [animation-delay:0.3s]" />
      </div>
    </div>
  );
}
