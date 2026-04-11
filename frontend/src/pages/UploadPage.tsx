import { motion } from "framer-motion";
import { FormEvent, useState } from "react";
import { apiFetch, apiJson } from "../api/client";

export function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [trainBusy, setTrainBusy] = useState(false);
  const [trainResult, setTrainResult] = useState<string | null>(null);

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setBusy(true);
    setMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await apiFetch("/upload-data", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.detail || "Upload failed");
      setMsg(`Imported ${j.rows_inserted} rows.`);
    } catch (ex) {
      setMsg(ex instanceof Error ? ex.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  async function onTrain() {
    setTrainBusy(true);
    setTrainResult(null);
    try {
      const r = await apiJson<{ rmse: number; mae: number; n_samples: number }>("/train-model", {
        method: "POST",
      });
      setTrainResult(`Trained on ${r.n_samples} samples. RMSE=${r.rmse.toFixed(2)}, MAE=${r.mae.toFixed(2)}`);
    } catch (ex) {
      setTrainResult(ex instanceof Error ? ex.message : "Train failed");
    } finally {
      setTrainBusy(false);
    }
  }

  async function onSimulated() {
    setBusy(true);
    setMsg(null);
    try {
      const r = await apiJson<{ demand_quantity: number }>("/ingest/simulated", {
        method: "POST",
        body: JSON.stringify({ region: "North Hub", base_demand: 180, noise: 40 }),
      });
      setMsg(`Simulated ingest: ${r.demand_quantity.toFixed(1)} units for North Hub today.`);
    } catch (ex) {
      setMsg(ex instanceof Error ? ex.message : "Simulated ingest failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink-900">Upload data</h1>
        <p className="mt-1 text-slate-600">
          CSV columns: <code className="rounded bg-slate-100 px-1">date</code>,{" "}
          <code className="rounded bg-slate-100 px-1">region</code>,{" "}
          <code className="rounded bg-slate-100 px-1">demand</code> (optional <code className="rounded bg-slate-100 px-1">sku</code>
          ).
        </p>
      </div>

      <motion.form
        onSubmit={onUpload}
        className="space-y-4 rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <label className="block text-sm font-medium text-slate-700">CSV file</label>
        <input
          type="file"
          accept=".csv"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-slate-600"
        />
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={!file || busy}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? "Uploading…" : "Upload to database"}
          </button>
          <button
            type="button"
            onClick={() => void onSimulated()}
            disabled={busy}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            Simulate live API tick
          </button>
        </div>
        {msg && <p className="text-sm text-slate-700">{msg}</p>}
      </motion.form>

      <motion.div
        className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-card"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h2 className="font-display text-lg font-semibold text-ink-900">Train forecasting model</h2>
        <p className="mt-1 text-sm text-slate-600">
          Uses gradient-boosted trees on calendar, lag, and rolling features. Produces RMSE / MAE on a holdout slice.
        </p>
        <button
          type="button"
          onClick={() => void onTrain()}
          disabled={trainBusy}
          className="mt-4 rounded-xl bg-ink-900 px-4 py-2 text-sm font-semibold text-white hover:bg-ink-800 disabled:opacity-50"
        >
          {trainBusy ? "Training…" : "Train model"}
        </button>
        {trainResult && <p className="mt-3 text-sm text-slate-700">{trainResult}</p>}
      </motion.div>
    </div>
  );
}
