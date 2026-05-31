import { AnimatePresence, motion } from "framer-motion";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid,
  ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine,
} from "recharts";
import { apiJson } from "../api/client";
import { KpiCard } from "../components/KpiCard";
import { useWebSocket } from "../hooks/useWebSocket";
import { Skeleton } from "../components/ui/Skeleton";
import { Badge } from "../components/ui/Badge";
import {
  Activity, AlertTriangle, Box, TrendingUp, Zap,
  BellRing, ArrowUpRight, ArrowDownRight, Cpu, Globe,
} from "lucide-react";
import { cn } from "../lib/utils";

const WS_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace("http", "ws") + "/ws/live"
  : "ws://127.0.0.1:8000/ws/live";

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
  demand_by_region: { region: string; total_demand: number; pct_of_total: number }[];
  demand_over_time: { d: string; demand: number; rolling_avg: number }[];
  heatmap: { region: string; week_start: string; intensity: number; raw_demand: number }[];
};

type Alert = {
  id: number;
  alert_date: string;
  region: string;
  severity: string;
  message: string;
  acknowledged: boolean;
};

type Insight = {
  type: string;
  title: string;
  body: string;
  region?: string;
  metric?: number;
  action?: string;
};

type LiveEvent = { type: string; ts: string; data?: any };

const insightColors: Record<string, string> = {
  critical: "border-l-rose-500 bg-rose-50/50 dark:bg-rose-500/5",
  warning: "border-l-amber-500 bg-amber-50/50 dark:bg-amber-500/5",
  info: "border-l-brand-500 bg-brand-50/50 dark:bg-brand-500/5",
  recommendation: "border-l-violet-500 bg-violet-50/50 dark:bg-violet-500/5",
};

const stagger = {
  container: { animate: { transition: { staggerChildren: 0.07 } } },
  item: { initial: { opacity: 0, y: 16 }, animate: { opacity: 1, y: 0 } },
};

