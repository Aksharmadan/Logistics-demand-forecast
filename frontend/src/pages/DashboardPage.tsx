import { motion } from "framer-motion";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiJson } from "../api/client";
import { KpiCard } from "../components/KpiCard";
import { useAuth } from "../auth/AuthContext";

type Analytics = {
  summary: {
    total_demand_last_30d: number;
    avg_daily_demand: number;
    growth_pct_vs_prior_30d: number;
    active_regions: number;
    open_alerts: number;
  };
  demand_by_region: { region: string; total_demand: number }[];
  demand_over_time: { d: string; demand: number }[];
  heatmap: { region: string; week_start: string; intensity: number }[];
};

type Alert = {
  id: number;
  alert_date: string;
  region: string;
  severity: string;
  message: string;
  acknowledged: boolean;
};

export function DashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<Analytics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [a, al] = await Promise.all([
          apiJson<Analytics>("/analytics"),
          apiJson<Alert[]>("/analytics/alerts"),
        ]);
        if (!cancelled) {
          setData(a);
          setAlerts(al.filter((x) => !x.acknowledged).slice(0, 5));
        }
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : "Failed to load");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const lineData = useMemo(
    () =>
      (data?.demand_over_time ?? []).map((p) => ({
        date: p.d,
        demand: Math.round(p.demand),
      })),
    [data]
  );

  const barData = useMemo(
    () =>
      (data?.demand_by_region ?? []).map((p) => ({
        region: p.region,
        demand: Math.round(p.total_demand),
      })),
    [data]
  );

  const heatmapMatrix = useMemo(() => {
    const cells = data?.heatmap ?? [];
    const regions = [...new Set(cells.map((c) => c.region))].slice(0, 8);
    const weeks = [...new Set(cells.map((c) => c.week_start))].sort().slice(-10);
    return { regions, weeks, cells };
  }, [data]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink-900">Operations dashboard</h1>
        <p className="mt-1 text-slate-600">
          Real-time demand signals for {user?.email?.split("@")[0] ?? "your team"} — last refresh:{" "}
          <span className="font-medium text-ink-800">{new Date().toLocaleString()}</span>
        </p>
      </div>

      {err && <p className="text-sm text-rose-600">{err}</p>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          title="30d demand volume"
          value={data ? `${Math.round(data.summary.total_demand_last_30d).toLocaleString()} u` : "—"}
          hint="Units across all regions"
          accent="blue"
        />
        <KpiCard
          title="Avg daily demand"
          value={data ? `${Math.round(data.summary.avg_daily_demand).toLocaleString()}` : "—"}
          hint="Blended network average"
          accent="emerald"
        />
        <KpiCard
          title="Growth vs prior 30d"
          value={data ? `${data.summary.growth_pct_vs_prior_30d.toFixed(1)}%` : "—"}
          hint="Network-level momentum"
          accent="amber"
        />
        <KpiCard
          title="Open alerts"
          value={data ? String(data.summary.open_alerts) : "—"}
          hint="Anomaly & threshold flags"
          accent="rose"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card lg:col-span-3"
        >
          <h2 className="font-display text-lg font-semibold text-ink-900">Demand over time</h2>
          <p className="text-sm text-slate-500">Aggregated daily shipments / handling units</p>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip />
                <Line type="monotone" dataKey="demand" stroke="#0284c7" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.section>

        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card lg:col-span-2"
        >
          <h2 className="font-display text-lg font-semibold text-ink-900">Top regions (30d)</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis type="category" dataKey="region" width={100} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip />
                <Bar dataKey="demand" fill="#0ea5e9" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.section>
      </div>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold text-ink-900">Region × week heatmap</h2>
        <p className="text-sm text-slate-500">Normalized intensity of weekly demand</p>
        <div className="mt-4 overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid gap-1" style={{ gridTemplateColumns: `120px repeat(${heatmapMatrix.weeks.length}, minmax(0,1fr))` }}>
              <div />
              {heatmapMatrix.weeks.map((w) => (
                <div key={w} className="truncate text-center text-[10px] font-medium text-slate-500">
                  {w.slice(5)}
                </div>
              ))}
              {heatmapMatrix.regions.map((r) => (
                <Fragment key={r}>
                  <div className="truncate pr-2 text-xs font-medium text-slate-700">{r}</div>
                  {heatmapMatrix.weeks.map((w) => {
                    const cell = heatmapMatrix.cells.find((c) => c.region === r && c.week_start === w);
                    const v = cell?.intensity ?? 0;
                    return (
                      <div
                        key={`${r}-${w}`}
                        className="h-8 rounded-md border border-slate-100"
                        style={{
                          background: `rgba(14, 165, 233, ${0.15 + v * 0.75})`,
                        }}
                        title={`${r} @ ${w}: ${(v * 100).toFixed(0)}%`}
                      />
                    );
                  })}
                </Fragment>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold text-ink-900">Recent alerts</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Region</th>
                <th className="py-2 pr-4">Severity</th>
                <th className="py-2">Message</th>
              </tr>
            </thead>
            <tbody>
              {alerts.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-slate-500">
                    No open alerts. Run anomaly detection after training a model.
                  </td>
                </tr>
              )}
              {alerts.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 pr-4 text-slate-700">{a.alert_date}</td>
                  <td className="py-3 pr-4 font-medium">{a.region}</td>
                  <td className="py-3 pr-4">
                    <span
                      className={
                        a.severity === "high"
                          ? "rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-800"
                          : "rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900"
                      }
                    >
                      {a.severity}
                    </span>
                  </td>
                  <td className="py-3 text-slate-600">{a.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
