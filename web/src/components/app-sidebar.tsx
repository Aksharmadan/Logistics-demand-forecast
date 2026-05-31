"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  BarChart3,
  Database,
  FileText,
  LayoutDashboard,
  LineChart,
  Menu,
  Shield,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const mainNav = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard, tour: "nav-overview" },
  { href: "/dashboard/data", label: "Data pipeline", icon: Database, tour: "nav-data" },
  { href: "/dashboard/forecast", label: "Forecast studio", icon: LineChart, tour: "nav-forecast" },
  { href: "/dashboard/intelligence", label: "Intelligence", icon: Sparkles, tour: "nav-intel" },
  { href: "/dashboard/analytics", label: "Analytics+", icon: BarChart3, tour: "nav-analytics" },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <nav className={cn("flex gap-1", mobile ? "flex-col" : "flex-col px-2")}>
      {mainNav.map((item) => {
        const active = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
        return (
          <Tooltip key={item.href} delayDuration={400}>
            <TooltipTrigger asChild>
              <Link
                href={item.href}
                data-tour={item.tour}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
                  active
                    ? "bg-primary/15 text-primary shadow-sm shadow-primary/10"
                    : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0 opacity-80" />
                {item.label}
              </Link>
            </TooltipTrigger>
            <TooltipContent side="right" className="hidden lg:block">
              {item.label}
            </TooltipContent>
          </Tooltip>
        );
      })}
      {user?.role === "admin" && (
        <Link
          href="/dashboard/admin"
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all",
            pathname.startsWith("/dashboard/admin")
              ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
              : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          )}
        >
          <Shield className="h-4 w-4 shrink-0" />
          Admin
        </Link>
      )}
    </nav>
  );

  return (
    <>
      <aside className="glass-sidebar fixed left-0 top-0 z-40 hidden h-screen w-64 flex-col border-r lg:flex">
        <div className="flex h-16 items-center gap-2 border-b border-border/50 px-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-cyan-600 text-sm font-bold text-primary-foreground shadow-lg shadow-primary/25">
            NR
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight">NexRoute Pulse</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Enterprise</p>
          </div>
        </div>
        <ScrollArea className="flex-1 py-4">
          <NavLinks />
        </ScrollArea>
        <div className="border-t border-border/50 p-4">
          <div className="mb-3 rounded-lg bg-muted/50 px-3 py-2 text-xs">
            <p className="truncate font-medium text-foreground">{user?.email}</p>
            <p className="capitalize text-muted-foreground">{user?.role}</p>
          </div>
          <div className="flex items-center justify-between gap-2">
            <ModeToggle />
            <Button variant="ghost" size="sm" onClick={() => logout()}>
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      <header className="fixed left-0 right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl lg:left-64">
        <div className="flex items-center gap-3">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 glass-sidebar p-0">
              <div className="flex h-16 items-center gap-2 border-b px-4">
                <Activity className="h-6 w-6 text-primary" />
                <span className="font-semibold">NexRoute Pulse</span>
              </div>
              <div className="p-4">
                <NavLinks mobile />
              </div>
            </SheetContent>
          </Sheet>
          <div className="hidden flex-col sm:flex">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Workspace</span>
            <span className="text-sm font-semibold">Operations control</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/docs">
              <FileText className="mr-2 h-3.5 w-3.5" />
              Docs
            </Link>
          </Button>
          <ModeToggle />
        </div>
      </header>
    </>
  );
}
