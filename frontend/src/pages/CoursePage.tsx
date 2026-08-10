import { useEffect, useState, type FormEvent } from "react";

import { api, apiErrorMessage, type Course, type Lesson } from "../lib/api";

const LEVEL_COLORS: Record<string, string> = {
  Beginner: "border-green-400/40 bg-green-500/10 text-green-300",
  Intermediate: "border-amber-400/40 bg-amber-500/10 text-amber-300",
  Advanced: "border-red-400/40 bg-red-500/10 text-red-300",
};

export default function CoursePage() {
  const [topic, setTopic] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [active, setActive] = useState<Course | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () =>
    api
      .get<Course[]>("/courses")
      .then(({ data }) => setCourses(data))
      .catch((err) => setError(apiErrorMessage(err)));

  useEffect(() => {
    load();
  }, []);

  async function generate(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const { data } = await api.post<Course>("/course", {
        topic: topic.trim(),
      });
      setCourses((prev) => [data, ...prev]);
      setActive(data);
      setTopic("");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function toggleLesson(courseId: number, lesson: Lesson) {
    try {
      const { data } = await api.patch<Lesson>(
        `/courses/${courseId}/lessons/${lesson.id}`,
        { completed: !lesson.completed }
      );
      setActive((prev) =>
        prev && prev.id === courseId
          ? {
              ...prev,
              lessons: prev.lessons.map((l) =>
                l.id === lesson.id ? data : l
              ),
              completed_lessons: data.completed
                ? prev.completed_lessons + 1
                : prev.completed_lessons - 1,
            }
          : prev
      );
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  async function deleteCourse(course: Course) {
    if (!window.confirm(`Delete the course ${course.title}?`)) return;
    try {
      await api.delete(`/courses/${course.id}`);
      setCourses((prev) => prev.filter((c) => c.id !== course.id));
      if (active?.id === course.id) setActive(null);
    } catch (err) {
      setError(apiErrorMessage(err));
    }
  }

  function openCourse(course: Course) {
    api
      .get<Course>(`/courses/${course.id}`)
      .then(({ data }) => setActive(data))
      .catch((err) => setError(apiErrorMessage(err)));
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Courses</h1>
        <p className="mt-1 text-sm text-slate-400">
          Learn any topic from beginner to advanced with a guided course.
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
          placeholder="Topic, e.g. Machine Learning"
          required
        />
        <button
          type="submit"
          disabled={busy || !topic.trim()}
          className="btn-primary"
        >
          {busy ? "Building course..." : "Generate course"}
        </button>
      </form>

      {active && (
        <CourseView
          course={active}
          onToggle={(l) => toggleLesson(active.id, l)}
          onDelete={() => deleteCourse(active)}
          onBack={() => setActive(null)}
        />
      )}

      {courses.length > 0 && !active && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {courses.map((c) => (
            <div key={c.id} className="card flex flex-col p-5">
              <button
                onClick={() => openCourse(c)}
                className="text-left"
              >
                <h3 className="font-semibold text-white">{c.title}</h3>
                <p className="mt-1 line-clamp-2 text-sm text-slate-400">
                  {c.description || c.topic}
                </p>
              </button>
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {c.completed_lessons}/{c.total_lessons} lessons done
                  </span>
                  <span>
                    {c.total_lessons === 0
                      ? "0%"
                      : Math.round((c.completed_lessons / c.total_lessons) * 100)}
                    %
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/10">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500"
                    style={{
                      width: `${
                        c.total_lessons === 0
                          ? 0
                          : (c.completed_lessons / c.total_lessons) * 100
                      }%`,
                    }}
                  />
                </div>
              </div>
              <button
                onClick={() => deleteCourse(c)}
                className="btn-ghost mt-4 !px-3 !py-1.5 text-sm text-red-300 hover:bg-red-500/10"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      {courses.length === 0 && !active && (
        <div className="card p-12 text-center text-sm text-slate-500">
          No courses yet. Pick a topic above and generate your first learning path.
        </div>
      )}
    </div>
  );
}

function CourseView({
  course,
  onToggle,
  onDelete,
  onBack,
}: {
  course: Course;
  onToggle: (lesson: Lesson) => void;
  onDelete: () => void;
  onBack: () => void;
}) {
  const [openLesson, setOpenLesson] = useState<number | null>(
    course.lessons.find((l) => !l.completed)?.id ?? course.lessons[0]?.id ?? null
  );
  const levels = ["Beginner", "Intermediate", "Advanced"];

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-sm text-cyan-400 hover:underline">
        Back to all courses
      </button>

      <div className="card p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">{course.title}</h2>
            {course.description && (
              <p className="mt-1 text-sm text-slate-400">{course.description}</p>
            )}
          </div>
          <button
            onClick={onDelete}
            className="btn-ghost shrink-0 !px-3 !py-1.5 text-sm text-red-300 hover:bg-red-500/10"
          >
            Delete
          </button>
        </div>
        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
            <span>
              {course.completed_lessons}/{course.total_lessons} lessons done
            </span>
            <span>
              {course.total_lessons === 0
                ? "0%"
                : Math.round((course.completed_lessons / course.total_lessons) * 100)}
              % complete
            </span>
          </div>
          <div className="h-2 rounded-full bg-white/10">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-cyan-500 to-purple-500 transition-all"
              style={{
                width: `${
                  course.total_lessons === 0
                    ? 0
                    : (course.completed_lessons / course.total_lessons) * 100
                }%`,
              }}
            />
          </div>
        </div>
      </div>

      {levels.map((level) => {
        const lessons = course.lessons.filter((l) => l.level === level);
        if (lessons.length === 0) return null;
        return (
          <div key={level} className="card p-5">
            <div className="mb-3 flex items-center gap-2">
              <span
                className={`rounded-lg border px-2.5 py-0.5 text-xs font-semibold ${
                  LEVEL_COLORS[level] ?? "border-white/10 text-slate-300"
                }`}
              >
                {level}
              </span>
              <span className="text-xs text-slate-500">
                {lessons.filter((l) => l.completed).length}/{lessons.length} done
              </span>
            </div>
            <div className="space-y-2">
              {lessons.map((lesson) => (
                <LessonRow
                  key={lesson.id}
                  lesson={lesson}
                  open={openLesson === lesson.id}
                  onToggleOpen={() =>
                    setOpenLesson((cur) =>
                      cur === lesson.id ? null : lesson.id
                    )
                  }
                  onToggle={() => onToggle(lesson)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function LessonRow({
  lesson,
  open,
  onToggleOpen,
  onToggle,
}: {
  lesson: Lesson;
  open: boolean;
  onToggleOpen: () => void;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-white/10">
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={onToggle}
          aria-label="Toggle complete"
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs transition ${
            lesson.completed
              ? "border-cyan-400 bg-cyan-500 text-white"
              : "border-white/20 text-transparent hover:border-cyan-400/60"
          }`}
        >
          ✓
        </button>
        <button
          onClick={onToggleOpen}
          className="flex-1 text-left text-sm font-medium text-slate-200"
        >
          <span className={lesson.completed ? "text-slate-500 line-through" : ""}>
            {lesson.order_index + 1}. {lesson.title}
          </span>
        </button>
      </div>
      {open && (
        <p className="whitespace-pre-wrap border-t border-white/10 px-4 py-4 text-sm leading-relaxed text-slate-300">
          {lesson.content}
        </p>
      )}
    </div>
  );
}
