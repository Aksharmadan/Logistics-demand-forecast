import Link from "next/link";
import { ArrowRight, BarChart3, Radio, Shield, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <div className="mesh-gradient min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-cyan-600 font-bold text-primary-foreground shadow-lg shadow-primary/30">
            NR
          </div>
          <span className="text-lg font-semibold tracking-tight">NexRoute Pulse</span>
        </div>
        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground md:flex">
          <Link href="/pricing" className="hover:text-foreground">
            Pricing
          </Link>
          <Link href="/docs" className="hover:text-foreground">
            Documentation
          </Link>
          <Link href="/login" className="hover:text-foreground">
            Sign in
          </Link>
        </nav>
        <Button asChild className="shadow-lg shadow-primary/25">
          <Link href="/login">Launch app</Link>
        </Button>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-12">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            AI-native logistics OS
          </p>
          <h1 className="bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-4xl font-bold tracking-tight text-transparent sm:text-6xl sm:leading-[1.05]">
            Demand forecasting that feels alive.
          </h1>
          <p className="mt-6 text-lg text-muted-foreground sm:text-xl">
            Multi-model ML, live streaming signals, explainable predictions, and executive-grade analytics — packaged
            like a Series A product.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Button size="lg" variant="glow" asChild>
              <Link href="/login">
                Start free trial <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/docs">Read the docs</Link>
            </Button>
          </div>
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Radio,
              title: "Live demand stream",
              body: "WebSocket-fed ticks simulate Kafka-style ingestion with glass dashboards that update in real time.",
            },
            {
              icon: BarChart3,
              title: "Model arena",
              body: "HistGradientBoosting vs XGBoost with auto-selection, Prophet aggregate benchmarks, and confidence bands.",
            },
            {
              icon: Shield,
              title: "Roles & governance",
              body: "JWT auth with Admin, Analyst, and Viewer roles — export trails and alert acknowledgements built in.",
            },
            {
              icon: Zap,
              title: "Scenario lab",
              body: "Stress-test +30% demand surges and see fleet & inventory implications instantly.",
            },
            {
              icon: Sparkles,
              title: "Predictive insights",
              body: "Auto-generated spike warnings and prescriptive recommendations per region.",
            },
            {
              icon: ArrowRight,
              title: "Investor-ready UI",
              body: "Glassmorphism, dark mode, micro-interactions, and onboarding that feels expensive.",
            },
          ].map((f, i) => (
            <div
              key={i}
              className="glass-panel group rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl"
            >
              <f.icon className="mb-4 h-8 w-8 text-primary transition-transform group-hover:scale-110" />
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </main>

      <footer className="border-t border-border/60 py-10 text-center text-sm text-muted-foreground">
        © {new Date().getFullYear()} NexRoute Pulse · Demo product for portfolio & coursework.
      </footer>
    </div>
  );
}
