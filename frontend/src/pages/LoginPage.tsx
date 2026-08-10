import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";

import { apiErrorMessage } from "../lib/api";
import { useAuth } from "../lib/auth";

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">
            Email
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-300">
            Password
          </label>
          <input
            type="password"
            required
            autoComplete="current-password"
            className="input"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        {error && (
          <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? "Signing in..." : "Sign in"}
        </button>
        <p className="text-center text-sm text-slate-400">
          No account yet?{" "}
          <Link to="/register" className="font-medium text-cyan-400 hover:underline">
            Create one
          </Link>
        </p>
      </form>
    </AuthShell>
  );
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mb-3 inline-block h-10 w-10 rounded-2xl bg-gradient-to-r from-cyan-400 to-purple-500" />
          <h1 className="text-2xl font-bold text-white">
            Neon<span className="text-cyan-400">-AI</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Smart Study Companion
          </p>
        </div>
        <div className="card p-6">{children}</div>
      </div>
    </div>
  );
}
