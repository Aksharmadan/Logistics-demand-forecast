import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const sections = [
  {
    title: "Quickstart",
    body: "Run FastAPI (`uvicorn app.main:app`) and Next.js (`npm run dev` in /web). Set NEXT_PUBLIC_API_URL to your API origin.",
  },
  {
    title: "Authentication",
    body: "JWT bearer tokens. Demo users: admin@logistics.demo / ChangeMe!2026. Roles: admin, analyst, viewer.",
  },
  {
    title: "Training pipeline",
    body: "POST /upload-data with CSV (date, region, demand). POST /train-model runs HistGradientBoosting + XGBoost comparison and persists the winner + intervals.",
  },
  {
    title: "Live stream",
    body: "WebSocket /ws/live?token=JWT emits simulated demand ticks every ~2s — mirrors a managed Kafka topic consumer.",
  },
  {
    title: "Intelligence APIs",
    body: "GET /intelligence/insights, /recommendations, POST /intelligence/scenario/simulate for executive narratives.",
  },
];

export default function DocsPage() {
  return (
    <div className="mesh-gradient min-h-screen px-6 py-16">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Home
        </Link>
        <h1 className="mt-6 text-4xl font-bold">Documentation</h1>
        <p className="mt-2 text-muted-foreground">Mock docs — swap with Mintlify or ReadMe when you ship.</p>
        <div className="mt-10 space-y-4">
          {sections.map((s) => (
            <Card key={s.title} className="glass-panel">
              <CardHeader>
                <CardTitle className="text-lg">{s.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
