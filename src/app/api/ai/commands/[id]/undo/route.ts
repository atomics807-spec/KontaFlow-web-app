import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/supabase/auth";
import { can } from "@/lib/permissions";
import { aiCommandIdSchema } from "@/lib/ai/schemas";
import { undoAiCommand } from "@/services/ai-commands";
import { AppError, isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  if (!can(context.role, "ai:use")) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const commandId = aiCommandIdSchema.safeParse((await params).id);
  if (!commandId.success) return NextResponse.json({ error: "invalid_command" }, { status: 422 });

  const body = (await request.json().catch(() => null)) as { reason?: unknown } | null;
  const reason = typeof body?.reason === "string" ? body.reason.slice(0, 300) : undefined;

  try {
    const command = await undoAiCommand(commandId.data, reason);
    return NextResponse.json({ command }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const appError = isAppError(error)
      ? error
      : new AppError("internal_error", "The assistant is temporarily unavailable. Try again.");
    if (!isAppError(error)) logger.error("ai.command_undo_failed", { error });
    return NextResponse.json({ error: appError.code, message: appError.publicMessage }, { status: appError.status });
  }
}
