import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiJson } from "../api/client";
import { useAuth } from "../auth/AuthContext";

type UserRow = {
  id: number;
  email: string;
  full_name: string | null;
  role: string;
  is_active: boolean;
};

export function AdminPage() {
  const { user } = useAuth();
  const [rows, setRows] = useState<UserRow[]>([]);

  useEffect(() => {
    if (user?.role !== "admin") return;
    void apiJson<UserRow[]>("/admin/users").then(setRows).catch(() => setRows([]));
  }, [user?.role]);

  async function setRole(id: number, role: string) {
    await apiJson(`/admin/users/${id}/role?role=${encodeURIComponent(role)}`, { method: "PATCH" });
    const next = await apiJson<UserRow[]>("/admin/users");
    setRows(next);
  }

  if (user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-semibold text-ink-900">Admin</h1>
        <p className="mt-1 text-slate-600">User directory and role management.</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-card">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-slate-100 last:border-0">
                <td className="px-4 py-3 font-medium">{r.email}</td>
                <td className="px-4 py-3 text-slate-600">{r.full_name ?? "—"}</td>
                <td className="px-4 py-3 capitalize">{r.role}</td>
                <td className="px-4 py-3">
                  <select
                    className="rounded-lg border border-slate-200 px-2 py-1 text-xs"
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
      </div>
    </div>
  );
}
