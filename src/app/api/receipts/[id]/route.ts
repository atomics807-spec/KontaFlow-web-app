import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/supabase/auth";
import { logger } from "@/lib/logger";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("attachments")
    .select("storage_path")
    .eq("workspace_id", context.workspace.id)
    .eq("transaction_id", id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  if (error) {
    logger.warn("receipt.lookup_failed", { message: error.message });
    return NextResponse.json({ error: "lookup_failed" }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const { data: signed, error: signError } = await supabase.storage
    .from("kontaflow-receipts")
    .createSignedUrl(data.storage_path, 60);
  if (signError || !signed?.signedUrl) {
    logger.warn("receipt.sign_failed", { message: signError?.message });
    return NextResponse.json({ error: "unavailable" }, { status: 500 });
  }

  return NextResponse.redirect(signed.signedUrl, {
    headers: { "cache-control": "private, no-store" },
  });
}
