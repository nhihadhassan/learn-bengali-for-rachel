"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, MessagesSquare, Send } from "lucide-react";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { cn } from "@/lib/utils";

type ChatMessage = { role: "user" | "assistant"; content: string };

const backLink = (
  <Link
    href="/lessons"
    aria-label="Back to lessons"
    className="inline-grid size-9 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-slate-100 dark:hover:bg-white/15 sm:size-10"
  >
    <ArrowLeft size={18} aria-hidden="true" />
  </Link>
);

export default function RoleplayPage() {
  const enabled = isFeatureEnabled("aiRoleplay");
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "¡Hola! Bienvenido al café. ¿Qué te gustaría pedir?" },
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  async function send() {
    const text = input.trim();
    if (!text || sending) {
      return;
    }

    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: text }];
    setMessages(nextMessages);
    setInput("");
    setSending(true);

    try {
      const response = await fetch("/api/roleplay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario: "ordering at a café", messages: nextMessages }),
      });
      const data = await response.json();
      setMessages((current) => [
        ...current,
        { role: "assistant", content: data.reply ?? "…" },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        { role: "assistant", content: "Lo siento, no puedo responder ahora mismo." },
      ]);
    } finally {
      setSending(false);
    }
  }

  if (!enabled) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          {backLink}
          <div>
            <p className="text-xs font-black uppercase tracking-[0.14em] text-fuchsia-600 dark:text-fuchsia-300">
              Roleplay
            </p>
            <h1 className="text-xl font-black leading-tight text-slate-950 dark:text-slate-50 sm:text-2xl">
              Coming soon
            </h1>
          </div>
        </div>
        <div className="rounded-3xl border border-fuchsia-100 bg-fuchsia-50/70 p-6 text-center shadow-inner dark:border-fuchsia-300/20 dark:bg-fuchsia-400/10">
          <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-fuchsia-500 text-white">
            <MessagesSquare size={26} />
          </span>
          <p className="mt-4 font-black text-slate-800 dark:text-slate-100">
            Chat your way through real scenarios.
          </p>
          <p className="mt-1 text-sm font-semibold text-slate-600 dark:text-slate-300">
            An AI conversation partner is on the way — order a coffee, ask for
            directions, and practice replying in Spanish.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {backLink}
        <div>
          <p className="text-xs font-black uppercase tracking-[0.14em] text-fuchsia-600 dark:text-fuchsia-300">
            Roleplay · Café
          </p>
          <h1 className="text-xl font-black leading-tight text-slate-950 dark:text-slate-50 sm:text-2xl">
            Order at the café
          </h1>
        </div>
      </div>

      <div className="grid gap-3">
        {messages.map((message, index) => (
          <div
            key={index}
            className={cn(
              "max-w-[85%] rounded-3xl p-4 text-base font-bold shadow-sm",
              message.role === "assistant"
                ? "rounded-bl-md border border-slate-200 bg-slate-100 text-slate-900 dark:border-white/10 dark:bg-white/[0.08] dark:text-slate-50"
                : "ml-auto rounded-br-md bg-violet-600 text-white",
            )}
          >
            {message.content}
          </div>
        ))}
        {sending && (
          <div className="max-w-[85%] rounded-3xl rounded-bl-md border border-slate-200 bg-slate-100 p-4 text-slate-400 dark:border-white/10 dark:bg-white/[0.08]">
            …
          </div>
        )}
      </div>

      <div className="sticky bottom-3 flex items-center gap-2">
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && send()}
          placeholder="Escribe en español…"
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-bold shadow-sm outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100 dark:border-white/10 dark:bg-white/10 dark:text-slate-50 dark:placeholder:text-slate-500 dark:focus:ring-violet-400/20"
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !input.trim()}
          aria-label="Send"
          className="inline-grid size-12 shrink-0 place-items-center rounded-2xl bg-violet-600 text-white shadow-[0_6px_0_#5b21b6] transition hover:-translate-y-0.5 active:translate-y-1 disabled:opacity-55"
        >
          <Send size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
