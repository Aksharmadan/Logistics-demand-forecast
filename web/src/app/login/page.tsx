"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const { login, user, loading } = useAuth();
  const router = useRouter();
  const [email, setEmail] = React.useState("admin@logistics.demo");
  const [password, setPassword] = React.useState("ChangeMe!2026");
  const [err, setErr] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!loading && user) router.replace("/dashboard");
  }, [loading, user, router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(email, password);
      router.replace("/dashboard");
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mesh-gradient flex min-h-screen items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <Card className="glass-panel border-white/20 shadow-2xl">
          <CardHeader className="space-y-1 text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-cyan-600 font-bold text-primary-foreground">
              NR
            </div>
            <CardTitle className="text-2xl">Welcome back</CardTitle>
            <CardDescription>NexRoute Pulse · secure workspace access</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <Input className="mt-1" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Password</label>
                <Input
                  type="password"
                  className="mt-1"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>
              {err && <p className="text-sm text-destructive">{err}</p>}
              <Button type="submit" className="w-full" variant="glow" disabled={busy}>
                {busy ? "Signing in…" : "Continue"}
              </Button>
            </form>
            <p className="mt-6 text-center text-xs text-muted-foreground">
              <Link href="/" className="underline-offset-4 hover:underline">
                ← Back to marketing
              </Link>
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
