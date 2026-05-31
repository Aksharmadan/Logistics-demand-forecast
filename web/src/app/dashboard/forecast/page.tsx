"use client";

import * as React from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Sparkles } from "lucide-react";
import { apiJson } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type Rich = {
  predictions: {
    forecast_date: string;
    region: string;
    predicted_demand: number;
    lower_95: number;
    upper_95: number;
  }[];
  best_model?: string;
  explain?: { narrative: string; top_drivers: { feature: string; score: number }[] };
  feature_importance?: { feature: string; importance: number }[];
};

export default function ForecastStudioPage() {
  const [horizon, setHorizon] = React.useState(14);
  const [data, setData] = React.useState<Rich | null>(null);
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const r = await apiJson<Rich>("/predict/rich", {
        method: "POST",
        body: JSON.stringify({ horizon_days: horizon }),
      });
      setData(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed");
      setData(null);
    } finally {
      setBusy(false);
    }
  }

  const chartData =
    data?.predictions.map((p) => ({
      d: p.forecast_date.slice(5),
      mid: p.predicted_demand,
      low: p.lower_95,
      high: p.upper_95,
    })) ?? [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Forecast studio</h1>
        <p className="text-muted-foreground">Confidence intervals + explainable drivers for the first horizon step.</p>
      </div>

      <Card className="glass-panel">
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <CardTitle>Horizon run</CardTitle>
            <CardDescription>POST /predict/rich</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="number"
              min={1}
              max={90}
              className="w-24"
              value={horizon}
              onChange={(e) => setHorizon(Number(e.target.value))}
            />
            <Button variant="glow" onClick={() => void run()} disabled={busy}>
              {busy ? "Computing…" : "Generate"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {err && <p className="text-sm text-destructive">{err}</p>}
          {data?.best_model && (
            <div className="flex flex-wrap gap-2">
              <Badge>Selected model: {data.best_model}</Badge>
              <Badge variant="secondary">
                <Sparkles className="mr-1 h-3 w-3" />
                XAI narrative
              </Badge>
            </div>
          )}
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                <XAxis dataKey="d" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 12 }} />
                <Line type="monotone" dataKey="high" stroke="hsl(var(--primary) / 0.35)" strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="low" stroke="hsl(var(--primary) / 0.35)" strokeDasharray="4 4" dot={false} />
                <Line type="monotone" dataKey="mid" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {data?.explain && (
            <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
              <p className="text-sm font-medium">Why this shape?</p>
              <p className="mt-2 text-sm text-muted-foreground">{data.explain.narrative}</p>
              <ul className="mt-3 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                {data.explain.top_drivers.map((d) => (
                  <li key={d.feature}>
                    <span className="font-medium text-foreground">{d.feature}</span> · score {d.score.toFixed(2)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data?.feature_importance && data.feature_importance.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium">Global feature importance (winner)</p>
              <div className="flex flex-wrap gap-2">
                {data.feature_importance.map((f) => (
                  <Badge key={f.feature} variant="outline">
                    {f.feature}: {(f.importance * 100).toFixed(1)}%
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
