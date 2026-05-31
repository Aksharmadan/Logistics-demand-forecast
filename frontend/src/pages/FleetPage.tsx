import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { apiJson } from "../api/client";
import { Truck, Zap, AlertTriangle, CheckCircle2, Clock, Wrench, RefreshCw } from "lucide-react";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { cn } from "../lib/utils";
import { useToast } from "../components/ui/Toast";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

type Vehicle = {
  id: number; vehicle_id: string; vehicle_type: string; region: string;
  status: string; capacity: number; current_load: number; utilization: number;
  lat: number | null; lng: number | null; fuel_level: number;
  total_deliveries: number; last_updated: string;
};

type FleetSummary = {
  total: number; active: number; en_route: number; idle: number;
  maintenance: number; avg_utilization: number; low_fuel_count: number;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ElementType; badge: "success" | "info" | "neutral" | "warning" }> = {
  active:      { label: "Active",      color: "text-emerald-500", icon: CheckCircle2, badge: "success" },
  en_route:    { label: "En Route",    color: "text-brand-500",   icon: Truck,        badge: "info" },
  idle:        { label: "Idle",        color: "text-slate-400",   icon: Clock,        badge: "neutral" },
  maintenance: { label: "Maintenance", color: "text-amber-500",   icon: Wrench,       badge: "warning" },
};

const PIE_COLORS = ["#10b981", "#0ea5e9", "#94a3b8", "#f59e0b"];

const stagger = {
  container: { animate: { transition: { staggerChildren: 0.04 } } },
  item: { initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 } },
};

export function FleetPage() {
  const toast = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [summary, setSummary] = useState<FleetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  async function load() {
    try {
      const [v, s] = await Promise.all([
        apiJson<Vehicle[]>("/fleet"),
        apiJson<FleetSummary>("/fleet/summary"),
      ]);
      setVehicles(v); setSummary(s);
    } catch { toast.error("Failed to load fleet data"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function updateStatus(vehicleId: string, status: string) {
    try {
      await apiJson(`/fleet/${vehicleId}/status?status=${status}`, { method: "PATCH" });
      setVehicles((prev) => prev.map((v) => v.vehicle_id === vehicleId ? { ...v, status } : v));
      toast.success("Status updated", `${vehicleId} → ${status}`);
    } catch { toast.error("Update failed"); }
  }

  const filtered = vehicles.filter((v) => {
    const matchFilter = filter === "all" || v.status === filter;
    const matchSearch = !search || v.vehicle_id.toLowerCase().includes(search.toLowerCase()) || v.region.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const pieData = summary ? [
    { name: "Active", value: summary.active },
    { name: "En Route", value: summary.en_route },
    { name: "Idle", value: summary.idle },
    { name: "Maintenance", value: summary.maintenance },
  ] : [];

  if (loading) return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-4">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
      <Skeleton className="h-96" />
    </div>
  );

  return (
    <motion.div variants={stagger.container} initial="initial" animate="animate" className="space-y-6">

      {/* Header */}
      <motion.div variants={stagger.item} className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-slate-50">Fleet Management</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{summary?.total ?? 0} vehicles across {[...new Set(vehicles.map((v) => v.region))].length} regions</p>
        </div>
        <button onClick={() => void load()} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors">
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </motion.div>

      {/* Summary KPIs */}
      {summary && (
        <motion.div variants={stagger.item} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Active", value: summary.active, icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
            { label: "En Route", value: summary.en_route, icon: Truck, color: "text-brand-500", bg: "bg-brand-50 dark:bg-brand-500/10" },
            { label: "Avg Utilization", value: `${summary.avg_utilization.toFixed(1)}%`, icon: Zap, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-500/10" },
            { label: "Low Fuel", value: summary.low_fuel_count, icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10" },
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

      <div className="grid gap-6 lg:grid-cols-4">
        {/* Pie chart */}
        <motion.div variants={stagger.item}
          className="rounded-2xl border border-slate-200/60 bg-white/70 p-5 shadow-card backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70">
          <h2 className="font-display text-sm font-semibold text-ink-900 dark:text-slate-100 mb-4">Fleet Status</h2>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: "12px", border: "none", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-2 space-y-1.5">
            {pieData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i] }} />
                  <span className="text-slate-600 dark:text-slate-400">{d.name}</span>
                </div>
                <span className="font-semibold text-ink-900 dark:text-slate-200">{d.value}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Vehicle table */}
        <motion.div variants={stagger.item}
          className="rounded-2xl border border-slate-200/60 bg-white/70 shadow-card backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70 overflow-hidden lg:col-span-3">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 p-4 dark:border-slate-800">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vehicle or region…"
              className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-1.5 text-sm text-ink-900 placeholder-slate-400 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:placeholder-slate-500 w-48"
            />
            <div className="flex gap-1.5">
              {["all", "active", "en_route", "idle", "maintenance"].map((s) => (
                <button key={s} onClick={() => setFilter(s)}
                  className={cn("rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-all",
                    filter === s
                      ? "bg-ink-900 text-white dark:bg-slate-100 dark:text-ink-900"
                      : "border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                  )}>
                  {s === "en_route" ? "En Route" : s}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto max-h-[480px] overflow-y-auto scrollbar-hide">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50/90 dark:bg-slate-900/90 backdrop-blur text-xs font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-4 py-3">Vehicle</th>
                  <th className="px-4 py-3">Region</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Utilization</th>
                  <th className="px-4 py-3">Fuel</th>
                  <th className="px-4 py-3 text-right">Deliveries</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {filtered.length === 0 && (
                  <tr><td colSpan={7} className="py-12 text-center text-sm text-slate-400">No vehicles match filter.</td></tr>
                )}
                <AnimatePresence>
                  {filtered.map((v) => {
                    const cfg = STATUS_CONFIG[v.status] ?? STATUS_CONFIG.idle;
                    const StatusIcon = cfg.icon;
                    return (
                      <motion.tr key={v.vehicle_id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                              <Truck className="h-3.5 w-3.5 text-slate-500" />
                            </div>
                            <div>
                              <p className="text-xs font-bold text-ink-900 dark:text-slate-200">{v.vehicle_id}</p>
                              <p className="text-[10px] capitalize text-slate-400">{v.vehicle_type}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-medium text-slate-600 dark:text-slate-400">{v.region}</td>
                        <td className="px-4 py-3">
                          <Badge variant={cfg.badge} dot>{cfg.label}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-20 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all",
                                  v.utilization > 85 ? "bg-rose-500" :
                                  v.utilization > 60 ? "bg-amber-500" : "bg-emerald-500"
                                )}
                                style={{ width: `${v.utilization}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono text-slate-500">{v.utilization.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 w-16 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                              <div
                                className={cn("h-full rounded-full", v.fuel_level < 25 ? "bg-rose-500" : "bg-brand-500")}
                                style={{ width: `${v.fuel_level}%` }}
                              />
                            </div>
                            <span className={cn("text-xs font-mono", v.fuel_level < 25 ? "text-rose-500" : "text-slate-500")}>{v.fuel_level.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-xs font-mono text-slate-500">{v.total_deliveries}</td>
                        <td className="px-4 py-3 text-right">
                          <select
                            value={v.status}
                            onChange={(e) => void updateStatus(v.vehicle_id, e.target.value)}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:bg-ink-900 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-brand-400"
                          >
                            <option value="active">Active</option>
                            <option value="en_route">En Route</option>
                            <option value="idle">Idle</option>
                            <option value="maintenance">Maintenance</option>
                          </select>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
