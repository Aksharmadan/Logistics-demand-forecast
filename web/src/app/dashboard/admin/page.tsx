"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { apiJson } from "@/lib/api";
import { useAuth } from "@/components/auth-provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/empty-state";
import { ShieldAlert } from "lucide-react";

type UserRow = { id: number; email: string; full_name: string | null; role: string };

export default function AdminPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [rows, setRows] = React.useState<UserRow[]>([]);

  React.useEffect(() => {
    if (user && user.role !== "admin") router.replace("/dashboard");
  }, [user, router]);

  React.useEffect(() => {
    if (user?.role !== "admin") return;
    void apiJson<UserRow[]>("/admin/users").then(setRows).catch(() => setRows([]));
  }, [user?.role]);

  async function setRole(id: number, role: string) {
    await apiJson(`/admin/users/${id}/role?role=${encodeURIComponent(role)}`, { method: "PATCH" });
    setRows(await apiJson<UserRow[]>("/admin/users"));
  }

  if (user?.role !== "admin") {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Restricted"
        description="Admin role required."
        action={{ label: "Back to overview", onClick: () => router.push("/dashboard") }}
      />
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
        <p className="text-muted-foreground">Directory & RBAC</p>
      </div>
      <Card className="glass-panel">
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>JWT-authenticated identities</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr>
                <th className="pb-2">Email</th>
                <th className="pb-2">Role</th>
                <th className="pb-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-border/50">
                  <td className="py-3 font-medium">{r.email}</td>
                  <td className="py-3 capitalize">{r.role}</td>
                  <td className="py-3">
                    <select
                      className="rounded-md border border-input bg-background px-2 py-1 text-xs"
                      value={r.role}
                      onChange={(e) => void setRole(r.id, e.target.value)}
                    >
                      <option value="viewer">viewer</option>
                      <option value="analyst">analyst</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
