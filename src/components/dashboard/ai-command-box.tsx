"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/layout/i18n-provider";

export function AiCommandBox({ configured }: { configured: boolean }) {
  const { locale, dict } = useI18n();
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  const [reply, setReply] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!text || pending) return;
    setPending(true);
    setError(null);
    setReply(null);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message: text,
          requestId: globalThis.crypto.randomUUID(),
          locale,
          requireConfirmation: true,
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | { reply?: string; message?: string }
        | null;
      if (!response.ok || !body?.reply) {
        setError(
          response.status === 503
            ? dict.assistant.notConfigured
            : response.status === 429
              ? dict.assistant.quotaReached
              : dict.dashboard.aiCommandError,
        );
        return;
      }
      setReply(body.reply);
      setMessage("");
    } catch {
      setError(dict.errors.network);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="dashboard-ai-command" className="sr-only">
          {dict.dashboard.aiCommandTitle}
        </label>
        <Input
          id="dashboard-ai-command"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder={configured ? dict.dashboard.aiCommandPlaceholder : dict.dashboard.aiCommandError}
          maxLength={600}
          disabled={!configured || pending}
          className="min-w-0 flex-1"
        />
        <Button type="submit" size="sm" variant="mango" disabled={!configured || pending || !message.trim()}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Sparkles className="h-4 w-4" aria-hidden />}
          {pending ? dict.dashboard.aiCommandWorking : dict.dashboard.aiCommandSend}
        </Button>
      </form>

      {error ? <Alert tone="error">{error}</Alert> : null}
      {reply ? (
        <div className="rounded-xl bg-white/10 p-3 text-sm leading-relaxed text-jade-50/90">
          <p>{reply}</p>
          <Link href={`/${locale}/assistant`} className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-mango-400 hover:underline">
            {dict.dashboard.aiCommandReview}
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        </div>
      ) : null}
    </div>
  );
}
