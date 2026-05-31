import { cn } from "../../lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "danger" | "info" | "neutral";

const variants: Record<BadgeVariant, string> = {
  default: "bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300",
  success: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300",
  warning: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
  danger: "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300",
  info: "bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300",
  neutral: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export function Badge({
  children,
  variant = "default",
  className,
  dot = false,
  pulse = false,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean;
  pulse?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
        variants[variant],
        className
      )}
    >
      {dot && (
        <span className="relative flex h-1.5 w-1.5">
          {pulse && (
            <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              variant === "danger" ? "bg-rose-400" :
              variant === "warning" ? "bg-amber-400" :
              variant === "success" ? "bg-emerald-400" : "bg-brand-400"
            )} />
          )}
          <span className={cn("relative inline-flex h-1.5 w-1.5 rounded-full",
            variant === "danger" ? "bg-rose-500" :
            variant === "warning" ? "bg-amber-500" :
            variant === "success" ? "bg-emerald-500" : "bg-brand-500"
          )} />
        </span>
      )}
      {children}
    </span>
  );
}
