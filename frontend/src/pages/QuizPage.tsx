import { useEffect, useState, type FormEvent } from "react";

import {
  api,
  apiErrorMessage,
  type Quiz,
  type QuizQuestion,
} from "../lib/api";

export default function QuizPage() {
  const [topic, setTopic] = useState("");
  const [num, setNum] = useState(5);
  const [history, setHistory] = useState<Quiz[]>([]);
  const [current, setCurrent] = useState<Quiz | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get<Quiz[]>("/quiz/history")
      .then(({ data }) => setHistory(data))
      .catch((err) => setError(apiErrorMessage(err)));
  }, []);

  async function generate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post<Quiz>("/quiz", {
        topic: topic.trim(),
        num_questions: num,
      });
      setCurrent(data);
      setHistory((prev) => [data, ...prev]);
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function submitScore(quizId: number, score: number, total: number) {
    try {
      const { data } = await api.post<Quiz>(`/quiz/${quizId}/submit`, {
        score,
        total,
      });
      setHistory((prev) => prev.map((q) => (q.id === quizId ? data : q)));
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Quiz Generator</h1>
        <p className="mt-1 text-sm text-slate-400">
          Generate multiple-choice questions on any topic.
        </p>
      </div>

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <form onSubmit={generate} className="card flex flex-col gap-3 p-5 sm:flex-row">
        <input
          className="input flex-1"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="Topic, e.g. Photosynthesis"
          required
        />
        <select
          className="input sm:w-40"
          value={num}
          onChange={(e) => setNum(Number(e.target.value))}
        >
          {[3, 5, 8, 10].map((n) => (
            <option key={n} value={n}>
              {n} questions
            </option>
          ))}
        </select>
        <button type="submit" disabled={busy || !topic.trim()} className="btn-primary">
          {busy ? "Generating..." : "Generate"}
        </button>
      </form>

      {current ? (
        <QuizView
          key={current.id}
          quiz={current}
          onSubmitScore={(score, total) => submitScore(current.id, score, total)}
        />
      ) : (
        <div className="card p-12 text-center text-sm text-slate-500">
          Pick a topic and hit Generate. A past quiz appears here.
        </div>
      )}

      {history.length > 0 && (
        <div className="card p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">
            Quiz history
          </h2>
          <ul className="space-y-2">
            {history.map((q) => (
              <li key={q.id}>
                <button
                  onClick={() => setCurrent(q)}
                  className="flex w-full items-center justify-between gap-2 text-left text-sm text-slate-300 transition hover:text-cyan-300"
                >
                  <span className="truncate">{q.topic}</span>
                  <span className="flex shrink-0 items-center gap-2 text-xs">
                    {q.score !== null && q.total_questions !== null ? (
                      <span className="font-semibold text-cyan-300">
                        {q.score}/{q.total_questions}
                      </span>
                    ) : (
                      <span className="text-slate-500">Not attempted</span>
                    )}
                    <span className="text-slate-500">
                      {new Date(q.created_at).toLocaleDateString()}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function QuizView({
  quiz,
  onSubmitScore,
}: {
  quiz: Quiz;
  onSubmitScore: (score: number, total: number) => void;
}) {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [saved, setSaved] = useState(quiz.score !== null);

  const score = quiz.questions_json.reduce(
    (acc, q, i) => acc + (answers[i] === q.correct_index ? 1 : 0),
    0
  );
  const total = quiz.questions_json.length;
  const done = Object.keys(answers).length === total;

  useEffect(() => {
    if (done && !saved) {
      onSubmitScore(score, total);
      setSaved(true);
    }
  }, [done, saved, score, total, onSubmitScore]);

  return (
    <div className="space-y-4">
      <div className="card flex items-center justify-between p-5">
        <h2 className="font-semibold text-white">{quiz.topic}</h2>
        {saved && quiz.score !== null && quiz.total_questions ? (
          <span className="rounded-lg bg-cyan-500/10 px-3 py-1.5 text-sm font-semibold text-cyan-300">
            Score: {quiz.score}/{quiz.total_questions}
          </span>
        ) : (
          <span className="text-sm text-slate-500">
            {done ? "Submitting score..." : `${Object.keys(answers).length}/${total} answered`}
          </span>
        )}
      </div>
      {quiz.questions_json.map((q, i) => (
        <QuestionCard
          key={i}
          index={i}
          question={q}
          selected={answers[i]}
          onSelect={(idx) =>
            setAnswers((prev) => ({ ...prev, [i]: idx }))
          }
        />
      ))}
      {done && (
        <div className="card p-5 text-center">
          <p className="text-lg font-bold text-white">
            Score: {score}/{total}
          </p>
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  index,
  question,
  selected,
  onSelect,
}: {
  index: number;
  question: QuizQuestion;
  selected: number | undefined;
  onSelect: (idx: number) => void;
}) {
  const answered = selected !== undefined;
  return (
    <div className="card p-5">
      <p className="mb-3 font-medium text-slate-100">
        <span className="mr-2 text-cyan-400">Q{index + 1}.</span>
        {question.question}
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {question.options.map((opt, idx) => {
          const isCorrect = answered && idx === question.correct_index;
          const isWrong = answered && idx === selected && idx !== question.correct_index;
          const cls = isCorrect
            ? "border-green-400/60 bg-green-500/10 text-green-200"
            : isWrong
              ? "border-red-400/60 bg-red-500/10 text-red-300"
              : selected === idx
                ? "border-cyan-400/60 bg-cyan-500/10 text-cyan-100"
                : "border-white/10 text-slate-300 hover:border-cyan-400/40";
          return (
            <button
              key={idx}
              onClick={() => onSelect(idx)}
              disabled={answered}
              className={`rounded-xl border px-4 py-2.5 text-left text-sm transition disabled:cursor-default ${cls}`}
            >
              <span className="mr-2 font-semibold">
                {String.fromCharCode(65 + idx)}.
              </span>
              {opt}
            </button>
          );
        })}
      </div>
      {answered && (
        <p className="mt-3 text-sm text-slate-400">
          {selected === question.correct_index ? "Correct!" : "Incorrect."}{" "}
          {question.explanation}
        </p>
      )}
    </div>
  );
}
