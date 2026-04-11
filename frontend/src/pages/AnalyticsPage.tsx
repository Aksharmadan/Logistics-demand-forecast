import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { apiFetch, apiJson } from "../api/client";

type Analytics = {
  summary: {
    total_demand_last_30d: number;
    growth_pct_vs_prior_30d: number;
    active_regions: number;
    open_alerts: number;
  };
  demand_over_time: { d: string; demand: number }[];
};

type Alert = {
  id: number;
  alert_date: string;
  region: string;
  severity: string;
  message: string;
  acknowledged: boolean;
};

export function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [a, al] = await Promise.all([
      apiJson<Analytics>("/analytics"),
      apiJson<Alert[]>("/analytics/alerts"),
    ]);
    setData(a);
    setAlerts(al);
  }

  useEffect(() => {
    void refresh().catch(() => undefined);
  }, []);

  async function runAnomalies() {
    setBusy(true);
    try {
      await apiJson("/detect-anomalies", { method: "POST" });
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function ack(id: number) {
    await apiJson(`/analytics/alerts/${id}/ack`, { method: "POST" });
    await refresh();
  }

  async function exportFmt(fmt: "csv" | "pdf") {
    const res = await apiFetch(`/export/report?format=${fmt}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fmt === "csv" ? "demand_export.csv" : "demand_report.pdf";
    a.click();
    URL.revokeObjectURL(url);
  }

  const chartData =
    data?.demand_over_time.map((p) => ({
      date: p.d,
      demand: Math.round(p.demand),
    })) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="font-display text-3xl font-semibold text-ink-900">Analytics</h1>
          <p className="mt-1 text-slate-600">Deep dive, anomaly workflow, and exports.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void runAnomalies()}
            disabled={busy}
            className="rounded-xl bg-amber-500 px-3 py-2 text-sm font-semibold text-ink-900 hover:bg-amber-400 disabled:opacity-50"
          >
            {busy ? "Scanning…" : "Run anomaly detection"}
          </button>
          <button
            type="button"
            onClick={() => void exportFmt("csv")}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => void exportFmt("pdf")}
            className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Export PDF
          </button>
        </div>
      </div>

      {data && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">30d volume</p>
            <p className="mt-1 font-display text-2xl font-semibold">{Math.round(data.summary.total_demand_last_30d).toLocaleString()}</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Growth</p>
            <p className="mt-1 font-display text-2xl font-semibold">{data.summary.growth_pct_vs_prior_30d.toFixed(1)}%</p>
          </div>
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-card">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Regions / alerts</p>
            <p className="mt-1 font-display text-2xl font-semibold">
              {data.summary.active_regions} / {data.summary.open_alerts}
            </p>
          </div>
        </div>
      )}

      <motion.section
        className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <h2 className="font-display text-lg font-semibold">Trend detail</h2>
        <div className="mt-4 h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 11 }} stroke="#94a3b8" />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="demand" name="Demand" stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.section>

      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card">
        <h2 className="font-display text-lg font-semibold">All alerts</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-wide text-slate-500">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Region</th>
                <th className="py-2 pr-4">Severity</th>
                <th className="py-2 pr-4">Message</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-3 pr-4">{a.alert_date}</td>
                  <td className="py-3 pr-4 font-medium">{a.region}</td>
                  <td className="py-3 pr-4">{a.severity}</td>
                  <td className="py-3 pr-4 text-slate-600">{a.message}</td>
                  <td className="py-3 text-right">
                    {!a.acknowledged && (
                      <button
                        type="button"
                        onClick={() => void ack(a.id)}
                        className="text-xs font-semibold text-brand-600 hover:underline"
                      >
                        Acknowledge
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
