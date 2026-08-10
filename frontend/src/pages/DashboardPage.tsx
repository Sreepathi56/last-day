import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { api, apiErrorMessage, type DashboardStats } from "../lib/api";

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<DashboardStats>("/dashboard")
      .then(({ data }) => setStats(data))
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  if (error) {
    return (
      <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        {error}
      </p>
    );
  }

  if (!stats) {
    return <p className="text-slate-400">Loading dashboard...</p>;
  }

  const cards = [
    { label: "Chats", value: stats.chat_count, to: "/chat" },
    { label: "Documents", value: stats.document_count, to: "/documents" },
    { label: "Quizzes", value: stats.quiz_count, to: "/quiz" },
    { label: "Indexed chunks", value: stats.total_chunks, to: "/documents" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-400">
          Your study hub — ask questions, upload notes, and test yourself.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.label}
            to={card.to}
            className="card p-5 transition hover:border-cyan-400/40"
          >
            <p className="text-sm text-slate-400">{card.label}</p>
            <p className="mt-1 text-3xl font-bold text-white">{card.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <RecentChats chats={stats.recent_chats} />
        <RecentDocuments docs={stats.recent_documents} />
        <RecentQuizzes quizzes={stats.recent_quizzes} />
      </div>
    </div>
  );
}

function RecentChats({ chats }: { chats: DashboardStats["recent_chats"] }) {
  return (
    <div className="card p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-300">
        Recent chats
      </h2>
      {chats.length === 0 ? (
        <Empty to="/chat" text="Start your first chat" />
      ) : (
        <ul className="space-y-2">
          {chats.map((c) => (
            <li key={c.id} className="truncate text-sm text-slate-400">
              {c.question}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecentDocuments({
  docs,
}: {
  docs: DashboardStats["recent_documents"];
}) {
  return (
    <div className="card p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-300">
        Recent documents
      </h2>
      {docs.length === 0 ? (
        <Empty to="/documents" text="Upload your first PDF" />
      ) : (
        <ul className="space-y-2">
          {docs.map((d) => (
            <li key={d.id} className="truncate text-sm text-slate-400">
              {d.file_name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecentQuizzes({
  quizzes,
}: {
  quizzes: DashboardStats["recent_quizzes"];
}) {
  return (
    <div className="card p-5">
      <h2 className="mb-3 text-sm font-semibold text-slate-300">
        Recent quizzes
      </h2>
      {quizzes.length === 0 ? (
        <Empty to="/quiz" text="Generate your first quiz" />
      ) : (
        <ul className="space-y-2">
          {quizzes.map((q) => (
            <li key={q.id} className="truncate text-sm text-slate-400">
              {q.topic}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Empty({ to, text }: { to: string; text: string }) {
  return (
    <p className="text-sm text-slate-500">
      <Link to={to} className="text-cyan-400 hover:underline">
        {text}
      </Link>
    </p>
  );
}
