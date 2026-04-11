"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Bell, Radio, TrendingUp, X } from "lucide-react";
import { apiJson } from "@/lib/api";
import { AnimatedCounter } from "@/components/animated-counter";
import { EmptyState } from "@/components/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tooltip as UITooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useLiveDemand } from "@/hooks/use-live-demand";

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
};

type Insight = { severity: string; title: string; detail: string; region: string };

export default function DashboardPage() {
  const [data, setData] = React.useState<Analytics | null>(null);
  const [insights, setInsights] = React.useState<Insight[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [err, setErr] = React.useState<string | null>(null);
  const [liveOn, setLiveOn] = React.useState(true);
  const [notifyOn, setNotifyOn] = React.useState(false);
  const [onboarding, setOnboarding] = React.useState(false);
  const { ticks, connected } = useLiveDemand(liveOn);

  React.useEffect(() => {
    const done = typeof window !== "undefined" && localStorage.getItem("nr_onboarding_done");
    setOnboarding(!done);
  }, []);

  React.useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const [a, ins] = await Promise.all([
          apiJson<Analytics>("/analytics"),
          apiJson<{ insights: Insight[] }>("/intelligence/insights"),
        ]);
        if (!cancel) {
          setData(a);
          setInsights(ins.insights ?? []);
        }
      } catch (e) {
        if (!cancel) setErr(e instanceof Error ? e.message : "Failed to load");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  React.useEffect(() => {
    if (!notifyOn || typeof window === "undefined" || !("Notification" in window)) return;
    const hi = insights.find((i) => i.severity === "high");
    if (hi && Notification.permission === "granted") {
      new Notification("NexRoute Pulse", { body: hi.title });
    }
  }, [insights, notifyOn]);

  async function enableNotify() {
    if (!("Notification" in window)) return;
    const p = await Notification.requestPermission();
    setNotifyOn(p === "granted");
  }

  const lineData =
    data?.demand_over_time.map((p) => ({ date: p.d, demand: Math.round(p.demand) })) ?? [];
  const barData = data?.demand_by_region.slice(0, 6).map((p) => ({ region: p.region, v: Math.round(p.total_demand) })) ?? [];
  const liveChartData = [...ticks]
    .slice(0, 20)
    .reverse()
    .map((t, i) => ({ i, v: t.demand_quantity, region: t.region }));

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  }

  if (err || !data) {
    return (
      <EmptyState
        icon={TrendingUp}
        title="No analytics yet"
        description="Upload historical CSV from the Data pipeline tab, then train the model to unlock this view."
        action={{ label: "Go to data pipeline", onClick: () => (window.location.href = "/dashboard/data") }}
      />
    );
  }

  return (
    <div className="space-y-8">
      <AnimatePresence>
        {onboarding && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="glass-panel relative flex flex-col gap-3 rounded-2xl border border-primary/20 p-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-sm font-semibold">Guided onboarding</p>
              <p className="text-sm text-muted-foreground">
                Upload `sample_demand.csv`, train once, then open Forecast studio for confidence bands + explainability.
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" asChild>
                <Link href="/dashboard/data">Start</Link>
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  localStorage.setItem("nr_onboarding_done", "1");
                  setOnboarding(false);
                }}
              >
                Dismiss
              </Button>
            </div>
            <button
              type="button"
              className="absolute right-2 top-2 rounded-md p-1 text-muted-foreground hover:bg-muted sm:hidden"
              onClick={() => setOnboarding(false)}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Command center</h1>
          <p className="text-muted-foreground">Live signals, KPIs, and predictive narratives.</p>
        </div>
        <div className="flex flex-wrap items-center gap-4 rounded-xl border border-border/60 bg-card/50 px-4 py-2 backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Radio className={`h-4 w-4 ${connected ? "animate-pulse-soft text-primary" : "text-muted-foreground"}`} />
            <span className="text-sm text-muted-foreground">Live stream</span>
            <Switch checked={liveOn} onCheckedChange={setLiveOn} />
          </div>
          <Separator orientation="vertical" className="hidden h-8 sm:block" />
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Push</span>
            <Button size="sm" variant="outline" onClick={() => void enableNotify()}>
              {notifyOn ? "On" : "Enable"}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "30d volume",
            value: data.summary.total_demand_last_30d,
            hint: "Network total",
            format: (n: number) => Math.round(n).toLocaleString() + " u",
          },
          {
            label: "Avg daily",
            value: data.summary.avg_daily_demand,
            hint: "Blended throughput",
            format: (n: number) => Math.round(n).toLocaleString(),
          },
          {
            label: "Growth Δ",
            value: data.summary.growth_pct_vs_prior_30d,
            hint: "vs prior 30d",
            format: (n: number) => `${n.toFixed(1)}%`,
          },
          {
            label: "Open alerts",
            value: data.summary.open_alerts,
            hint: "Needs review",
            format: (n: number) => String(Math.round(n)),
          },
        ].map((k) => (
          <motion.div key={k.label} whileHover={{ y: -3 }} transition={{ type: "spring", stiffness: 400, damping: 25 }}>
            <Card className="glass-panel overflow-hidden border-white/10">
              <CardHeader className="pb-2">
                <UITooltip>
                  <TooltipTrigger asChild>
                    <CardDescription className="cursor-help">{k.label}</CardDescription>
                  </TooltipTrigger>
                  <TooltipContent>{k.hint}</TooltipContent>
                </UITooltip>
                <CardTitle className="text-2xl tabular-nums">
                  <AnimatedCounter value={k.value} format={k.format} />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">{k.hint}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="glass-panel xl:col-span-2">
          <CardHeader>
            <CardTitle>Demand trajectory</CardTitle>
            <CardDescription>Historical aggregate — filters available in Analytics+</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            {lineData.length === 0 ? (
              <EmptyState icon={TrendingUp} title="No series" description="Add more dated rows." />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={lineData}>
                  <defs>
                    <linearGradient id="fillDemand" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))" }} />
                  <Area type="monotone" dataKey="demand" stroke="hsl(var(--primary))" fill="url(#fillDemand)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Live stream</CardTitle>
            <CardDescription>Simulated real-time ingestion</CardDescription>
          </CardHeader>
          <CardContent className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={liveChartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                <XAxis dataKey="i" hide />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  formatter={(v) => [Number(v).toFixed(1), "units"]}
                  labelFormatter={(i) => `Tick ${i}`}
                  contentStyle={{ borderRadius: 12 }}
                />
                <Bar dataKey="v" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} animationDuration={400} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Predictive insights</CardTitle>
            <CardDescription>Generated from multi-horizon forecasts</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {insights.length === 0 && <p className="text-sm text-muted-foreground">Train model to populate spike detection.</p>}
            {insights.map((ins, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="rounded-xl border border-border/60 bg-muted/20 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{ins.title}</p>
                  <Badge variant={ins.severity === "high" ? "destructive" : ins.severity === "medium" ? "warning" : "secondary"}>
                    {ins.severity}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{ins.detail}</p>
              </motion.div>
            ))}
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/intelligence">Open intelligence lab →</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="glass-panel">
          <CardHeader>
            <CardTitle>Regional mix</CardTitle>
            <CardDescription>Top corridors — click through for drill-down in Analytics+</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="region" width={100} tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ borderRadius: 12 }} />
                <Bar dataKey="v" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
