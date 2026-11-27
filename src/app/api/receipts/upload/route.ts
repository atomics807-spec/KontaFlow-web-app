import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/supabase/auth";
import { logger } from "@/lib/logger";
import { rejectCrossOrigin } from "@/lib/security/csrf";
import { getRequestMeta } from "@/lib/security/request-meta";
import { consumeRateLimitDetailed, rateLimitHeaders } from "@/lib/security/durable-rate-limit";
import {
  RECEIPT_MIMES,
  validateUploadedFile,
  type FileValidationError,
} from "@/lib/security/file-validation";
import { scanBlocksUpload, scanUploadedFile } from "@/lib/security/malware-scan";
import { logSecurityEvent, writeWorkspaceAudit } from "@/lib/security/events";
import { getServerEnv } from "@/lib/env";

const MAX_BYTES = 10 * 1024 * 1024;
const MAX_FORM_BYTES = MAX_BYTES + 1024 * 1024;

const ERROR_STATUS: Record<FileValidationError, number> = {
  missing_file: 422,
  empty_file: 422,
  too_large: 413,
  unsupported_type: 422,
  content_mismatch: 422,
};

export async function POST(request: Request) {
  const blocked = rejectCrossOrigin(request);
  if (blocked) return blocked;

  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!context.can("transactions:create")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const meta = await getRequestMeta();
  const uploadLimit = await consumeRateLimitDetailed(
    `receipt-upload:${context.user.id}`,
    getServerEnv().RATE_LIMIT_UPLOAD_PER_MINUTE,
    60,
  );
  if (!uploadLimit.allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429, headers: rateLimitHeaders(uploadLimit) });
  }

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_FORM_BYTES) {
    return NextResponse.json({ error: "invalid_size" }, { status: 413 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 422 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "missing_file" }, { status: 422 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const validated = validateUploadedFile({
    name: file.name,
    type: file.type,
    size: file.size,
    bytes,
    allowed: RECEIPT_MIMES,
    maxBytes: MAX_BYTES,
  });
  if (!validated.ok) {
    await logSecurityEvent({
      type: "upload.rejected",
      userId: context.user.id,
      workspaceId: context.workspace.id,
      severity: "warning",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { reason: validated.error, mime: file.type.slice(0, 80), size: file.size },
    });
    return NextResponse.json(
      { error: validated.error === "too_large" ? "invalid_size" : "invalid_type" },
      { status: ERROR_STATUS[validated.error] },
    );
  }

  const scan = await scanUploadedFile({
    bytes: validated.bytes,
    fileName: validated.fileName,
    mime: validated.mime,
  });
  if (scan.status === "rejected" || scan.status === "unavailable") {
    const blocked = scanBlocksUpload(scan);
    await logSecurityEvent({
      type: blocked ? "upload.malware_blocked" : "upload.malware_detected",
      userId: context.user.id,
      workspaceId: context.workspace.id,
      severity: "critical",
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { scan: scan.status, reason: scan.reason, mime: validated.mime, blocked },
    });
    if (blocked) return NextResponse.json({ error: "upload_rejected" }, { status: 422 });
  }

  const path = `${context.workspace.id}/receipts/${crypto.randomUUID()}-${validated.fileName}`;
  const supabase = await createClient();
  const { error } = await supabase.storage.from("kontaflow-receipts").upload(path, validated.bytes, {
    contentType: validated.mime,
    upsert: false,
  });
  if (error) {
    logger.warn("receipt.upload_failed", { message: error.message });
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }

  await Promise.all([
    logSecurityEvent({
      type: "upload.accepted",
      userId: context.user.id,
      workspaceId: context.workspace.id,
      ip: meta.ip,
      userAgent: meta.userAgent,
      metadata: { mime: validated.mime, size: validated.sizeBytes, scan: scan.status },
    }),
    writeWorkspaceAudit({
      workspaceId: context.workspace.id,
      actorId: context.user.id,
      action: "receipt.uploaded",
      entity: "attachment",
      metadata: { mime: validated.mime, size: validated.sizeBytes, scan: scan.status },
      ip: meta.ip,
      userAgent: meta.userAgent,
    }),
  ]);

  return NextResponse.json(
    {
      path,
      fileName: file.name.slice(0, 200),
      mimeType: validated.mime,
      sizeBytes: validated.sizeBytes,
    },
    { headers: { "cache-control": "no-store" } },
  );
}
