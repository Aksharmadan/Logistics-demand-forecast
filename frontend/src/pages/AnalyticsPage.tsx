import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid,
  Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
} from "recharts";
import { apiFetch, apiJson } from "../api/client";
import { useToast } from "../components/ui/Toast";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import {
  Download, FileText, ShieldAlert, CheckCircle2,
  TrendingUp, TrendingDown, Minus, BarChart3, Globe,
} from "lucide-react";
import { cn } from "../lib/utils";

type Analytics = {
  summary: {
    total_demand_last_30d: number;
    avg_daily_demand: number;
    growth_pct_vs_prior_30d: number;
    active_regions: number;
    open_alerts: number;
    total_records?: number;
    peak_region?: string;
    peak_demand?: number;
  };
  demand_over_time: { d: string; demand: number; rolling_avg: number }[];
  demand_by_region: { region: string; total_demand: number; pct_of_total: number }[];
};

type Alert = {
  id: number; alert_date: string; region: string;
  severity: string; message: string; acknowledged: boolean;
  expected_demand?: number; demand_quantity?: number; anomaly_score?: number;
};

type Insight = { type: string; title: string; body: string; region?: string; metric?: number; action?: string };

type RegionBreakdown = {
  region: string; total_30d: number; avg_daily: number;
  growth_pct: number; open_alerts: number; status: string;
};

const stagger = {
  container: { animate: { transition: { staggerChildren: 0.06 } } },
  item: { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } },
};

const SEVERITY_COLORS: Record<string, string> = {
  high: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
};

const STATUS_COLORS: Record<string, string> = {
  critical: "text-rose-500",
  warning: "text-amber-500",
  normal: "text-emerald-500",
};

