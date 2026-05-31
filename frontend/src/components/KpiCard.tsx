import { motion } from "framer-motion";
import { cn } from "../lib/utils";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type Accent = "blue" | "emerald" | "amber" | "rose" | "violet" | "cyan";

const accents: Record<Accent, { card: string; icon: string; value: string; glow: string }> = {
  blue: {
    card: "from-brand-500/8 to-brand-600/4 border-brand-200/60 dark:border-brand-500/20 dark:from-brand-500/15 dark:to-brand-900/10",
    icon: "bg-brand-100 text-brand-600 dark:bg-brand-500/20 dark:text-brand-400",
    value: "text-brand-600 dark:text-brand-400",
    glow: "hover:shadow-[0_0_20px_rgba(14,165,233,0.15)]",
  },
  emerald: {
    card: "from-emerald-500/8 to-emerald-600/4 border-emerald-200/60 dark:border-emerald-500/20 dark:from-emerald-500/15 dark:to-emerald-900/10",
    icon: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400",
    value: "text-emerald-600 dark:text-emerald-400",
    glow: "hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]",
  },
  amber: {
    card: "from-amber-500/8 to-amber-600/4 border-amber-200/60 dark:border-amber-500/20 dark:from-amber-500/15 dark:to-amber-900/10",
    icon: "bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400",
    value: "text-amber-600 dark:text-amber-400",
    glow: "hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]",
  },
  rose: {
    card: "from-rose-500/8 to-rose-600/4 border-rose-200/60 dark:border-rose-500/20 dark:from-rose-500/15 dark:to-rose-900/10",
    icon: "bg-rose-100 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400",
    value: "text-rose-600 dark:text-rose-400",
    glow: "hover:shadow-[0_0_20px_rgba(244,63,94,0.15)]",
  },
  violet: {
    card: "from-violet-500/8 to-violet-600/4 border-violet-200/60 dark:border-violet-500/20 dark:from-violet-500/15 dark:to-violet-900/10",
    icon: "bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400",
    value: "text-violet-600 dark:text-violet-400",
    glow: "hover:shadow-[0_0_20px_rgba(139,92,246,0.15)]",
  },
  cyan: {
    card: "from-cyan-500/8 to-cyan-600/4 border-cyan-200/60 dark:border-cyan-500/20 dark:from-cyan-500/15 dark:to-cyan-900/10",
    icon: "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400",
    value: "text-cyan-600 dark:text-cyan-400",
    glow: "hover:shadow-[0_0_20px_rgba(6,182,212,0.15)]",
  },
};

function AnimatedNumber({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<number>(0);

  useEffect(() => {
    const start = ref.current;
    const end = value;
    const duration = 800;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = start + (end - start) * eased;
      setDisplay(current);
      if (progress < 1) requestAnimationFrame(animate);
      else ref.current = end;
    };

    requestAnimationFrame(animate);
  }, [value]);

  return <>{Math.round(display).toLocaleString()}</>;
}

interface Props {
  title: string;
  value: string | number;
  hint?: string;
  accent?: Accent;
  icon?: ReactNode;
  trend?: number;
  animate?: boolean;
  loading?: boolean;
}

export function KpiCard({ title, value, hint, accent = "blue", icon, trend, animate = false, loading = false }: Props) {
  const a = accents[accent];
  const numericValue = typeof value === "number" ? value : parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  const isNumeric = !isNaN(numericValue) && animate;

  return (
    <motion.div
      whileHover={{ y: -3, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 shadow-card backdrop-blur-sm transition-shadow duration-300",
        "dark:bg-ink-900/50",
        a.card, a.glow
      )}
    >
      {/* Subtle corner glow */}
      <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-current opacity-5 blur-xl" />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{title}</p>
          {loading ? (
            <div className="mt-2 h-8 w-24 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-700" />
          ) : (
            <motion.p
              key={String(value)}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="mt-1.5 font-display text-2xl font-bold tracking-tight text-ink-900 dark:text-slate-50"
            >
              {isNumeric ? <AnimatedNumber value={numericValue} /> : value}
            </motion.p>
          )}
          {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
          {trend !== undefined && (
            <div className={cn(
              "mt-2 flex items-center gap-1 text-xs font-semibold",
              trend > 0 ? "text-emerald-600 dark:text-emerald-400" :
              trend < 0 ? "text-rose-600 dark:text-rose-400" :
              "text-slate-500"
            )}>
              {trend > 0 ? <TrendingUp className="h-3 w-3" /> :
               trend < 0 ? <TrendingDown className="h-3 w-3" /> :
               <Minus className="h-3 w-3" />}
              {trend > 0 ? "+" : ""}{trend.toFixed(1)}% vs last period
            </div>
          )}
        </div>
        {icon && (
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", a.icon)}>
            {icon}
          </div>
        )}
      </div>
    </motion.div>
  );
}
