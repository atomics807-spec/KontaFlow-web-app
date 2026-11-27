import { NextResponse } from "next/server";
import { getWorkspaceContext } from "@/lib/supabase/auth";
import { can } from "@/lib/permissions";
import { aiCommandIdSchema } from "@/lib/ai/schemas";
import { confirmAiCommand } from "@/services/ai-commands";
import { AppError, isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { requireFeature } from "@/lib/entitlements/service";
import { rejectCrossOrigin } from "@/lib/security/csrf";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;

  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "no_workspace" }, { status: 403 });
  if (!can(context.role, "ai:use")) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const commandId = aiCommandIdSchema.safeParse((await params).id);
  if (!commandId.success) return NextResponse.json({ error: "invalid_command" }, { status: 422 });

  try {
    await requireFeature(context.workspace.id, "ai_bookkeeping", {
      userId: context.user.id,
      write: true,
    });
    const command = await confirmAiCommand(commandId.data, false);
    return NextResponse.json({ command }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    const appError = isAppError(error)
      ? error
      : new AppError("internal_error", "The assistant is temporarily unavailable. Try again.");
    if (!isAppError(error)) logger.error("ai.command_confirm_failed", { error });
    return NextResponse.json({ error: appError.code, message: appError.publicMessage }, { status: appError.status });
  }
}
