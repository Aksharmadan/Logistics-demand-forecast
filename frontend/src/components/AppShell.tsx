import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useTheme } from "../theme/ThemeProvider";
import { CommandPalette } from "./ui/CommandPalette";
import {
  LayoutDashboard, TrendingUp, BarChart3, UploadCloud,
  ShieldCheck, Bot, Truck, Moon, Sun, LogOut,
  Command, ChevronLeft, ChevronRight, Activity,
  Zap, Bell
} from "lucide-react";
import { cn } from "../lib/utils";
import { useWebSocket } from "../hooks/useWebSocket";
import { apiJson } from "../api/client";

const WS_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace("http", "ws") + "/ws/live"
  : "ws://127.0.0.1:8000/ws/live";

const NAV = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/predictions", label: "Forecasting Lab", icon: TrendingUp },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/fleet", label: "Fleet", icon: Truck },
  { to: "/copilot", label: "AI Copilot", icon: Bot },
  { to: "/upload", label: "Data Ingest", icon: UploadCloud },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [alerts, setAlerts] = useState(0);
  const { isConnected, lastMessage } = useWebSocket(WS_URL);

  // ⌘K handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Load open alert count
  useEffect(() => {
    apiJson<{ summary: { open_alerts: number } }>("/analytics")
      .then((d) => setAlerts(d.summary.open_alerts))
      .catch(() => {});
  }, []);

  // Live alert count updates
  useEffect(() => {
    if (lastMessage?.type === "anomaly_alert") setAlerts((n) => n + 1);
    if (lastMessage?.type === "kpi_update") setAlerts(lastMessage.data.open_alerts ?? alerts);
  }, [lastMessage]);

  const sidebarW = collapsed ? 64 : 220;

  return (
    <div className="flex min-h-screen bg-ink-50 dark:bg-ink-950 bg-grid dark:bg-grid-dark">
      {/* Ambient background blobs */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-brand-400/8 blur-[120px] dark:bg-brand-500/10" />
        <div className="absolute bottom-0 -left-40 h-96 w-96 rounded-full bg-violet-400/6 blur-[120px] dark:bg-violet-600/8" />
        <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400/4 blur-[100px] dark:bg-cyan-500/6" />
      </div>

      {/* ── Sidebar ── */}
      <motion.aside
        animate={{ width: sidebarW }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="fixed left-0 top-0 z-30 flex h-full flex-col border-r border-slate-200/60 bg-white/80 backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/80"
      >
        {/* Logo */}
        <div className="flex h-14 items-center gap-3 border-b border-slate-100/80 px-4 dark:border-slate-800/80">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow-sm">
            <Zap className="h-4 w-4 text-white" />
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.15 }}
                className="min-w-0"
              >
                <p className="font-display text-sm font-bold tracking-tight text-ink-900 dark:text-slate-50">ForecastFlow</p>
                <p className="text-[10px] text-slate-400 dark:text-slate-500">AI Platform</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 scrollbar-hide">
          <div className="space-y-0.5 px-2">
            {NAV.map(({ to, label, icon: Icon, exact }) => (
              <NavLink
                key={to}
                to={to}
                end={exact}
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-brand-50 text-brand-700 shadow-sm dark:bg-brand-500/15 dark:text-brand-300"
                      : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={cn("h-4 w-4 shrink-0 transition-transform duration-150", isActive ? "scale-110" : "group-hover:scale-105")} />
                    <AnimatePresence>
                      {!collapsed && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.1 }}
                          className="truncate"
                        >
                          {label}
                        </motion.span>
                      )}
                    </AnimatePresence>
                    {label === "AI Copilot" && !collapsed && (
                      <span className="ml-auto rounded-full bg-brand-500 px-1.5 py-0.5 text-[9px] font-bold text-white">AI</span>
                    )}
                  </>
                )}
              </NavLink>
            ))}

            {user?.role === "admin" && (
              <NavLink
                to="/admin"
                className={({ isActive }) =>
                  cn(
                    "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
                      : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
                  )
                }
              >
                <ShieldCheck className="h-4 w-4 shrink-0" />
                <AnimatePresence>
                  {!collapsed && (
                    <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="truncate">
                      Admin
                    </motion.span>
                  )}
                </AnimatePresence>
              </NavLink>
            )}
          </div>

          {/* Divider */}
          <div className="mx-4 my-3 border-t border-slate-100 dark:border-slate-800" />

          {/* Quick actions */}
          <div className="space-y-0.5 px-2">
            <button
              onClick={() => setCmdOpen(true)}
              className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition-all hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-500 dark:hover:bg-slate-800/60 dark:hover:text-slate-200"
            >
              <Command className="h-4 w-4 shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.1 }} className="flex flex-1 items-center justify-between">
                    <span>Command</span>
                    <kbd className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-400 dark:bg-slate-800">⌘K</kbd>
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </div>
        </nav>

        {/* Bottom: user + controls */}
        <div className="border-t border-slate-100/80 p-3 dark:border-slate-800/80">
          {/* Live indicator */}
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="mb-2 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/50"
              >
                <span className="relative flex h-2 w-2">
                  {isConnected && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
                  <span className={cn("relative inline-flex h-2 w-2 rounded-full", isConnected ? "bg-emerald-500" : "bg-slate-400")} />
                </span>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {isConnected ? "Live" : "Offline"}
                </span>
                {alerts > 0 && (
                  <span className="ml-auto flex items-center gap-1 text-xs font-semibold text-rose-500">
                    <Bell className="h-3 w-3" />
                    {alerts}
                  </span>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <AnimatePresence>
              {!collapsed && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white">
                    {user?.email?.[0]?.toUpperCase() ?? "U"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-ink-900 dark:text-slate-200">{user?.full_name ?? user?.email?.split("@")[0]}</p>
                    <p className="text-[10px] capitalize text-slate-400">{user?.role}</p>
                  </div>
                  <button onClick={() => logout()} className="shrink-0 text-slate-400 hover:text-rose-500 transition-colors">
                    <LogOut className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="absolute -right-3 top-16 flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm text-slate-400 hover:text-slate-700 dark:border-slate-700 dark:bg-ink-900 dark:hover:text-slate-200 transition-colors"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </motion.aside>

      {/* ── Main content ── */}
      <motion.div
        animate={{ marginLeft: sidebarW }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="flex min-h-screen flex-1 flex-col"
      >
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-slate-200/60 bg-white/70 px-6 backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70">
          <div className="flex items-center gap-3">
            <Activity className="h-4 w-4 text-brand-500" />
            <span className="text-sm font-semibold text-ink-900 dark:text-slate-200">
              {NAV.find((n) => n.to === location.pathname)?.label ?? "ForecastFlow AI"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {alerts > 0 && (
              <NavLink to="/analytics" className="flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 hover:bg-rose-100 transition-colors">
                <Bell className="h-3 w-3" />
                {alerts} alert{alerts !== 1 ? "s" : ""}
              </NavLink>
            )}
            <button
              onClick={() => setCmdOpen(true)}
              className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-medium text-slate-500 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-ink-900/80 dark:text-slate-400 dark:hover:bg-slate-800 sm:flex transition-colors"
            >
              <Command className="h-3 w-3" />
              <span>⌘K</span>
            </button>
          </div>
        </header>

        {/* Page */}
        <AnimatePresence mode="wait">
          <motion.main
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="relative z-10 flex-1 p-6"
          >
            {children}
          </motion.main>
        </AnimatePresence>
      </motion.div>

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
    </div>
  );
}