export function AnalyticsPage() {
  const toast = useToast();
  const [data, setData] = useState<Analytics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [regions, setRegions] = useState<RegionBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanBusy, setScanBusy] = useState(false);
  const [tab, setTab] = useState<"overview" | "alerts" | "regions">("overview");

  async function refresh() {
    try {
      const [a, al, ins, rb] = await Promise.all([
        apiJson<Analytics>("/analytics"),
        apiJson<Alert[]>("/analytics/alerts"),
        apiJson<Insight[]>("/analytics/insights").catch(() => []),
        apiJson<RegionBreakdown[]>("/analytics/regional-breakdown").catch(() => []),
      ]);
      setData(a); setAlerts(al); setInsights(ins); setRegions(rb);
    } catch { toast.error("Failed to load analytics"); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  async function runScan() {
    setScanBusy(true);
    try {
      const r = await apiJson<{ new_alerts: number; records_scanned: number }>("/detect-anomalies", { method: "POST" });
      toast.success("Anomaly scan complete", `${r.new_alerts} new alerts from ${r.records_scanned} records`);
      await refresh();
    } catch (e) {
      toast.error("Scan failed", e instanceof Error ? e.message : "Unknown error");
    } finally { setScanBusy(false); }
  }

  async function ack(id: number) {
    await apiJson(`/analytics/alerts/${id}/ack`, { method: "POST" });
    setAlerts((prev) => prev.map((a) => a.id === id ? { ...a, acknowledged: true } : a));
    toast.success("Alert acknowledged");
  }

  async function exportFmt(fmt: "csv" | "pdf") {
    try {
      const res = await apiFetch(`/export/report?format=${fmt}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = fmt === "csv" ? "demand_export.csv" : "demand_report.pdf"; a.click();
      URL.revokeObjectURL(url);
      toast.success(`${fmt.toUpperCase()} exported`);
    } catch { toast.error("Export failed"); }
  }

  const chartData = data?.demand_over_time.map((p) => ({
    date: p.d.slice(5), demand: Math.round(p.demand), avg: Math.round(p.rolling_avg),
  })) ?? [];

  const barData = data?.demand_by_region.slice(0, 10).map((p) => ({
    region: p.region.length > 12 ? p.region.slice(0, 12) + "…" : p.region,
    demand: Math.round(p.total_demand), pct: p.pct_of_total,
  })) ?? [];

  const openAlerts = alerts.filter((a) => !a.acknowledged);
  const highAlerts = openAlerts.filter((a) => a.severity === "high");

  if (loading) return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
      <Skeleton className="h-80" />
    </div>
  );

  return (
    <motion.div variants={stagger.container} initial="initial" animate="animate" className="space-y-6">

      {/* Header */}
      <motion.div variants={stagger.item} className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-slate-50">Analytics</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Deep-dive demand intelligence & anomaly workflow</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => void runScan()} disabled={scanBusy}
            className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 transition-colors shadow-sm">
            <ShieldAlert className="h-4 w-4" />
            {scanBusy ? "Scanning…" : "Detect Anomalies"}
          </button>
          <button onClick={() => void exportFmt("csv")}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-ink-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
            <Download className="h-4 w-4" /> CSV
          </button>
          <button onClick={() => void exportFmt("pdf")}
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-ink-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
            <FileText className="h-4 w-4" /> PDF
          </button>
        </div>
      </motion.div>

      {/* Summary KPIs */}
      {data && (
        <motion.div variants={stagger.item} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "30d Volume", value: Math.round(data.summary.total_demand_last_30d).toLocaleString(), sub: `${(data.summary.total_records ?? 0).toLocaleString()} records` },
            { label: "Growth vs Prior 30d", value: `${data.summary.growth_pct_vs_prior_30d > 0 ? "+" : ""}${data.summary.growth_pct_vs_prior_30d.toFixed(1)}%`, sub: "Period-over-period", trend: data.summary.growth_pct_vs_prior_30d },
            { label: "Peak Region", value: data.summary.peak_region ?? "-", sub: `${Math.round(data.summary.peak_demand ?? 0).toLocaleString()} units` },
            { label: "Open Alerts", value: String(data.summary.open_alerts), sub: `${highAlerts.length} critical`, danger: data.summary.open_alerts > 0 },
          ].map(({ label, value, sub, trend, danger }) => (
            <div key={label} className={cn(
              "rounded-2xl border p-5 shadow-card backdrop-blur-xl transition-all",
              danger && data.summary.open_alerts > 0
                ? "border-rose-200/60 bg-rose-50/50 dark:border-rose-500/20 dark:bg-rose-500/5"
                : "border-slate-200/60 bg-white/70 dark:border-slate-800/60 dark:bg-ink-950/70"
            )}>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
              <p className="mt-1.5 font-display text-2xl font-bold text-ink-900 dark:text-slate-50">{value}</p>
              <div className="mt-1 flex items-center gap-1.5">
                {trend !== undefined && (
                  trend > 0 ? <TrendingUp className="h-3 w-3 text-emerald-500" /> :
                  trend < 0 ? <TrendingDown className="h-3 w-3 text-rose-500" /> :
                  <Minus className="h-3 w-3 text-slate-400" />
                )}
                <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p>
              </div>
            </div>
          ))}
        </motion.div>
      )}

      {/* Tab nav */}
      <motion.div variants={stagger.item} className="flex gap-1 rounded-xl border border-slate-200/60 bg-slate-100/60 p-1 dark:border-slate-800/60 dark:bg-slate-900/40 w-fit">
        {(["overview", "alerts", "regions"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition-all",
              tab === t
                ? "bg-white text-ink-900 shadow-sm dark:bg-ink-800 dark:text-slate-100"
                : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            )}>
            {t}
            {t === "alerts" && openAlerts.length > 0 && (
              <span className="ml-1.5 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{openAlerts.length}</span>
            )}
          </button>
        ))}
      </motion.div>

      {/* Overview tab */}
      {tab === "overview" && (
        <motion.div variants={stagger.container} initial="initial" animate="animate" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-5">
            {/* Time series */}
            <motion.section variants={stagger.item}
              className="rounded-2xl border border-slate-200/60 bg-white/70 p-5 shadow-card backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70 lg:col-span-3">
              <h2 className="font-display text-base font-semibold text-ink-900 dark:text-slate-100 mb-4">Demand Trend (90 days)</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gD" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 32px -4px rgba(15,23,42,0.15)", background: "rgba(255,255,255,0.97)", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="avg" name="7d Avg" stroke="#94a3b8" strokeWidth={1.5} fill="none" dot={false} strokeDasharray="4 2" />
                    <Area type="monotone" dataKey="demand" name="Demand" stroke="#6366f1" strokeWidth={2.5} fill="url(#gD)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </motion.section>

            {/* Region bar */}
            <motion.section variants={stagger.item}
              className="rounded-2xl border border-slate-200/60 bg-white/70 p-5 shadow-card backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70 lg:col-span-2">
              <h2 className="font-display text-base font-semibold text-ink-900 dark:text-slate-100 mb-4">Region Share (30d)</h2>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="region" width={72} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 32px -4px rgba(15,23,42,0.15)", background: "rgba(255,255,255,0.97)", fontSize: 12 }}
                      formatter={(v: number, _: string, props: any) => [`${v.toLocaleString()} (${props.payload.pct}%)`, "Demand"]} />
                    <Bar dataKey="demand" radius={[0, 6, 6, 0]} barSize={18}>
                      {barData.map((_, i) => (
                        <Cell key={i} fill={`hsl(${200 + i * 15}, 80%, ${55 - i * 2}%)`} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.section>
          </div>

          {/* Insights */}
          {insights.length > 0 && (
            <motion.section variants={stagger.item}
              className="rounded-2xl border border-slate-200/60 bg-white/70 p-5 shadow-card backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70">
              <h2 className="font-display text-base font-semibold text-ink-900 dark:text-slate-100 mb-4">AI Operational Insights</h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {insights.map((ins, i) => (
                  <motion.div key={i} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                    className={cn("rounded-xl border-l-2 p-4",
                      ins.type === "critical" ? "border-l-rose-500 bg-rose-50/60 dark:bg-rose-500/5" :
                      ins.type === "warning" ? "border-l-amber-500 bg-amber-50/60 dark:bg-amber-500/5" :
                      "border-l-brand-500 bg-brand-50/60 dark:bg-brand-500/5"
                    )}>
                    <p className="text-xs font-bold text-ink-900 dark:text-slate-200">{ins.title}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{ins.body}</p>
                    {ins.action && <p className="mt-2 text-[11px] font-semibold text-brand-600 dark:text-brand-400">→ {ins.action}</p>}
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}
        </motion.div>
      )}

      {/* Alerts tab */}
      {tab === "alerts" && (
        <motion.section variants={stagger.item}
          className="rounded-2xl border border-slate-200/60 bg-white/70 shadow-card backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70 overflow-hidden">
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <h2 className="font-display text-base font-semibold text-ink-900 dark:text-slate-100">Anomaly Alerts</h2>
              {openAlerts.length > 0 && <Badge variant="danger">{openAlerts.length} open</Badge>}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/60 dark:bg-slate-900/40 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Region</th>
                  <th className="px-5 py-3">Severity</th>
                  <th className="px-5 py-3">Actual / Expected</th>
                  <th className="px-5 py-3">Message</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {alerts.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-sm text-slate-400">No alerts. Run anomaly detection to scan for issues.</td></tr>
                )}
                <AnimatePresence>
                  {alerts.map((a) => (
                    <motion.tr key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                      className={cn("hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors", a.acknowledged && "opacity-50")}>
                      <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">{a.alert_date}</td>
                      <td className="px-5 py-3.5 font-semibold text-ink-900 dark:text-slate-200">{a.region}</td>
                      <td className="px-5 py-3.5">
                        <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider", SEVERITY_COLORS[a.severity] ?? SEVERITY_COLORS.medium)}>
                          {a.severity}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-xs font-mono text-slate-600 dark:text-slate-400">
                        {a.demand_quantity?.toFixed(0) ?? "—"} / {a.expected_demand?.toFixed(0) ?? "—"}
                      </td>
                      <td className="px-5 py-3.5 text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate">{a.message}</td>
                      <td className="px-5 py-3.5 text-right">
                        {!a.acknowledged ? (
                          <button onClick={() => void ack(a.id)}
                            className="flex items-center gap-1.5 ml-auto rounded-lg px-3 py-1.5 text-xs font-bold text-brand-600 hover:bg-brand-50 dark:text-brand-400 dark:hover:bg-brand-500/10 transition-colors">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Acknowledge
                          </button>
                        ) : (
                          <span className="text-xs font-semibold text-emerald-500">✓ Resolved</span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </motion.section>
      )}

      {/* Regions tab */}
      {tab === "regions" && (
        <motion.section variants={stagger.item}
          className="rounded-2xl border border-slate-200/60 bg-white/70 shadow-card backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70 overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800">
            <h2 className="font-display text-base font-semibold text-ink-900 dark:text-slate-100">Regional Intelligence</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">30-day performance by region</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/60 dark:bg-slate-900/40 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="px-5 py-3">Region</th>
                  <th className="px-5 py-3 text-right">30d Volume</th>
                  <th className="px-5 py-3 text-right">Avg Daily</th>
                  <th className="px-5 py-3 text-right">Growth</th>
                  <th className="px-5 py-3 text-right">Alerts</th>
                  <th className="px-5 py-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {regions.length === 0 && (
                  <tr><td colSpan={6} className="py-12 text-center text-sm text-slate-400">No regional data available.</td></tr>
                )}
                {regions.map((r, i) => (
                  <motion.tr key={r.region} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-5 py-3.5 font-semibold text-ink-900 dark:text-slate-200">{r.region}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-sm text-ink-900 dark:text-slate-200">{r.total_30d.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right font-mono text-xs text-slate-500">{r.avg_daily.toFixed(1)}</td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={cn("flex items-center justify-end gap-1 text-xs font-semibold",
                        r.growth_pct > 0 ? "text-emerald-600 dark:text-emerald-400" :
                        r.growth_pct < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-400")}>
                        {r.growth_pct > 0 ? <TrendingUp className="h-3 w-3" /> : r.growth_pct < 0 ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                        {r.growth_pct > 0 ? "+" : ""}{r.growth_pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {r.open_alerts > 0
                        ? <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-500/20 dark:text-rose-300">{r.open_alerts}</span>
                        : <span className="text-xs text-slate-400">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className={cn("text-xs font-bold capitalize", STATUS_COLORS[r.status] ?? "text-slate-400")}>{r.status}</span>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.section>
      )}
    </motion.div>
  );
}
