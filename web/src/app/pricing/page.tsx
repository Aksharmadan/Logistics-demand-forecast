import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

const tiers = [
  {
    name: "Starter",
    price: "$0",
    desc: "For coursework, prototypes, and demos.",
    features: ["CSV ingest", "Single-region dashboards", "Community support"],
  },
  {
    name: "Growth",
    price: "$499",
    desc: "For scaling 3PL & courier teams.",
    features: ["Multi-model ML arena", "WebSocket live stream", "Scenario lab", "Slack alerts (mock)"],
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Let’s talk",
    desc: "VPC, SSO, custom LSTM / Prophet fleet.",
    features: ["Dedicated success", "On-prem artifacts", "Kafka / Flink connectors", "24/7 SRE"],
  },
];

export default function PricingPage() {
  return (
    <div className="mesh-gradient min-h-screen px-6 py-16">
      <div className="mx-auto max-w-5xl text-center">
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← Home
        </Link>
        <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-5xl">Simple, transparent pricing</h1>
        <p className="mt-4 text-muted-foreground">Mock pricing page — tune numbers for your GTM story.</p>
      </div>
      <div className="mx-auto mt-16 grid max-w-6xl gap-8 md:grid-cols-3">
        {tiers.map((t) => (
          <Card
            key={t.name}
            className={
              t.highlight
                ? "glass-panel relative border-primary/40 shadow-xl shadow-primary/10"
                : "glass-panel border-border/60"
            }
          >
            {t.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                Popular
              </div>
            )}
            <CardHeader>
              <CardTitle>{t.name}</CardTitle>
              <CardDescription>{t.desc}</CardDescription>
              <p className="pt-4 text-3xl font-bold">{t.price}</p>
              {t.price.startsWith("$") && <p className="text-xs text-muted-foreground">per month / mock</p>}
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-primary" />
                    {f}
                  </li>
                ))}
              </ul>
            </CardContent>
            <CardFooter>
              <Button className="w-full" variant={t.highlight ? "glow" : "outline"} asChild>
                <Link href="/login">{t.name === "Enterprise" ? "Contact sales" : "Get started"}</Link>
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
