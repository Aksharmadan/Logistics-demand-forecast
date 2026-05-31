import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { apiJson } from "../api/client";
import { Download, Sparkles, TrendingUp, BarChart2, Info, RefreshCw, ChevronDown } from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Legend, ReferenceLine,
} from "recharts";
import { Badge } from "../components/ui/Badge";
import { Skeleton } from "../components/ui/Skeleton";
import { cn } from "../lib/utils";

type PredictPoint = {
  forecast_date: string;
  region: string;
  predicted_demand: number;
  lower_bound: number;
  upper_bound: number;
  confidence_level: number;
  xgb_pred: number;
  lgb_pred: number;
};

type PredictResponse = {
  predictions: PredictPoint[];
  model_trained_at: string | null;
  model_rmse: number | null;
  model_mae: number | null;
  model_mape: number | null;
};

type FeatureImportance = {
  features: { name: string; importance: number; rank: number }[];
  model_trained_at: string | null;
};

const REGIONS_COLORS = ["#0ea5e9","#8b5cf6","#10b981","#f59e0b","#ef4444","#06b6d4","#ec4899","#84cc16"];

const stagger = {
  container: { animate: { transition: { staggerChildren: 0.06 } } },
  item: { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } },
};

export function PredictionsPage() {
  const [horizon, setHorizon] = useState(14);
  const [confidence, setConfidence] = useState(0.9);
  const [data, setData] = useState<PredictResponse | null>(null);
  const [fi, setFi] = useState<FeatureImportance | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"chart" | "table" | "compare">("chart");
  const [selectedRegions, setSelectedRegions] = useState<string[]>([]);

  async function run() {
    setBusy(true); setErr(null);
    try {
      const [r, f] = await Promise.all([
        apiJson<PredictResponse>("/predict", {
          method: "POST",
          body: JSON.stringify({ horizon_days: horizon, confidence_level: confidence }),
        }),
        apiJson<FeatureImportance>("/model/feature-importance").catch(() => null),
      ]);
      setData(r);
      setFi(f);
      const regions = [...new Set(r.predictions.map((p) => p.region))];
      setSelectedRegions(regions.slice(0, 5));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Prediction failed");
    } finally {
      setBusy(false);
    }
  }

  function exportCsv() {
    if (!data) return;
    const header = "Date,Region,Predicted,Lower,Upper,XGB,LGB\n";
    const rows = data.predictions.map((p) =>
      `${p.forecast_date},${p.region},${p.predicted_demand.toFixed(2)},${p.lower_bound.toFixed(2)},${p.upper_bound.toFixed(2)},${p.xgb_pred.toFixed(2)},${p.lgb_pred.toFixed(2)}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "forecast.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  // Aggregate by date for network chart
  const networkChart = data
    ? Object.values(
        data.predictions.reduce((acc, p) => {
          if (!acc[p.forecast_date]) acc[p.forecast_date] = { date: p.forecast_date.slice(5), total: 0, lower: 0, upper: 0 };
          acc[p.forecast_date].total += p.predicted_demand;
          acc[p.forecast_date].lower += p.lower_bound;
          acc[p.forecast_date].upper += p.upper_bound;
          return acc;
        }, {} as Record<string, any>)
      )
    : [];

  // Per-region chart data
  const regions = data ? [...new Set(data.predictions.map((p) => p.region))] : [];
  const regionChart = data
    ? Object.values(
        data.predictions
          .filter((p) => selectedRegions.includes(p.region))
          .reduce((acc, p) => {
            if (!acc[p.forecast_date]) acc[p.forecast_date] = { date: p.forecast_date.slice(5) };
            acc[p.forecast_date][p.region] = p.predicted_demand;
            return acc;
          }, {} as Record<string, any>)
      )
    : [];

  // Model comparison chart
  const compareChart = data
    ? data.predictions.slice(0, 30).map((p) => ({
        date: p.forecast_date.slice(5),
        region: p.region,
        xgb: p.xgb_pred,
        lgb: p.lgb_pred,
        ensemble: p.predicted_demand,
      }))
    : [];

  return (
    <motion.div variants={stagger.container} initial="initial" animate="animate" className="space-y-6">

      {/* Header */}
      <motion.div variants={stagger.item} className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-slate-50">Forecasting Lab</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">XGBoost + LightGBM ensemble with confidence intervals</p>
        </div>
        {data && (
          <div className="flex items-center gap-2">
            <Badge variant="success" dot>Model Active</Badge>
            {data.model_mape != null && (
              <Badge variant="info">MAPE {data.model_mape.toFixed(1)}%</Badge>
            )}
          </div>
        )}
      </motion.div>

      {/* Controls */}
      <motion.div
        variants={stagger.item}
        className="rounded-2xl border border-slate-200/60 bg-white/70 p-5 shadow-card backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70"
      >
        <div className="flex flex-wrap items-end gap-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Horizon (days)</label>
            <div className="flex items-center gap-3">
              <input
                type="range" min={1} max={90} value={horizon}
                onChange={(e) => setHorizon(Number(e.target.value))}
                className="w-32 accent-brand-500"
              />
              <span className="w-10 text-center font-display text-lg font-bold text-brand-600 dark:text-brand-400">{horizon}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">Confidence</label>
            <div className="flex gap-2">
              {[0.8, 0.9, 0.95].map((c) => (
                <button
                  key={c}
                  onClick={() => setConfidence(c)}
                  className={cn(
                    "rounded-xl px-3 py-1.5 text-xs font-semibold transition-all",
                    confidence === c
                      ? "bg-brand-600 text-white shadow-glow-sm"
                      : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                  )}
                >
                  {(c * 100).toFixed(0)}%
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={() => void run()}
            disabled={busy}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-glow-sm hover:bg-brand-700 disabled:opacity-50 transition-all"
          >
            {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {busy ? "Generating…" : "Generate Forecast"}
          </button>

          {data && (
            <button onClick={exportCsv} className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors">
              <Download className="h-4 w-4" /> Export CSV
            </button>
          )}
        </div>

        {data?.model_trained_at && (
          <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-4 dark:border-slate-800">
            {[
              { label: "RMSE", value: data.model_rmse?.toFixed(2) },
              { label: "MAE", value: data.model_mae?.toFixed(2) },
              { label: "MAPE", value: data.model_mape != null ? `${data.model_mape.toFixed(1)}%` : null },
              { label: "Trained", value: new Date(data.model_trained_at).toLocaleDateString() },
            ].map(({ label, value }) => value && (
              <div key={label} className="text-xs">
                <span className="text-slate-400 dark:text-slate-500">{label}: </span>
                <span className="font-semibold text-ink-900 dark:text-slate-200">{value}</span>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {err && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl bg-rose-50 p-4 text-sm font-medium text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-200 dark:border-rose-500/20">
          {err}
        </motion.div>
      )}

      {busy && (
        <div className="space-y-4">
          <Skeleton className="h-80" />
          <div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div>
        </div>
      )}

      {data && !busy && (
        <motion.div variants={stagger.container} initial="initial" animate="animate" className="space-y-6">

          {/* View toggle */}
          <motion.div variants={stagger.item} className="flex gap-2">
            {(["chart", "compare", "table"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={cn(
                  "rounded-xl px-4 py-2 text-sm font-semibold capitalize transition-all",
                  view === v
                    ? "bg-ink-900 text-white dark:bg-slate-100 dark:text-ink-900"
                    : "border border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                )}
              >
                {v === "chart" ? "Network Forecast" : v === "compare" ? "Model Comparison" : "Data Table"}
              </button>
            ))}
          </motion.div>

          {/* Network forecast chart */}
          {view === "chart" && (
            <motion.section
              variants={stagger.item}
              className="rounded-2xl border border-slate-200/60 bg-white/70 p-6 shadow-card backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-base font-semibold text-ink-900 dark:text-slate-100">Network Demand Projection</h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{(confidence * 100).toFixed(0)}% confidence interval · {horizon}-day horizon</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-6 rounded-full bg-brand-500" /> Forecast</span>
                  <span className="flex items-center gap-1"><span className="inline-block h-2 w-6 rounded-full bg-brand-200 dark:bg-brand-800" /> CI Band</span>
                </div>
              </div>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={networkChart} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gForecast" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gBand" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#bae6fd" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#bae6fd" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 32px -4px rgba(15,23,42,0.15)", background: "rgba(255,255,255,0.97)", fontSize: 12 }}
                      formatter={(v: number, name: string) => [v.toFixed(0), name === "total" ? "Forecast" : name === "upper" ? "Upper CI" : "Lower CI"]}
                    />
                    <Area type="monotone" dataKey="upper" stroke="none" fill="url(#gBand)" />
                    <Area type="monotone" dataKey="lower" stroke="none" fill="white" fillOpacity={0.6} />
                    <Area type="monotone" dataKey="total" stroke="#0ea5e9" strokeWidth={2.5} fill="url(#gForecast)" dot={false} activeDot={{ r: 5, strokeWidth: 0 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Region selector */}
              <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Per-Region Breakdown</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {regions.map((r, i) => (
                    <button
                      key={r}
                      onClick={() => setSelectedRegions((prev) => prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r])}
                      className={cn(
                        "rounded-full px-3 py-1 text-xs font-semibold transition-all border",
                        selectedRegions.includes(r)
                          ? "text-white border-transparent"
                          : "border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400"
                      )}
                      style={selectedRegions.includes(r) ? { background: REGIONS_COLORS[i % REGIONS_COLORS.length] } : {}}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={regionChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 32px -4px rgba(15,23,42,0.15)", background: "rgba(255,255,255,0.97)", fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      {selectedRegions.map((r, i) => (
                        <Area key={r} type="monotone" dataKey={r} stroke={REGIONS_COLORS[i % REGIONS_COLORS.length]} strokeWidth={2} fill={REGIONS_COLORS[i % REGIONS_COLORS.length]} fillOpacity={0.08} dot={false} />
                      ))}
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </motion.section>
          )}

          {/* Model comparison */}
          {view === "compare" && (
            <motion.section
              variants={stagger.item}
              className="rounded-2xl border border-slate-200/60 bg-white/70 p-6 shadow-card backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70"
            >
              <h2 className="font-display text-base font-semibold text-ink-900 dark:text-slate-100 mb-1">XGBoost vs LightGBM vs Ensemble</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">First 30 predictions — individual model outputs vs ensemble</p>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={compareChart} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gEns" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" className="text-slate-200 dark:text-slate-800" vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 8px 32px -4px rgba(15,23,42,0.15)", background: "rgba(255,255,255,0.97)", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Area type="monotone" dataKey="xgb" name="XGBoost" stroke="#f59e0b" strokeWidth={1.5} fill="none" dot={false} strokeDasharray="4 2" />
                    <Area type="monotone" dataKey="lgb" name="LightGBM" stroke="#8b5cf6" strokeWidth={1.5} fill="none" dot={false} strokeDasharray="4 2" />
                    <Area type="monotone" dataKey="ensemble" name="Ensemble" stroke="#0ea5e9" strokeWidth={2.5} fill="url(#gEns)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Feature importance */}
              {fi && (
                <div className="mt-6 border-t border-slate-100 pt-5 dark:border-slate-800">
                  <h3 className="font-display text-sm font-semibold text-ink-900 dark:text-slate-100 mb-3">Feature Importance</h3>
                  <div className="space-y-2">
                    {fi.features.slice(0, 10).map((f) => (
                      <div key={f.name} className="flex items-center gap-3">
                        <span className="w-32 truncate text-xs font-medium text-slate-600 dark:text-slate-400">{f.name}</span>
                        <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${(f.importance * 100).toFixed(1)}%` }}
                            transition={{ duration: 0.6, delay: f.rank * 0.04 }}
                            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400"
                          />
                        </div>
                        <span className="w-12 text-right text-xs font-mono text-slate-500 dark:text-slate-400">{(f.importance * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.section>
          )}

          {/* Data table */}
          {view === "table" && (
            <motion.section
              variants={stagger.item}
              className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white/70 shadow-card backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70"
            >
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-100 bg-slate-50/60 dark:border-slate-800 dark:bg-slate-900/40">
                    <tr className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Region</th>
                      <th className="px-5 py-3 text-right">Forecast</th>
                      <th className="px-5 py-3 text-right">Lower CI</th>
                      <th className="px-5 py-3 text-right">Upper CI</th>
                      <th className="px-5 py-3 text-right">XGBoost</th>
                      <th className="px-5 py-3 text-right">LightGBM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                    {data.predictions.map((p, i) => (
                      <motion.tr
                        key={`${p.forecast_date}-${p.region}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: i * 0.01 }}
                        className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors"
                      >
                        <td className="px-5 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">{p.forecast_date}</td>
                        <td className="px-5 py-3 font-semibold text-ink-900 dark:text-slate-200">{p.region}</td>
                        <td className="px-5 py-3 text-right font-mono font-bold text-brand-600 dark:text-brand-400">{p.predicted_demand.toFixed(1)}</td>
                        <td className="px-5 py-3 text-right font-mono text-xs text-slate-400">{p.lower_bound.toFixed(1)}</td>
                        <td className="px-5 py-3 text-right font-mono text-xs text-slate-400">{p.upper_bound.toFixed(1)}</td>
                        <td className="px-5 py-3 text-right font-mono text-xs text-amber-600 dark:text-amber-400">{p.xgb_pred.toFixed(1)}</td>
                        <td className="px-5 py-3 text-right font-mono text-xs text-violet-600 dark:text-violet-400">{p.lgb_pred.toFixed(1)}</td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.section>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
