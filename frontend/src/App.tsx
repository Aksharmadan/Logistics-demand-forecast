import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { AppShell } from "./components/AppShell";
import { AdminPage } from "./pages/AdminPage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { CopilotPage } from "./pages/CopilotPage";
import { DashboardPage } from "./pages/DashboardPage";
import { FleetPage } from "./pages/FleetPage";
import { LoginPage } from "./pages/LoginPage";
import { PredictionsPage } from "./pages/PredictionsPage";
import { UploadPage } from "./pages/UploadPage";
import { Zap } from "lucide-react";

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-950">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-[0_0_32px_rgba(14,165,233,0.4)]">
            <Zap className="h-7 w-7 text-white" />
          </div>
          <div className="h-1 w-32 overflow-hidden rounded-full bg-slate-800">
            <div className="h-full w-1/2 animate-[shimmer_1.5s_infinite] rounded-full bg-gradient-to-r from-brand-600 via-brand-400 to-brand-600 bg-[length:200%_100%]" />
          </div>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/*"
        element={
          <Protected>
            <AppShell>
              <Routes>
                <Route path="/" element={<DashboardPage />} />
                <Route path="/predictions" element={<PredictionsPage />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/fleet" element={<FleetPage />} />
                <Route path="/copilot" element={<CopilotPage />} />
                <Route path="/upload" element={<UploadPage />} />
                <Route path="/admin" element={<AdminPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </AppShell>
          </Protected>
        }
      />
    </Routes>
  );
}
