"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Database } from "lucide-react";
import { apiFetch, apiJson } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";

export default function DataPipelinePage() {
  const [file, setFile] = React.useState<File | null>(null);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [trainBusy, setTrainBusy] = React.useState(false);
  const [trainOut, setTrainOut] = React.useState<string | null>(null);

  async function upload(e: React.FormEvent) {
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
      setMsg(ex instanceof Error ? ex.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  async function train() {
    setTrainBusy(true);
    setTrainOut(null);
    try {
      const r = await apiJson<{ message: string; rmse: number; mae: number; n_samples: number }>("/train-model", {
        method: "POST",
      });
      setTrainOut(`${r.message} · RMSE ${r.rmse.toFixed(2)} · MAE ${r.mae.toFixed(2)} · n=${r.n_samples}`);
    } catch (ex) {
      setTrainOut(ex instanceof Error ? ex.message : "Train failed");
    } finally {
      setTrainBusy(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Data pipeline</h1>
        <p className="text-muted-foreground">Ingest CSV, version models, power the premium stack.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="glass-panel h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                Upload
              </CardTitle>
              <CardDescription>Columns: date, region, demand — optional sku</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={upload} className="space-y-4">
                <Input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={!file || busy}>
                    {busy ? "Uploading…" : "Commit to warehouse"}
                  </Button>
                </div>
                {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
              </form>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <Card className="glass-panel h-full">
            <CardHeader>
              <CardTitle>Model arena</CardTitle>
              <CardDescription>HistGradientBoosting + XGBoost — auto winner + residual intervals</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={() => void train()} disabled={trainBusy} variant="glow">
                {trainBusy ? "Training…" : "Run ensemble training"}
              </Button>
              {trainBusy && <Skeleton className="h-16 w-full rounded-lg" />}
              {trainOut && <p className="text-sm leading-relaxed text-muted-foreground">{trainOut}</p>}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}
