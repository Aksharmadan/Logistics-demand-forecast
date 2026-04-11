import { motion } from "framer-motion";

type Props = {
  title: string;
  value: string;
  hint?: string;
  accent?: "blue" | "emerald" | "amber" | "rose";
};

const accents = {
  blue: "from-brand-500/10 to-brand-600/5 border-brand-200",
  emerald: "from-emerald-500/10 to-emerald-600/5 border-emerald-200",
  amber: "from-amber-500/10 to-amber-600/5 border-amber-200",
  rose: "from-rose-500/10 to-rose-600/5 border-rose-200",
};

export function KpiCard({ title, value, hint, accent = "blue" }: Props) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className={`rounded-2xl border bg-gradient-to-br p-5 shadow-card ${accents[accent]}`}
    >
      <p className="text-sm font-medium text-slate-600">{title}</p>
      <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </motion.div>
  );
}
