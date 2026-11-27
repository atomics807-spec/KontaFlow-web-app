import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/supabase/auth";
import { can } from "@/lib/permissions";
import { resolveLocale } from "@/lib/i18n/config";
import { runAssistant } from "@/lib/ai/assistant";
import { aiRequestSchema } from "@/lib/ai/schemas";
import { findAiCommandByRequest } from "@/services/ai-commands";
import { requireFeature } from "@/lib/entitlements/service";
import { AppError, isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { rejectCrossOrigin } from "@/lib/security/csrf";
import { getServerEnv } from "@/lib/env";
import { getRequestMeta } from "@/lib/security/request-meta";
import { consumeRateLimit } from "@/lib/security/durable-rate-limit";
import { logSecurityEvent } from "@/lib/security/events";

const MAX_BODY_BYTES = 64 * 1024;

export async function POST(request: Request) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  if (!can(context.role, "ai:use")) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const meta = await getRequestMeta();
  if (
    !(await consumeRateLimit(
      `ai-chat:${user.id}`,
      getServerEnv().RATE_LIMIT_AI_PER_MINUTE,
      60,
    ))
  ) {
    await logSecurityEvent({
      type: "ai.rate_limited",
      userId: user.id,
      workspaceId: context.workspace.id,
      severity: "warning",
      ip: meta.ip,
      userAgent: meta.userAgent,
    });
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "unsupported_media_type" }, { status: 415 });
  }
  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }
  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }
  let payload: unknown = null;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 422 });
  }
  const parsed = aiRequestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload", details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    await requireFeature(context.workspace.id, "ai_bookkeeping", {
      userId: user.id,
      write: true,
    });
    const existing = await findAiCommandByRequest(context.workspace.id, parsed.data.requestId);
    if (existing) {
      return NextResponse.json(
        {
          conversationId: existing.conversationId ?? parsed.data.conversationId ?? null,
          reply: existing.reply,
          toolsUsed: [],
          command: existing,
          clarification: false,
        },
        { headers: { "cache-control": "no-store" } },
      );
    }

    const result = await runAssistant({
      workspace: context.workspace,
      userId: user.id,
      locale: resolveLocale(parsed.data.locale ?? "en"),
      message: parsed.data.message,
      requestId: parsed.data.requestId,
      conversationId: parsed.data.conversationId ?? null,
      mode: "interactive",
      autoPost: !parsed.data.requireConfirmation,
    });
    return NextResponse.json(result, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const appError = isAppError(error)
      ? error
      : new AppError("internal_error", "The assistant is temporarily unavailable. Try again.");
    if (!isAppError(error)) logger.error("ai.route_failed", { error });
    return NextResponse.json({ error: appError.code, message: appError.publicMessage }, { status: appError.status });
  }
}
