"use client";

import { useRouter } from "next/navigation";
import * as React from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/components/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="mesh-gradient flex min-h-screen items-center justify-center p-8">
        <div className="glass-panel w-full max-w-md space-y-4 rounded-2xl p-8">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="mesh-gradient min-h-screen">
      <AppSidebar />
      <main className="min-h-screen pt-16 lg:pl-64">
        <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">{children}</div>
      </main>
    </div>
  );
}
