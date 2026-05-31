import { motion, AnimatePresence } from "framer-motion";
import { FormEvent, useRef, useState } from "react";
import { apiFetch, apiJson } from "../api/client";
import { useToast } from "../components/ui/Toast";
import { UploadCloud, Cpu, Play, CheckCircle2, AlertCircle, FileText, Zap, RefreshCw } from "lucide-react";
import { cn } from "../lib/utils";

type TrainResult = {
  rmse: number; mae: number; mape: number; n_samples: number;
  xgb_rmse: number; lgb_rmse: number; ensemble_weights: number[];
  feature_importance: Record<string, number>;
};

const stagger = {
  container: { animate: { transition: { staggerChildren: 0.07 } } },
  item: { initial: { opacity: 0, y: 14 }, animate: { opacity: 1, y: 0 } },
};

export function UploadPage() {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ rows_inserted: number; auto_trained: boolean } | null>(null);
  const [trainBusy, setTrainBusy] = useState(false);
  const [trainResult, setTrainResult] = useState<TrainResult | null>(null);
  const [simBusy, setSimBusy] = useState(false);

  async function onUpload(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    setUploadBusy(true); setUploadResult(null);
    try {
      const fd = new FormData(); fd.append("file", file);
      const res = await apiFetch("/upload-data", { method: "POST", body: fd });
      const j = await res.json();
      if (!res.ok) throw new Error(j.detail || "Upload failed");
      setUploadResult(j);
      toast.success("Upload complete", `${j.rows_inserted} rows imported${j.auto_trained ? " · Model auto-retrained" : ""}`);
    } catch (ex) {
      toast.error("Upload failed", ex instanceof Error ? ex.message : "Unknown error");
    } finally { setUploadBusy(false); }
  }

  async function onTrain() {
    setTrainBusy(true); setTrainResult(null);
    try {
      const r = await apiJson<TrainResult>("/train-model", { method: "POST" });
      setTrainResult(r);
      toast.success("Model trained", `RMSE ${r.rmse.toFixed(2)} · MAPE ${r.mape.toFixed(1)}%`);
    } catch (ex) {
      toast.error("Training failed", ex instanceof Error ? ex.message : "Unknown error");
    } finally { setTrainBusy(false); }
  }

  async function onSimulate() {
    setSimBusy(true);
    try {
      const regions = ["North Hub", "South Hub", "East Metro", "West Coast", "Central"];
      await Promise.all(regions.map((region) =>
        apiJson("/ingest/simulated", {
          method: "POST",
          body: JSON.stringify({ region, base_demand: 150 + Math.random() * 200, noise: 30 }),
        })
      ));
      toast.success("Simulation complete", `Injected live ticks for ${regions.length} regions`);
    } catch (ex) {
      toast.error("Simulation failed", ex instanceof Error ? ex.message : "Unknown error");
    } finally { setSimBusy(false); }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.endsWith(".csv")) setFile(f);
    else toast.error("Invalid file", "Please drop a CSV file");
  }

  const topFeatures = trainResult
    ? Object.entries(trainResult.feature_importance).sort((a, b) => b[1] - a[1]).slice(0, 8)
    : [];

  return (
    <motion.div variants={stagger.container} initial="initial" animate="animate" className="mx-auto max-w-3xl space-y-6">

      {/* Header */}
      <motion.div variants={stagger.item}>
        <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-slate-50">Data Ingest</h1>
        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Upload demand history, train the ensemble model, or inject live simulated data</p>
      </motion.div>

      {/* Upload card */}
      <motion.div variants={stagger.item}
        className="rounded-2xl border border-slate-200/60 bg-white/70 p-6 shadow-card backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70">
        <div className="flex items-center gap-2 mb-5">
          <UploadCloud className="h-5 w-5 text-brand-500" />
          <h2 className="font-display text-base font-semibold text-ink-900 dark:text-slate-100">Upload CSV</h2>
        </div>

        <form onSubmit={onUpload} className="space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 transition-all",
              dragging
                ? "border-brand-400 bg-brand-50/60 dark:bg-brand-500/10"
                : file
                ? "border-emerald-400 bg-emerald-50/40 dark:bg-emerald-500/5"
                : "border-slate-200 hover:border-brand-300 hover:bg-slate-50/60 dark:border-slate-700 dark:hover:border-brand-600 dark:hover:bg-slate-800/30"
            )}
          >
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            {file ? (
              <>
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
                <p className="font-semibold text-emerald-700 dark:text-emerald-400">{file.name}</p>
                <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB · Click to change</p>
              </>
            ) : (
              <>
                <UploadCloud className={cn("h-10 w-10 transition-colors", dragging ? "text-brand-500" : "text-slate-300 dark:text-slate-600")} />
                <div className="text-center">
                  <p className="font-semibold text-slate-700 dark:text-slate-300">Drop CSV here or click to browse</p>
                  <p className="mt-1 text-xs text-slate-400">Required columns: <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">date</code>, <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">region</code>, <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">demand</code></p>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3">
            <button type="submit" disabled={!file || uploadBusy}
              className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-glow-sm hover:bg-brand-700 disabled:opacity-50 transition-all">
              {uploadBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
              {uploadBusy ? "Uploading…" : "Upload to Database"}
            </button>
            {file && (
              <button type="button" onClick={() => setFile(null)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors">
                Clear
              </button>
            )}
          </div>
        </form>

        <AnimatePresence>
          {uploadResult && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="mt-4 flex items-center gap-3 rounded-xl bg-emerald-50 p-4 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20">
              <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">{uploadResult.rows_inserted.toLocaleString()} rows imported</p>
                {uploadResult.auto_trained && <p className="text-xs text-emerald-600 dark:text-emerald-500">Model automatically retrained on new data</p>}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Train model card */}
      <motion.div variants={stagger.item}
        className="rounded-2xl border border-slate-200/60 bg-white/70 p-6 shadow-card backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70">
        <div className="flex items-center gap-2 mb-2">
          <Cpu className="h-5 w-5 text-violet-500" />
          <h2 className="font-display text-base font-semibold text-ink-900 dark:text-slate-100">Train Ensemble Model</h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
          Trains XGBoost + LightGBM ensemble with 25 engineered features including lag, rolling stats, EWM, and trend. Produces confidence intervals for all forecasts.
        </p>

        <button onClick={() => void onTrain()} disabled={trainBusy}
          className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50 transition-all shadow-sm">
          {trainBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {trainBusy ? "Training…" : "Train Model"}
        </button>

        <AnimatePresence>
          {trainResult && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { label: "RMSE", value: trainResult.rmse.toFixed(2) },
                  { label: "MAE", value: trainResult.mae.toFixed(2) },
                  { label: "MAPE", value: `${trainResult.mape.toFixed(1)}%` },
                  { label: "Samples", value: trainResult.n_samples.toLocaleString() },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/50">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
                    <p className="mt-1 font-display text-lg font-bold text-ink-900 dark:text-slate-100">{value}</p>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-amber-50/60 p-3 dark:bg-amber-500/5 border border-amber-100 dark:border-amber-500/20">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-500">XGBoost RMSE</p>
                  <p className="mt-1 font-display text-lg font-bold text-ink-900 dark:text-slate-100">{trainResult.xgb_rmse.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-400">Weight: {(trainResult.ensemble_weights[0] * 100).toFixed(0)}%</p>
                </div>
                <div className="rounded-xl bg-violet-50/60 p-3 dark:bg-violet-500/5 border border-violet-100 dark:border-violet-500/20">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-500">LightGBM RMSE</p>
                  <p className="mt-1 font-display text-lg font-bold text-ink-900 dark:text-slate-100">{trainResult.lgb_rmse.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-400">Weight: {(trainResult.ensemble_weights[1] * 100).toFixed(0)}%</p>
                </div>
              </div>

              {topFeatures.length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Top Features</p>
                  <div className="space-y-1.5">
                    {topFeatures.map(([name, imp]) => (
                      <div key={name} className="flex items-center gap-3">
                        <span className="w-28 truncate text-xs font-medium text-slate-600 dark:text-slate-400">{name}</span>
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }} animate={{ width: `${(imp * 100).toFixed(1)}%` }}
                            transition={{ duration: 0.5 }}
                            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-violet-500"
                          />
                        </div>
                        <span className="w-10 text-right text-xs font-mono text-slate-400">{(imp * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Simulate card */}
      <motion.div variants={stagger.item}
        className="rounded-2xl border border-slate-200/60 bg-white/70 p-6 shadow-card backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70">
        <div className="flex items-center gap-2 mb-2">
          <Play className="h-5 w-5 text-emerald-500" />
          <h2 className="font-display text-base font-semibold text-ink-900 dark:text-slate-100">Simulate Live Data</h2>
        </div>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
          Inject simulated demand ticks for all regions. Triggers real-time anomaly detection and WebSocket broadcasts.
        </p>
        <button onClick={() => void onSimulate()} disabled={simBusy}
          className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-all shadow-sm">
          {simBusy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {simBusy ? "Simulating…" : "Inject Live Ticks"}
        </button>
      </motion.div>
    </motion.div>
  );
}
