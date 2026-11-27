export type AllowedMime = "application/pdf" | "image/jpeg" | "image/png" | "image/webp";

export type ValidatedFile = {
  ok: true;
  bytes: Uint8Array;
  mime: AllowedMime;
  extension: string;
  fileName: string;
  sizeBytes: number;
};

export type FileValidationError =
  | "missing_file"
  | "empty_file"
  | "too_large"
  | "unsupported_type"
  | "content_mismatch";

export type FileValidationResult = ValidatedFile | { ok: false; error: FileValidationError };

const SIGNATURES: Record<AllowedMime, (bytes: Uint8Array) => boolean> = {
  "application/pdf": (bytes) =>
    bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46,
  "image/jpeg": (bytes) => bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  "image/png": (bytes) =>
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a,
  "image/webp": (bytes) =>
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50,
};

const EXTENSIONS: Record<AllowedMime, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const RECEIPT_MIMES: AllowedMime[] = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
];
export const LOGO_MIMES: AllowedMime[] = ["image/jpeg", "image/png", "image/webp"];

export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return cleaned || "file";
}

export function validateUploadedFile(input: {
  name: string;
  type: string;
  size: number;
  bytes: Uint8Array;
  allowed: readonly AllowedMime[];
  maxBytes: number;
}): FileValidationResult {
  if (input.size <= 0 || input.bytes.byteLength === 0) return { ok: false, error: "empty_file" };
  if (input.size > input.maxBytes || input.bytes.byteLength > input.maxBytes) {
    return { ok: false, error: "too_large" };
  }

  const mime = input.type.toLowerCase() as AllowedMime;
  if (!input.allowed.includes(mime)) return { ok: false, error: "unsupported_type" };
  if (!SIGNATURES[mime](input.bytes)) return { ok: false, error: "content_mismatch" };

  return {
    ok: true,
    bytes: input.bytes,
    mime,
    extension: EXTENSIONS[mime],
    fileName: safeFileName(input.name),
    sizeBytes: input.size,
  };
}
