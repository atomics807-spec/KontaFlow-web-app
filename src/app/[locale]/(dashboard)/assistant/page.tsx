import type { Metadata } from "next";
import { Bot } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AssistantChat, type ChatMessage } from "@/components/assistant/assistant-chat";
import { requireWorkspaceContext } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { isAiConfigured } from "@/lib/ai/client";
import { planFor } from "@/lib/plans";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.assistant.title, robots: { index: false, follow: false } };
}

export default async function AssistantPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const context = await requireWorkspaceContext(locale);
  const supabase = await createClient();

  const { data: conversation } = await supabase
    .from("ai_conversations")
    .select("id")
    .eq("workspace_id", context.workspace.id)
    .eq("user_id", context.user.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let messages: ChatMessage[] = [];
  if (conversation?.id) {
    const { data } = await supabase
      .from("ai_messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", conversation.id)
      .in("role", ["user", "assistant"])
      .order("created_at", { ascending: true })
      .limit(60);

    messages = (data ?? []).map((row) => ({
      id: row.id,
      role: row.role as "user" | "assistant",
      content: row.content,
    }));
  }

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight text-heading">
            <Bot className="h-6 w-6 text-accent-strong" aria-hidden />
            {dict.assistant.title}
          </h1>
          <p className="mt-1 text-sm text-muted">{dict.assistant.subtitle}</p>
        </div>
        <Badge tone="jade">
          {dict.settings.usage}: {planFor(context.workspace.plan).aiMessagesPerMonth}
        </Badge>
      </header>

      <Card className="p-4 sm:p-5">
        <AssistantChat
          conversationId={conversation?.id ?? null}
          initialMessages={messages}
          configured={isAiConfigured()}
        />
      </Card>
    </div>
  );
}
