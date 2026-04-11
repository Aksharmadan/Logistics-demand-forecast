"use client";

import * as React from "react";
import { apiFetch, apiJson, clearToken, getToken, setToken } from "@/lib/api";

export type User = {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
};

type AuthCtx = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
};

const Ctx = React.createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    const t = getToken();
    if (!t) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await apiJson<User>("/auth/me");
      setUser(me);
    } catch {
      clearToken();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = React.useCallback(
    async (email: string, password: string) => {
      const res = await apiFetch("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || "Login failed");
      }
      const data = (await res.json()) as { access_token: string };
      setToken(data.access_token);
      await refresh();
    },
    [refresh]
  );

  const logout = React.useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const v = React.useMemo(() => ({ user, loading, login, logout, refresh }), [user, loading, login, logout, refresh]);

  return <Ctx.Provider value={v}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const x = React.useContext(Ctx);
  if (!x) throw new Error("useAuth must be used within AuthProvider");
  return x;
}
