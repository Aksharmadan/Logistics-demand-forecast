import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { apiJson } from "../api/client";
import { Bot, Send, User, Sparkles, RefreshCw, Lightbulb, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  confidence?: number;
  recommendations?: string[];
  sources?: string[];
  ts: Date;
};

type CopilotResponse = {
  answer: string;
  confidence: number;
  sources: string[];
  recommendations: string[];
  data_points: Record<string, any>;
};

const SUGGESTED = [
  "What regions are overloaded right now?",
  "Summarize current operations",
  "What are the top risks?",
  "Should I move fleet resources?",
  "How accurate is the forecast model?",
  "Which regions are growing fastest?",
  "Explain the latest anomaly alerts",
  "What actions should I take today?",
];

export function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello. I'm ForecastFlow AI Copilot — your intelligent logistics operations assistant. I have full visibility into your demand data, anomaly alerts, fleet status, and forecast models. Ask me anything about your operations.",
      confidence: 1.0,
      recommendations: [],
      sources: [],
      ts: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(question?: string) {
    const q = (question ?? input).trim();
    if (!q || busy) return;
    setInput("");

    const userMsg: Message = { id: Date.now().toString(), role: "user", content: q, ts: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setBusy(true);

    try {
      const res = await apiJson<CopilotResponse>("/copilot", {
        method: "POST",
        body: JSON.stringify({ question: q }),
      });
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: res.answer,
        confidence: res.confidence,
        recommendations: res.recommendations,
        sources: res.sources,
        ts: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (e) {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I encountered an error processing your request. Please ensure the backend is running and data is loaded.",
        ts: new Date(),
      }]);
    } finally {
      setBusy(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  return (
    <div className="flex h-[calc(100vh-112px)] flex-col gap-4">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink-900 dark:text-slate-50">AI Copilot</h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">Intelligent logistics operations assistant</p>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-1.5 dark:border-brand-500/30 dark:bg-brand-500/10">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-500" />
          </span>
          <span className="text-xs font-semibold text-brand-700 dark:text-brand-300">AI Online</span>
        </div>
      </div>

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Chat area */}
        <div className="flex flex-1 flex-col rounded-2xl border border-slate-200/60 bg-white/70 shadow-card backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70 overflow-hidden">

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 scrollbar-hide">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  className={cn("flex gap-3", msg.role === "user" ? "flex-row-reverse" : "flex-row")}
                >
                  {/* Avatar */}
                  <div className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl",
                    msg.role === "assistant"
                      ? "bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow-sm"
                      : "bg-gradient-to-br from-slate-600 to-slate-800"
                  )}>
                    {msg.role === "assistant"
                      ? <Bot className="h-4 w-4 text-white" />
                      : <User className="h-4 w-4 text-white" />}
                  </div>

                  {/* Bubble */}
                  <div className={cn("max-w-[75%] space-y-2", msg.role === "user" ? "items-end" : "items-start")}>
                    <div className={cn(
                      "rounded-2xl px-4 py-3 text-sm leading-relaxed",
                      msg.role === "assistant"
                        ? "bg-slate-50 text-ink-900 dark:bg-slate-800/60 dark:text-slate-200 rounded-tl-sm"
                        : "bg-brand-600 text-white rounded-tr-sm"
                    )}>
                      {msg.content}
                    </div>

                    {/* Recommendations */}
                    {msg.recommendations && msg.recommendations.length > 0 && (
                      <div className="space-y-1.5">
                        {msg.recommendations.map((rec, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: i * 0.08 }}
                            className="flex items-start gap-2 rounded-xl border border-brand-100 bg-brand-50/60 px-3 py-2 dark:border-brand-500/20 dark:bg-brand-500/5"
                          >
                            <ChevronRight className="h-3.5 w-3.5 mt-0.5 shrink-0 text-brand-500" />
                            <p className="text-xs font-medium text-brand-700 dark:text-brand-300">{rec}</p>
                          </motion.div>
                        ))}
                      </div>
                    )}

                    {/* Meta */}
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] text-slate-400">{msg.ts.toLocaleTimeString()}</span>
                      {msg.confidence !== undefined && (
                        <span className="text-[10px] text-slate-400">
                          Confidence: <span className="font-semibold text-brand-500">{(msg.confidence * 100).toFixed(0)}%</span>
                        </span>
                      )}
                      {msg.sources && msg.sources.length > 0 && (
                        <span className="text-[10px] text-slate-400">
                          Sources: {msg.sources.join(", ")}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {/* Typing indicator */}
            {busy && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="rounded-2xl rounded-tl-sm bg-slate-50 px-4 py-3 dark:bg-slate-800/60">
                  <div className="flex gap-1.5 items-center h-4">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ y: [0, -4, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                        className="h-1.5 w-1.5 rounded-full bg-brand-400"
                      />
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="border-t border-slate-100 p-4 dark:border-slate-800">
            <form onSubmit={(e) => { e.preventDefault(); void send(); }} className="flex gap-3">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about operations, forecasts, anomalies, fleet…"
                disabled={busy}
                className="flex-1 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-2.5 text-sm text-ink-900 placeholder-slate-400 outline-none focus:border-brand-400 focus:ring-1 focus:ring-brand-400 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-100 dark:placeholder-slate-500 transition-colors"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-glow-sm hover:bg-brand-700 disabled:opacity-40 transition-all"
              >
                {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </form>
          </div>
        </div>

        {/* Suggestions sidebar */}
        <div className="hidden w-56 shrink-0 lg:flex flex-col gap-3">
          <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-4 shadow-card backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70">
            <div className="flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <p className="text-xs font-semibold text-ink-900 dark:text-slate-200">Suggested</p>
            </div>
            <div className="space-y-1.5">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => void send(s)}
                  disabled={busy}
                  className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-slate-600 hover:bg-brand-50 hover:text-brand-700 dark:text-slate-400 dark:hover:bg-brand-500/10 dark:hover:text-brand-300 transition-colors disabled:opacity-40"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200/60 bg-white/70 p-4 shadow-card backdrop-blur-xl dark:border-slate-800/60 dark:bg-ink-950/70">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-brand-500" />
              <p className="text-xs font-semibold text-ink-900 dark:text-slate-200">Capabilities</p>
            </div>
            <ul className="space-y-1.5 text-xs text-slate-500 dark:text-slate-400">
              {["Demand analysis", "Anomaly explanation", "Fleet recommendations", "Forecast insights", "Risk detection", "Operational summary"].map((c) => (
                <li key={c} className="flex items-center gap-1.5">
                  <span className="h-1 w-1 rounded-full bg-brand-400" />
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
