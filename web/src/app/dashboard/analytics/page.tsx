"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
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
import { Filter } from "lucide-react";
import { apiJson } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Analytics = {
  summary: {
    total_demand_last_30d: number;
    growth_pct_vs_prior_30d: number;
    active_regions: number;
    open_alerts: number;
  };
  demand_over_time: { d: string; demand: number }[];
  heatmap: { region: string; week_start: string; intensity: number }[];
};

type Decomp = {
  observed: { d: string; v: number }[];
  trend: { d: string; v: number }[];
  seasonal: { d: string; v: number }[];
  residual: { d: string; v: number }[];
  message?: string;
};

type FcAct = { points: { d: string; actual: number; naive_forecast: number | null }[] };

function AnalyticsInner() {
  const sp = useSearchParams();
  const initialRegion = sp.get("region") ?? "";

  const [region, setRegion] = React.useState(initialRegion);
  const [sku, setSku] = React.useState("");
  const [data, setData] = React.useState<Analytics | null>(null);
  const [decomp, setDecomp] = React.useState<Decomp | null>(null);
  const [fc, setFc] = React.useState<FcAct | null>(null);
  const [loading, setLoading] = React.useState(true);

  const qs = React.useMemo(() => {
    const p = new URLSearchParams();
    if (region) p.set("region", region);
    if (sku) p.set("sku", sku);
    return p.toString() ? `?${p.toString()}` : "";
  }, [region, sku]);

  React.useEffect(() => {
    let c = false;
    (async () => {
      setLoading(true);
      try {
        const [a, d, f] = await Promise.all([
          apiJson<Analytics>(`/analytics${qs}`),
          apiJson<Decomp>(`/analytics/decomposition${region ? `?region=${encodeURIComponent(region)}` : ""}`),
          apiJson<FcAct>(`/analytics/forecast-vs-actual${region ? `?region=${encodeURIComponent(region)}` : ""}`),
        ]);
        if (!c) {
          setData(a);
          setDecomp(d);
          setFc(f);
        }
      } catch {
        if (!c) setData(null);
      } finally {
        if (!c) setLoading(false);
      }
    })();
    return () => {
      c = true;
    };
  }, [qs, region]);

  const heatRegions = React.useMemo(() => {
    if (!data?.heatmap.length) return { regions: [] as string[], weeks: [] as string[], cells: data?.heatmap ?? [] };
    const cells = data.heatmap;
    const regions = Array.from(new Set(cells.map((c) => c.region))).slice(0, 10);
    const weeks = Array.from(new Set(cells.map((c) => c.week_start))).sort().slice(-12);
    return { regions, weeks, cells };
  }, [data]);

  const decompChart =
    decomp?.trend?.map((t, i) => ({
      d: t.d.slice(5),
      trend: t.v,
      seasonal: decomp.seasonal[i]?.v ?? 0,
      observed: decomp.observed[i]?.v ?? 0,
    })) ?? [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics+</h1>
          <p className="text-muted-foreground">Filters, STL decomposition, forecast vs actual baseline.</p>
        </div>
        <Card className="glass-panel w-full max-w-xl border-dashed">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">Region</label>
              <Input placeholder="e.g. North Hub" value={region} onChange={(e) => setRegion(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs text-muted-foreground">SKU</label>
              <Input placeholder="optional" value={sku} onChange={(e) => setSku(e.target.value)} />
            </div>
            <Button variant="secondary" size="icon" title="Apply filters">
              <Filter className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Refreshing…</p>}

      {data && (
        <div className="grid gap-4 sm:grid-cols-4">
          {[
            ["30d vol", Math.round(data.summary.total_demand_last_30d).toLocaleString()],
            ["Growth", `${data.summary.growth_pct_vs_prior_30d.toFixed(1)}%`],
            ["Regions", String(data.summary.active_regions)],
            ["Alerts", String(data.summary.open_alerts)],
          ].map(([k, v]) => (
            <Card key={k} className="glass-panel">
              <CardHeader className="pb-2">
                <CardDescription>{k}</CardDescription>
                <CardTitle className="text-xl">{v}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}

      <Tabs defaultValue="heatmap">
        <TabsList>
          <TabsTrigger value="heatmap">Heatmap</TabsTrigger>
          <TabsTrigger value="decomp">Decomposition</TabsTrigger>
          <TabsTrigger value="fc">Forecast vs actual</TabsTrigger>
        </TabsList>
        <TabsContent value="heatmap" className="mt-4">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle>Region × week</CardTitle>
              <CardDescription>Drill-down from overview — filtered dataset</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: `140px repeat(${heatRegions.weeks.length}, minmax(0,1fr))` }}
              >
                <div />
                {heatRegions.weeks.map((w) => (
                  <div key={w} className="truncate text-center text-[10px] text-muted-foreground">
                    {w.slice(5)}
                  </div>
                ))}
                {heatRegions.regions.map((r) => (
                  <React.Fragment key={r}>
                    <Link
                      href={`/dashboard/analytics?region=${encodeURIComponent(r)}`}
                      className="truncate pr-2 text-xs font-medium text-primary hover:underline"
                    >
                      {r}
                    </Link>
                    {heatRegions.weeks.map((w) => {
                      const cell = heatRegions.cells.find((c) => c.region === r && c.week_start === w);
                      const v = cell?.intensity ?? 0;
                      return (
                        <div
                          key={`${r}-${w}`}
                          className="h-8 rounded-md border border-border/30"
                          style={{ background: `hsl(var(--primary) / ${0.12 + v * 0.65})` }}
                          title={`${r} ${w}`}
                        />
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="decomp" className="mt-4">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle>STL decomposition</CardTitle>
              <CardDescription>Trend + seasonality + residual (statsmodels)</CardDescription>
            </CardHeader>
            <CardContent className="h-96">
              {decomp?.message && <p className="text-sm text-muted-foreground">{decomp.message}</p>}
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={decompChart}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                  <XAxis dataKey="d" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: 12 }} />
                  <Legend />
                  <Line type="monotone" dataKey="observed" stroke="#6366f1" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="trend" stroke="#0ea5e9" dot={false} />
                  <Line type="monotone" dataKey="seasonal" stroke="#a855f7" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="fc" className="mt-4">
          <Card className="glass-panel">
            <CardHeader>
              <CardTitle>Forecast vs actual</CardTitle>
              <CardDescription>Naive lag-1 benchmark — swap for model backtest when you log predictions</CardDescription>
            </CardHeader>
            <CardContent className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={fc?.points ?? []}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                  <XAxis dataKey="d" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip contentStyle={{ borderRadius: 12 }} />
                  <Legend />
                  <Line type="monotone" dataKey="actual" stroke="hsl(var(--primary))" dot={false} strokeWidth={2} />
                  <Line
                    type="monotone"
                    dataKey="naive_forecast"
                    stroke="hsl(var(--muted-foreground))"
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AnalyticsPlusPage() {
  return (
    <React.Suspense
      fallback={<p className="text-sm text-muted-foreground">Loading analytics workspace…</p>}
    >
      <AnalyticsInner />
    </React.Suspense>
  );
}
