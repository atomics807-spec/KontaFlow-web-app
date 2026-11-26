import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/supabase/auth";
import { logger } from "@/lib/logger";

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function signatureMatches(bytes: Uint8Array, mime: string): boolean {
  if (mime === "application/pdf") {
    return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
  }
  if (mime === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mime === "image/png") {
    return (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    );
  }
  if (mime === "image/webp") {
    return (
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46 &&
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50
    );
  }
  return false;
}

function safeName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "receipt";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return cleaned || "receipt";
}

export async function POST(request: Request) {
  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  if (!context.can("transactions:create")) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "invalid_payload" }, { status: 422 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "missing_file" }, { status: 422 });
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "invalid_size" }, { status: 422 });
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: "invalid_type" }, { status: 422 });
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!signatureMatches(bytes, file.type)) {
    return NextResponse.json({ error: "invalid_type" }, { status: 422 });
  }

  const fileName = safeName(file.name);
  const path = `${context.workspace.id}/receipts/${crypto.randomUUID()}-${fileName}`;
  const supabase = await createClient();
  const { error } = await supabase.storage.from("kontaflow-receipts").upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (error) {
    logger.warn("receipt.upload_failed", { message: error.message });
    return NextResponse.json({ error: "upload_failed" }, { status: 500 });
  }

  return NextResponse.json({
    path,
    fileName: file.name.slice(0, 200),
    mimeType: file.type,
    sizeBytes: file.size,
  });
}
