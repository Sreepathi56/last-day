import { Navigate, NavLink, Outlet, useNavigate } from "react-router-dom";

import { useAuth } from "../lib/auth";

interface NavItem {
  to: string;
  label: string;
  end: boolean;
  paths: string[];
}

const navItems: NavItem[] = [
  {
    to: "/",
    label: "Dashboard",
    end: true,
    paths: ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M14 14h7v7h-7z", "M3 14h7v7H3z"],
  },
  {
    to: "/chat",
    label: "Chat",
    end: false,
    paths: ["M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"],
  },
  {
    to: "/documents",
    label: "Documents",
    end: false,
    paths: ["M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z", "M14 2v6h6"],
  },
  {
    to: "/quiz",
    label: "Quiz",
    end: false,
    paths: ["M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z", "M9.1 14.9l2.8-1.6 1.6-2.8 4.6-4.6-2.8 1.6-1.6 2.8z"],
  },
  {
    to: "/courses",
    label: "Courses",
    end: false,
    paths: ["M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z", "M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"],
  },
];

function Icon({ paths }: { paths: string[] }) {
  return (
    <svg
      className="h-4 w-4 shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
}

export function Layout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

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

  return (
    <div className="flex h-screen overflow-hidden bg-night-950 text-slate-200">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-white/10 bg-night-900 md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-white/5 px-5">
          <span className="inline-block h-4 w-4 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500" />
          <span className="text-lg font-bold text-white">
            Neon<span className="text-cyan-400">-AI</span>
          </span>
        </div>

        <div className="p-3">
          <NavLink
            to="/chat?new=1"
            className="flex items-center justify-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/15"
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
          </NavLink>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 pb-3">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              <Icon paths={item.paths} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/5 p-3">
          <div className="flex items-center gap-2 rounded-xl px-2 py-2">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500 to-purple-600 text-sm font-bold text-white">
              {user.email.charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm text-slate-300">{user.email}</p>
            </div>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              aria-label="Logout"
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
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
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-2 border-b border-white/10 bg-night-900 px-4 md:hidden">
          <NavLink to="/" className="flex h-14 items-center gap-2">
            <span className="inline-block h-3 w-3 rounded-full bg-gradient-to-r from-cyan-400 to-purple-500" />
            <span className="font-bold text-white">
              Neon<span className="text-cyan-400">-AI</span>
            </span>
          </NavLink>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="btn-ghost !px-3 !py-1.5 text-sm"
          >
            Logout
          </button>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-white/5 px-3 py-2 md:hidden">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium ${
                  isActive ? "bg-white/10 text-white" : "text-slate-400"
                }`
              }
            >
              <Icon paths={item.paths} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
