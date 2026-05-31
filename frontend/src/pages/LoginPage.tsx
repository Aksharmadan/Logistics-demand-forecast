import { motion } from "framer-motion";
import { FormEvent, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { Zap, Eye, EyeOff, ArrowRight } from "lucide-react";

export function LoginPage() {
  const { user, login, loading } = useAuth();
  const [email, setEmail] = useState("admin@logistics.demo");
  const [password, setPassword] = useState("ChangeMe!2026");
  const [showPw, setShowPw] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null); setBusy(true);
    try { await login(email, password); }
    catch (ex) { setErr(ex instanceof Error ? ex.message : "Login failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-ink-950 px-4">
      {/* Animated background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-brand-500/15 blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 h-96 w-96 rounded-full bg-violet-500/10 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/8 blur-[100px]" />
        {/* Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative w-full max-w-md"
      >
        {/* Card */}
        <div className="rounded-3xl border border-white/10 bg-white/5 p-8 shadow-2xl backdrop-blur-2xl">
          {/* Logo */}
          <div className="mb-8 text-center">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 400 }}
              className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-[0_0_32px_rgba(14,165,233,0.4)]"
            >
              <Zap className="h-7 w-7 text-white" />
            </motion.div>
            <h1 className="font-display text-2xl font-bold text-white">ForecastFlow AI</h1>
            <p className="mt-1 text-sm text-slate-400">Logistics Intelligence Platform</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Email</label>
              <input
                value={email} onChange={(e) => setEmail(e.target.value)}
                autoComplete="email" type="email"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-11 text-sm text-white placeholder-slate-500 outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-colors"
                />
                <button type="button" onClick={() => setShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors">
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {err && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-xl bg-rose-500/10 border border-rose-500/20 px-4 py-2.5 text-sm font-medium text-rose-400">
                {err}
              </motion.p>
            )}

            <button type="submit" disabled={busy}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white shadow-[0_0_24px_rgba(14,165,233,0.3)] hover:bg-brand-500 hover:shadow-[0_0_32px_rgba(14,165,233,0.4)] disabled:opacity-60 transition-all">
              {busy ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <>Sign in <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /></>
              )}
            </button>
          </form>

          <div className="mt-6 rounded-xl border border-white/5 bg-white/3 p-4">
            <p className="text-xs font-semibold text-slate-400 mb-2">Demo credentials</p>
            <div className="space-y-1 text-xs text-slate-500">
              <p><span className="text-slate-300">Admin:</span> admin@logistics.demo</p>
              <p><span className="text-slate-300">Analyst:</span> analyst@logistics.demo</p>
              <p><span className="text-slate-300">Password:</span> ChangeMe!2026</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
