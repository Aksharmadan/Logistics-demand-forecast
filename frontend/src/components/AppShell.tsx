import { motion } from "framer-motion";
import { NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

const nav = [
  { to: "/", label: "Dashboard" },
  { to: "/upload", label: "Upload Data" },
  { to: "/predictions", label: "Predictions" },
  { to: "/analytics", label: "Analytics" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-ink-50 via-white to-brand-50/40">
      <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-display font-bold text-white shadow-card">
              F
            </div>
            <div>
              <p className="font-display text-lg font-semibold tracking-tight text-ink-900">ForecastFlow</p>
              <p className="text-xs text-slate-500">Logistics demand intelligence</p>
            </div>
          </div>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive ? "bg-brand-50 text-brand-800" : "text-slate-600 hover:bg-slate-100",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            ))}
            {user?.role === "admin" && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  [
                    "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive ? "bg-amber-50 text-amber-900" : "text-slate-600 hover:bg-slate-100",
                  ].join(" ")
                }
              >
                Admin
              </NavLink>
            )}
          </nav>
          <div className="flex items-center gap-3">
            <div className="hidden text-right text-xs sm:block">
              <p className="font-medium text-ink-900">{user?.email}</p>
              <p className="capitalize text-slate-500">{user?.role}</p>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
        <div className="flex gap-1 overflow-x-auto border-t border-slate-100 px-4 py-2 md:hidden">
          {[...nav, ...(user?.role === "admin" ? [{ to: "/admin", label: "Admin" }] : [])].map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                [
                  "whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium",
                  isActive ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700",
                ].join(" ")
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </header>
      <motion.main
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="mx-auto max-w-7xl px-4 py-8 sm:px-6"
      >
        {children}
      </motion.main>
    </div>
  );
}
