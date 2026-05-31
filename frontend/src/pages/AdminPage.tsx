import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiJson } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ui/Toast";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { Users, Activity, ShieldCheck, UserCog, BarChart3, Database, Cpu } from "lucide-react";
import { cn } from "../lib/utils";

type UserRow = { id: number; email: string; full_name: string | null; role: string; is_active: boolean; created_at: string };
type ActivityLog = { id: number; timestamp: string; action: string; user: string; resource: string; details: string; status: string };
type SystemStats = { total_users: number; active_users: number; total_demand_records: number; total_model_runs: number; last_model_trained: string | null; last_model_rmse: number | null };

const ROLE_BADGE: Record<string, "warning" | "info" | "neutral"> = { admin: "warning", analyst: "info", viewer: "neutral" };
const ACTION_COLORS: Record<string, string> = {
  data_upload: "bg-brand-500",
  model_trained: "bg-violet-500",
  anomaly_detection: "bg-amber-500",
  role_change: "bg-rose-500",
  copilot_query: "bg-emerald-500",
  forecast_generated: "bg-cyan-500",
};

const stagger = {
  container: { animate: { transition: { staggerChildren: 0.06 } } },
  item: { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } },
};

export function AdminPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role !== "admin") return;
    Promise.all([
      apiJson<UserRow[]>("/admin/users"),
      apiJson<ActivityLog[]>("/admin/activity"),
      apiJson<SystemStats>("/admin/system-stats"),
    ]).then(([u, l, s]) => { setUsers(u); setLogs(l); setStats(s); })
      .catch(() => toast.error("Failed to load admin data"))
      .finally(() => setLoading(false));
  }, [user?.role]);

  async function setRole(id: number, role: string) {
    try {
      await apiJson(`/admin/users/${id}/role?role=${encodeURIComponent(role)}`, { method: "PATCH" });
      setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role } : u));
      toast.success("Role updated");
    } catch { toast.error("Failed to update role"); }
  }

  if (user?.role !== "admin") return <Navigate to="/" replace />;

  if (loading) return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      <div className="grid gap-6 lg:grid-cols-3"><Skeleton className="h-96 lg:col-span-2" /><Skeleton className="h-96" /></div>
    </div>
  );

  return (
    <motion.div variants={stagger.container} initial="initial" animate="animate" className="space-y-6">

      {/* Header */}
      <motion.div variants={stagger.item}>
        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-slate-50">Admin Console</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">User management, system activity, and platform health</p>
      </motion.div>

      {/* System stats */}
      {stats && (
        <motion.div variants={stagger.item} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Total Users", value: stats.total_users, icon: Users, color: "text-brand-500", bg: "bg-brand-50 dark:bg-brand-500/10" },
            { label: "Demand Records", value: stats.total_demand_records.toLocaleString(), icon: Database, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-500/10" },
            { label: "Model Runs", value: stats.total_model_runs, icon: Cpu, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
            { label: "Last RMSE", value: stats.last_model_rmse?.toFixed(2) ?? "—", icon: BarChart3, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10" },
          ].map(({ label, value, icon: Icon, color, bg }) => (
            <div key={label} className="rounded-2xl border border-slate-200/60 bg-white/70 p-5 shadow-card backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                  <p className="mt-1.5 font-display text-2xl font-bold text-ink-900 dark:text-slate-50">{value}</p>
                </div>
                <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", bg)}>
                  <Icon className={cn("h-5 w-5", color)} />
                </div>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Users table */}
        <motion.div variants={stagger.item}
          className="rounded-2xl border border-slate-200/60 bg-white/70 shadow-card backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70 overflow-hidden lg:col-span-2">
          <div className="flex items-center gap-2 border-b border-slate-100 p-5 dark:border-slate-800">
            <Users className="h-4 w-4 text-brand-500" />
            <h2 className="font-display text-base font-semibold text-ink-900 dark:text-slate-100">User Directory</h2>
            <Badge variant="neutral">{users.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/60 dark:bg-slate-900/40 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3">User</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Change Role</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {users.map((u) => (
                  <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-600 text-xs font-bold text-white">
                          {u.email[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-ink-900 dark:text-slate-200">{u.email}</p>
                          <p className="text-xs text-slate-400">{u.full_name ?? "No name"}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={ROLE_BADGE[u.role] ?? "neutral"}>
                        {u.role === "admin" ? <ShieldCheck className="h-3 w-3" /> : <UserCog className="h-3 w-3" />}
                        {u.role}
                      </Badge>
                    </td>
                    <td className="px-5 py-4">
                      <Badge variant={u.is_active ? "success" : "neutral"} dot={u.is_active}>
                        {u.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <select value={u.role} onChange={(e) => void setRole(u.id, e.target.value)}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-ink-900 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-400">
                        <option value="viewer">Viewer</option>
                        <option value="analyst">Analyst</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>

        {/* Activity feed */}
        <motion.div variants={stagger.item}
          className="rounded-2xl border border-slate-200/60 bg-white/70 shadow-card backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 p-5 dark:border-slate-800">
            <Activity className="h-4 w-4 text-brand-500" />
            <h2 className="font-display text-base font-semibold text-ink-900 dark:text-slate-100">Audit Log</h2>
          </div>
          <div className="max-h-[480px] overflow-y-auto p-4 space-y-3 scrollbar-hide">
            {logs.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">No activity recorded yet.</p>
            )}
            <AnimatePresence>
              {logs.map((log, i) => (
                <motion.div key={log.id} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  className="relative pl-5 border-l-2 border-slate-100 dark:border-slate-800 py-1">
                  <div className={cn("absolute -left-[5px] top-2 h-2.5 w-2.5 rounded-full", ACTION_COLORS[log.action] ?? "bg-slate-400")} />
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    {new Date(log.timestamp).toLocaleString()}
                  </p>
                  <p className="text-xs font-semibold text-ink-900 dark:text-slate-200 capitalize mt-0.5">
                    {log.action.replace(/_/g, " ")}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">{log.user}</p>
                  {log.details && <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5 leading-relaxed">{log.details}</p>}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
