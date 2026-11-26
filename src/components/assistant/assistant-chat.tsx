"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/components/layout/i18n-provider";
import { cn } from "@/lib/utils";

export type ChatMessage = { id: string; role: "user" | "assistant"; content: string };

let localMessageSeq = 0;
function nextLocalMessageId(): string {
  localMessageSeq += 1;
  return `local-${localMessageSeq}`;
}

export function AssistantChat({
  conversationId,
  initialMessages,
  configured,
}: {
  conversationId: string | null;
  initialMessages: ChatMessage[];
  configured: boolean;
}) {
  const { locale, dict } = useI18n();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [conversation, setConversation] = useState<string | null>(conversationId);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || pending) return;

    setError(null);
    setInput("");
    setPending(true);

    const optimistic: ChatMessage = { id: nextLocalMessageId(), role: "user", content: message };
    setMessages((current) => [...current, optimistic]);

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message, conversationId: conversation, locale }),
      });

      const body = (await response.json().catch(() => null)) as
        | { reply?: string; conversationId?: string; message?: string }
        | null;

      if (!response.ok || !body?.reply) {
        setError(
          response.status === 503
            ? dict.assistant.notConfigured
            : response.status === 429
              ? dict.assistant.quotaReached
              : (body?.message ?? dict.errors.generic),
        );
        setInput(message);
        return;
      }

      setConversation(body.conversationId ?? conversation);
      setMessages((current) => [
        ...current,
        { id: `a-${Date.now()}`, role: "assistant", content: body.reply as string },
      ]);
    } catch {
      setError(dict.errors.network);
      setInput(message);
    } finally {
      setPending(false);
    }
  }

  const suggestions = [
    dict.assistant.suggestion1,
    dict.assistant.suggestion2,
    dict.assistant.suggestion3,
    dict.assistant.suggestion4,
  ];

  if (!configured) {
    return (
      <Alert tone="warning">{dict.assistant.notConfigured}</Alert>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-13rem)] min-h-[26rem] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto pb-4" aria-live="polite" aria-relevant="additions">
        {messages.length === 0 ? (
          <div className="rounded-2xl border border-line bg-panel p-5">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-forest text-mango-400">
              <Sparkles className="h-5 w-5" aria-hidden />
            </span>
            <p className="mt-3 text-sm font-bold text-heading">{dict.assistant.empty}</p>
            <p className="mt-1 text-sm text-muted">{dict.assistant.emptyHint}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => void send(suggestion)}
                  className="rounded-full border border-line bg-page px-3 py-1.5 text-left text-xs font-medium text-heading transition hover:border-accent-line hover:bg-accent-soft"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-line rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  message.role === "user" ? "bg-forest text-white" : "border border-line bg-panel text-heading",
                )}
              >
                {message.content}
              </div>
            </div>
          ))
        )}

        {pending ? (
          <div className="flex items-center gap-2 text-xs text-muted">
            <span className="flex gap-1" aria-hidden>
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-jade-500 [animation-delay:0ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-jade-500 [animation-delay:120ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-jade-500 [animation-delay:240ms]" />
            </span>
            {dict.assistant.thinking}
          </div>
        ) : null}

        <div ref={bottomRef} />
      </div>

      {error ? (
        <Alert tone="error" className="mb-3">
          {error}
        </Alert>
      ) : null}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
        className="flex items-end gap-2 border-t border-line pt-3"
      >
        <label htmlFor="assistant-input" className="sr-only">
          {dict.assistant.placeholder}
        </label>
        <Input
          id="assistant-input"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder={dict.assistant.placeholder}
          maxLength={2000}
          autoComplete="off"
          className="h-12 flex-1"
          disabled={pending}
        />
        <Button type="submit" size="icon" className="h-12 w-12 shrink-0" disabled={pending || !input.trim()}>
          <Send className="h-4 w-4" aria-hidden />
          <span className="sr-only">{dict.assistant.send}</span>
        </Button>
      </form>

      <p className="mt-2 text-[0.7rem] leading-relaxed text-muted">{dict.assistant.disclaimer}</p>
    </div>
  );
}
