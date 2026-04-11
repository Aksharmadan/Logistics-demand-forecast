import { motion } from "framer-motion";
import { useState } from "react";
import { apiJson } from "../api/client";

type PredictResponse = {
  predictions: { forecast_date: string; region: string; predicted_demand: number }[];
  model_trained_at: string | null;
};

export function PredictionsPage() {
  const [horizon, setHorizon] = useState(14);
  const [data, setData] = useState<PredictResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const r = await apiJson<PredictResponse>("/predict", {
        method: "POST",
        body: JSON.stringify({ horizon_days: horizon }),
      });
      setData(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Prediction failed");
      setData(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink-900">Forecasts</h1>
        <p className="mt-1 text-slate-600">Horizon projections per region using the latest trained model artifact.</p>
      </div>

      <motion.div
        className="flex flex-wrap items-end gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div>
          <label className="block text-xs font-medium text-slate-600">Horizon (days)</label>
          <input
            type="number"
            min={1}
            max={90}
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
            className="mt-1 w-28 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          onClick={() => void run()}
          disabled={busy}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "Running…" : "Run prediction"}
        </button>
        {data?.model_trained_at && (
          <p className="text-xs text-slate-500">Model trained: {new Date(data.model_trained_at).toLocaleString()}</p>
        )}
      </motion.div>

      {err && <p className="text-sm text-rose-600">{err}</p>}

      {data && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-card">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Region</th>
                <th className="px-4 py-3">Predicted demand</th>
              </tr>
            </thead>
            <tbody>
              {data.predictions.map((p, i) => (
                <tr key={`${p.forecast_date}-${p.region}-${i}`} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-2 text-slate-700">{p.forecast_date}</td>
                  <td className="px-4 py-2 font-medium">{p.region}</td>
                  <td className="px-4 py-2">{p.predicted_demand.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
