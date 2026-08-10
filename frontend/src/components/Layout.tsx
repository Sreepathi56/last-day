import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../lib/auth";

const navItems = [
  { to: "/", label: "Dashboard", end: true },
  { to: "/chat", label: "Chat", end: false },
  { to: "/documents", label: "Documents", end: false },
  { to: "/quiz", label: "Quiz", end: false },
  { to: "/courses", label: "Courses", end: false },
];

export function Layout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-400">
        Loading...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <AppShell />;
}

function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-night-950/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
          <NavLink to="/" className="flex items-center gap-2 text-lg font-bold text-white">
            <span className="inline-block h-3 w-3 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500" />
            Neon<span className="text-cyan-400">-AI</span>
          </NavLink>
          <nav className="hidden items-center gap-1 sm:flex">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-white/10 text-cyan-300"
                      : "text-slate-400 hover:text-white"
                  }`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="hidden max-w-[180px] truncate text-sm text-slate-400 sm:block">
              {user?.email}
            </span>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="btn-ghost !px-3 !py-1.5 text-sm"
            >
              Logout
            </button>
          </div>
        </div>
        <nav className="flex gap-1 border-t border-white/5 px-4 py-2 sm:hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex-1 rounded-lg px-2 py-1.5 text-center text-sm font-medium ${
                  isActive ? "bg-white/10 text-cyan-300" : "text-slate-400"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
