import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/supabase/auth";
import { getJob } from "@/lib/queue";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const workspace = await getWorkspaceContext();
  if (!workspace) return NextResponse.json({ error: "no_workspace" }, { status: 403 });

  const { id } = await context.params;
  const job = await getJob(id);
  if (!job || job.actor_id !== user.id || job.workspace_id !== workspace.workspace.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json(
    {
      jobId: job.id,
      status: job.status,
      attempts: job.attempts,
      result: job.status === "completed" ? job.result : null,
      error: job.status === "dead_lettered" || job.status === "failed" ? job.last_error : null,
      createdAt: job.created_at,
      completedAt: job.completed_at,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
