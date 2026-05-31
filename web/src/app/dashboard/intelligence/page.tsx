"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { apiJson } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function IntelligencePage() {
  const [insights, setInsights] = React.useState<{ insights: { title: string; detail: string; severity: string }[] }>({
    insights: [],
  });
  const [recs, setRecs] = React.useState<{ recommendations: { action: string; rationale: string; priority: string }[] }>({
    recommendations: [],
  });
  const [log, setLog] = React.useState<{ events: { ts: string; type: string; region?: string }[] }>({ events: [] });
  const [mult, setMult] = React.useState([130]);
  const [scenario, setScenario] = React.useState<{ headline: string; delta_pct: number } | null>(null);
  const [scanBusy, setScanBusy] = React.useState(false);

  async function runAnomalyScan() {
    setScanBusy(true);
    try {
      await apiJson("/detect-anomalies", { method: "POST" });
      const c = await apiJson<{ events: typeof log.events }>("/intelligence/stream-log");
      setLog(c);
    } catch {
      /* ignore */
    } finally {
      setScanBusy(false);
    }
  }

  React.useEffect(() => {
    void (async () => {
      try {
        const [a, b, c] = await Promise.all([
          apiJson<{ insights: typeof insights.insights }>("/intelligence/insights"),
          apiJson<{ recommendations: typeof recs.recommendations }>("/intelligence/recommendations"),
          apiJson<{ events: typeof log.events }>("/intelligence/stream-log"),
        ]);
        setInsights(a);
        setRecs(b);
        setLog(c);
      } catch {
        /* ignore */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only bootstrap
  }, []);

  async function runScenario() {
    const m = mult[0] / 100;
    try {
      const r = await apiJson<{ headline: string; delta_pct: number }>("/intelligence/scenario/simulate", {
        method: "POST",
        body: JSON.stringify({ demand_multiplier: m, horizon_days: 14 }),
      });
      setScenario(r);
    } catch {
      setScenario(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Intelligence lab</h1>
        <p className="text-muted-foreground">Insights, prescriptions, streaming bus, and what-if demand.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" disabled={scanBusy} onClick={() => void runAnomalyScan()}>
          {scanBusy ? "Scanning…" : "Run isolation scan"}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Predictive insights</CardTitle>
            <CardDescription>Spike / softening narratives</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.insights.map((i, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-xl border border-border/50 p-3"
              >
                <div className="flex justify-between gap-2">
                  <p className="text-sm font-medium">{i.title}</p>
                  <Badge variant={i.severity === "high" ? "destructive" : "secondary"}>{i.severity}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{i.detail}</p>
              </motion.div>
            ))}
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>AI recommendations</CardTitle>
            <CardDescription>Heuristic prescriptions from recent slopes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recs.recommendations.map((r, idx) => (
              <div key={idx} className="rounded-xl border border-border/50 p-3">
                <p className="text-sm font-medium">{r.action}</p>
                <p className="mt-1 text-xs text-muted-foreground">{r.rationale}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Scenario simulator</CardTitle>
          <CardDescription>What if demand scales? (uses ensemble forecast baseline)</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex-1 space-y-2">
              <p className="text-sm text-muted-foreground">Demand multiplier: {(mult[0] / 100).toFixed(2)}×</p>
              <input
                type="range"
                min={80}
                max={180}
                value={mult[0]}
                onChange={(e) => setMult([Number(e.target.value)])}
                className="w-full accent-primary"
              />
            </div>
            <Button variant="glow" onClick={() => void runScenario()}>
              Run scenario
            </Button>
          </div>
          {scenario && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-muted-foreground">
              {scenario.headline}
            </motion.p>
          )}
        </CardContent>
      </Card>

      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Streaming bus (simulated)</CardTitle>
          <CardDescription>Kafka-style ring buffer — ingest + websocket ticks</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-56 rounded-lg border border-border/50">
            <div className="space-y-2 p-3 text-xs font-mono">
              {log.events.map((e, i) => (
                <div key={i} className="flex justify-between gap-2 text-muted-foreground">
                  <span>{e.ts}</span>
                  <span className="text-foreground">{e.type}</span>
                  <span>{e.region ?? ""}</span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
