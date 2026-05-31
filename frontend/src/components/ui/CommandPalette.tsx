import { AnimatePresence, motion } from "framer-motion";
import { Search, LayoutDashboard, TrendingUp, BarChart3, UploadCloud, ShieldCheck, Bot, Truck, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils";

const COMMANDS = [
  { id: "dashboard", label: "Go to Dashboard", icon: LayoutDashboard, path: "/", group: "Navigation" },
  { id: "predictions", label: "Open Forecasting Lab", icon: TrendingUp, path: "/predictions", group: "Navigation" },
  { id: "analytics", label: "Open Analytics", icon: BarChart3, path: "/analytics", group: "Navigation" },
  { id: "upload", label: "Upload Data", icon: UploadCloud, path: "/upload", group: "Navigation" },
  { id: "fleet", label: "Fleet Management", icon: Truck, path: "/fleet", group: "Navigation" },
  { id: "copilot", label: "Open AI Copilot", icon: Bot, path: "/copilot", group: "AI" },
  { id: "admin", label: "Admin Console", icon: ShieldCheck, path: "/admin", group: "Admin" },
];

interface Props {
  open: boolean;
  onClose: () => void;
}

export function CommandPalette({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = COMMANDS.filter(
    (c) =>
      c.label.toLowerCase().includes(query.toLowerCase()) ||
      c.group.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!open) return;
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, filtered.length - 1)); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
      if (e.key === "Enter" && filtered[selected]) {
        navigate(filtered[selected].path);
        onClose();
      }
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, filtered, selected, navigate, onClose]);

  const groups = [...new Set(filtered.map((c) => c.group))];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink-950/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ type: "spring", stiffness: 500, damping: 35 }}
            className="fixed left-1/2 top-[20%] z-50 w-full max-w-lg -translate-x-1/2"
          >
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-card-lg backdrop-blur-xl dark:border-slate-700/80 dark:bg-ink-900/95">
              {/* Search input */}
              <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
                <Search className="h-4 w-4 shrink-0 text-slate-400" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
                  placeholder="Search commands…"
                  className="flex-1 bg-transparent text-sm text-ink-900 placeholder-slate-400 outline-none dark:text-slate-100"
                />
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Results */}
              <div className="max-h-72 overflow-y-auto p-2">
                {filtered.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-400">No commands found</p>
                )}
                {groups.map((group) => (
                  <div key={group}>
                    <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                      {group}
                    </p>
                    {filtered
                      .filter((c) => c.group === group)
                      .map((cmd) => {
                        const Icon = cmd.icon;
                        const idx = filtered.indexOf(cmd);
                        return (
                          <button
                            key={cmd.id}
                            onMouseEnter={() => setSelected(idx)}
                            onClick={() => { navigate(cmd.path); onClose(); }}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                              selected === idx
                                ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                                : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50"
                            )}
                          >
                            <Icon className="h-4 w-4 shrink-0" />
                            {cmd.label}
                          </button>
                        );
                      })}
                  </div>
                ))}
              </div>

              <div className="border-t border-slate-100 px-4 py-2 dark:border-slate-800">
                <p className="text-[10px] text-slate-400">
                  <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] dark:bg-slate-800">↑↓</kbd> navigate &nbsp;
                  <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] dark:bg-slate-800">↵</kbd> select &nbsp;
                  <kbd className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[10px] dark:bg-slate-800">esc</kbd> close
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