export function DashboardPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const { isConnected, lastMessage } = useWebSocket(WS_URL);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiJson<Analytics>("/analytics"),
      apiJson<Alert[]>("/analytics/alerts"),
      apiJson<Insight[]>("/analytics/insights").catch(() => []),
    ]).then(([a, al, ins]) => {
      if (cancelled) return;
      setData(a);
      setAlerts(al.filter((x) => !x.acknowledged).slice(0, 6));
      setInsights(ins.slice(0, 5));
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!lastMessage) return;
    const ev = lastMessage as LiveEvent;

    if (ev.type === "demand_update" && data) {
      setData((prev) => prev ? {
        ...prev,
        summary: { ...prev.summary, total_demand_last_30d: prev.summary.total_demand_last_30d + (ev.data?.demand_quantity ?? 0) }
      } : prev);
    }
    if (ev.type === "anomaly_alert") {
      setAlerts((prev) => [{
        id: Date.now(), alert_date: new Date().toISOString().split("T")[0],
        region: ev.data?.region ?? "Unknown", severity: ev.data?.severity ?? "medium",
        message: ev.data?.message ?? "Anomaly detected", acknowledged: false,
      }, ...prev].slice(0, 6));
    }
    if (ev.type !== "ping") {
      setLiveEvents((prev) => [ev, ...prev].slice(0, 8));
    }
  }, [lastMessage]);

  const lineData = useMemo(() =>
    (data?.demand_over_time ?? []).map((p) => ({
      date: p.d.slice(5),
      demand: Math.round(p.demand),
      avg: Math.round(p.rolling_avg),
    })), [data]);

  const barData = useMemo(() =>
    (data?.demand_by_region ?? []).slice(0, 8).map((p) => ({
      region: p.region.length > 10 ? p.region.slice(0, 10) + "…" : p.region,
      demand: Math.round(p.total_demand),
      pct: p.pct_of_total,
    })), [data]);

  const heatmapMatrix = useMemo(() => {
    const cells = data?.heatmap ?? [];
    const regions = [...new Set(cells.map((c) => c.region))].slice(0, 8);
    const weeks = [...new Set(cells.map((c) => c.week_start))].sort().slice(-10);
    return { regions, weeks, cells };
  }, [data]);

  if (loading) return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 lg:col-span-2" />
        <Skeleton className="h-80" />
      </div>
    </div>
  );

  const growth = data?.summary.growth_pct_vs_prior_30d ?? 0;

  return (
    <motion.div variants={stagger.container} initial="initial" animate="animate" className="space-y-6">

      {/* Header */}
      <motion.div variants={stagger.item} className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-slate-50">Operations Center</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Real-time logistics intelligence</p>
        </div>
        <div className="flex items-center gap-2">
          {isConnected ? (
            <Badge variant="success" dot pulse>Live</Badge>
          ) : (
            <Badge variant="neutral" dot>Offline</Badge>
          )}
        </div>
      </motion.div>

      {/* KPI Row */}
      <motion.div variants={stagger.item} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="30d Demand Volume"
          value={data ? Math.round(data.summary.total_demand_last_30d) : 0}
          hint={`${(data?.summary.total_records ?? 0).toLocaleString()} total records`}
          accent="blue" icon={<Box className="h-5 w-5" />}
          trend={growth} animate
        />
        <KpiCard
          title="Avg Daily Demand"
          value={data ? Math.round(data.summary.avg_daily_demand) : 0}
          hint="Blended network average"
          accent="emerald" icon={<Activity className="h-5 w-5" />} animate
        />
        <KpiCard
          title="Active Regions"
          value={data?.summary.active_regions ?? 0}
          hint={`Peak: ${data?.summary.peak_region ?? "—"}`}
          accent="violet" icon={<Globe className="h-5 w-5" />} animate
        />
        <KpiCard
          title="Open Alerts"
          value={data?.summary.open_alerts ?? 0}
          hint="Anomaly & threshold flags"
          accent="rose" icon={<AlertTriangle className="h-5 w-5" />} animate
        />
      </motion.div>

      {/* Charts row */}
      <div className="grid gap-6 lg:grid-cols-5">
        {/* Demand over time */}
        <motion.section
          variants={stagger.item}
          className="rounded-2xl border border-slate-200/60 bg-white/70 p-5 shadow-card backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70 lg:col-span-3"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-semibold text-ink-900 dark:text-slate-100">Demand Over Time</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">90-day history with 7-day rolling average</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded-full bg-brand-500" /> Actual</span>
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded-full bg-violet-400 opacity-60" /> 7d Avg</span>
            </div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={lineData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gDemand" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gAvg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 32px -4px rgba(15,23,42,0.15)", background: "rgba(255,255,255,0.97)", fontSize: 12 }}
                  labelStyle={{ fontWeight: 600, color: "#0f172a" }}
                />
                <Area type="monotone" dataKey="avg" stroke="#8b5cf6" strokeWidth={1.5} fill="url(#gAvg)" dot={false} strokeDasharray="4 2" />
                <Area type="monotone" dataKey="demand" stroke="#0ea5e9" strokeWidth={2.5} fill="url(#gDemand)" dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: "#0284c7" }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        {/* Top regions */}
        <motion.section
          variants={stagger.item}
          className="rounded-2xl border border-slate-200/60 bg-white/70 p-5 shadow-card backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70 lg:col-span-2"
        >
          <h2 className="font-display text-base font-semibold text-ink-900 dark:text-slate-100 mb-4">Top Regions (30d)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="region" width={72} tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 32px -4px rgba(15,23,42,0.15)", background: "rgba(255,255,255,0.97)", fontSize: 12 }}
                  formatter={(v: number, _: string, props: any) => [`${v.toLocaleString()} (${props.payload.pct}%)`, "Demand"]}
                />
                <Bar dataKey="demand" fill="#0ea5e9" radius={[0, 6, 6, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.section>
      </div>

      {/* Bottom row */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Heatmap */}
        <motion.section
          variants={stagger.item}
          className="rounded-2xl border border-slate-200/60 bg-white/70 p-5 shadow-card backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70 lg:col-span-2"
        >
          <h2 className="font-display text-base font-semibold text-ink-900 dark:text-slate-100 mb-1">Region × Week Heatmap</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Normalized weekly demand intensity</p>
          <div className="overflow-x-auto">
            <div className="min-w-[400px]">
              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: `80px repeat(${heatmapMatrix.weeks.length}, minmax(0,1fr))` }}
              >
                <div />
                {heatmapMatrix.weeks.map((w) => (
                  <div key={w} className="truncate text-center text-[9px] font-medium text-slate-400">{w.slice(5)}</div>
                ))}
                {heatmapMatrix.regions.map((r) => (
                  <Fragment key={r}>
                    <div className="flex items-center truncate pr-2 text-xs font-medium text-slate-600 dark:text-slate-400">{r}</div>
                    {heatmapMatrix.weeks.map((w) => {
                      const cell = heatmapMatrix.cells.find((c) => c.region === r && c.week_start === w);
                      const v = cell?.intensity ?? 0;
                      return (
                        <motion.div
                          whileHover={{ scale: 1.15, zIndex: 10 }}
                          key={`${r}-${w}`}
                          className="h-7 rounded cursor-pointer"
                          style={{ background: `rgba(14,165,233,${0.08 + v * 0.85})` }}
                          title={`${r} @ ${w}: ${cell?.raw_demand?.toFixed(0) ?? 0} units`}
                        />
                      );
                    })}
                  </Fragment>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {/* Right column: alerts + live feed */}
        <div className="space-y-4">
          {/* AI Insights */}
          <motion.section
            variants={stagger.item}
            className="rounded-2xl border border-slate-200/60 bg-white/70 p-4 shadow-card backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70"
          >
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-brand-500" />
              <h2 className="font-display text-sm font-semibold text-ink-900 dark:text-slate-100">AI Insights</h2>
            </div>
            <div className="space-y-2">
              <AnimatePresence>
                {insights.length === 0 && (
                  <p className="text-xs text-slate-400 py-2">Upload data to generate insights.</p>
                )}
                {insights.map((ins, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={cn("rounded-xl border-l-2 p-3", insightColors[ins.type] ?? insightColors.info)}
                  >
                    <p className="text-xs font-semibold text-ink-900 dark:text-slate-200">{ins.title}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{ins.body}</p>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.section>

          {/* Live event feed */}
          <motion.section
            variants={stagger.item}
            className="rounded-2xl border border-slate-200/60 bg-white/70 p-4 shadow-card backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70"
          >
            <div className="flex items-center gap-2 mb-3">
              <Activity className="h-4 w-4 text-emerald-500" />
              <h2 className="font-display text-sm font-semibold text-ink-900 dark:text-slate-100">Live Feed</h2>
            </div>
            <div className="space-y-1.5 max-h-48 overflow-y-auto scrollbar-hide">
              <AnimatePresence>
                {liveEvents.length === 0 && (
                  <p className="text-xs text-slate-400 py-2">Waiting for live events…</p>
                )}
                {liveEvents.map((ev, i) => (
                  <motion.div
                    key={`${ev.ts}-${i}`}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-2 rounded-lg p-2 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <span className={cn("mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full",
                      ev.type === "anomaly_alert" ? "bg-rose-500" :
                      ev.type === "ai_insight" ? "bg-violet-500" :
                      ev.type === "vehicle_update" ? "bg-amber-500" : "bg-emerald-500"
                    )} />
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-ink-900 dark:text-slate-200 truncate">
                        {ev.type === "demand_update" && `Demand: ${ev.data?.region} — ${ev.data?.demand_quantity?.toFixed(0)} units`}
                        {ev.type === "anomaly_alert" && `Alert: ${ev.data?.region} (${ev.data?.severity})`}
                        {ev.type === "vehicle_update" && `Fleet: ${ev.data?.vehicle_id} → ${ev.data?.status}`}
                        {ev.type === "ai_insight" && ev.data?.message?.slice(0, 50)}
                        {ev.type === "kpi_update" && `KPI refresh — ${ev.data?.active_vehicles} vehicles active`}
                      </p>
                      <p className="text-[10px] text-slate-400">{new Date(ev.ts).toLocaleTimeString()}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </motion.section>
        </div>
      </div>

      {/* Alerts table */}
      {alerts.length > 0 && (
        <motion.section
          variants={stagger.item}
          className="rounded-2xl border border-slate-200/60 bg-white/70 p-5 shadow-card backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70"
        >
          <div className="flex items-center gap-2 mb-4">
            <BellRing className="h-4 w-4 text-rose-500" />
            <h2 className="font-display text-base font-semibold text-ink-900 dark:text-slate-100">Active Alerts</h2>
            <Badge variant="danger">{alerts.length}</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  <th className="pb-3 pr-4">Date</th>
                  <th className="pb-3 pr-4">Region</th>
                  <th className="pb-3 pr-4">Severity</th>
                  <th className="pb-3">Message</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {alerts.map((a) => (
                    <motion.tr
                      key={a.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0 }}
                      className="border-b border-slate-50 last:border-0 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors"
                    >
                      <td className="py-3 pr-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{a.alert_date}</td>
                      <td className="py-3 pr-4 text-sm font-semibold text-ink-900 dark:text-slate-200">{a.region}</td>
                      <td className="py-3 pr-4">
                        <Badge variant={a.severity === "high" ? "danger" : "warning"} dot pulse={a.severity === "high"}>
                          {a.severity}
                        </Badge>
                      </td>
                      <td className="py-3 text-xs text-slate-600 dark:text-slate-400 max-w-xs truncate">{a.message}</td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        </motion.section>
      )}
    </motion.div>
  );
}
