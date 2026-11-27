import { describe, expect, it } from "vitest";
import { verifySameOrigin } from "@/lib/security/request-origin";
import {
  LOGO_MIMES,
  RECEIPT_MIMES,
  safeFileName,
  validateUploadedFile,
} from "@/lib/security/file-validation";
import { buildSecurityHeaders } from "@/lib/security/headers";

const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00]);
const pdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31]);
const webp = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);

describe("same-origin verification", () => {
  const base = {
    requestUrl: "https://app.kontaflow.com/api/receipts/upload",
    appUrl: "https://app.kontaflow.com",
  };

  it("accepts the app origin", () => {
    expect(
      verifySameOrigin({
        ...base,
        origin: "https://app.kontaflow.com",
        secFetchSite: "same-origin",
      }).ok,
    ).toBe(true);
  });

  it("rejects cross-site and same-site browser requests", () => {
    expect(
      verifySameOrigin({
        ...base,
        origin: "https://app.kontaflow.com",
        secFetchSite: "cross-site",
      }),
    ).toMatchObject({ ok: false, reason: "cross_site" });
    expect(
      verifySameOrigin({
        ...base,
        origin: "https://app.kontaflow.com",
        secFetchSite: "same-site",
      }),
    ).toMatchObject({ ok: false, reason: "cross_site" });
  });

  it("rejects an untrusted origin", () => {
    expect(
      verifySameOrigin({ ...base, origin: "https://evil.example", secFetchSite: null }),
    ).toMatchObject({ ok: false, reason: "untrusted_origin" });
  });

  it("allows a non-browser client without Origin", () => {
    expect(verifySameOrigin({ ...base, origin: null, secFetchSite: null }).ok).toBe(true);
  });

  it("honours explicit trusted origins and ignores spoofed forwarding headers", () => {
    expect(
      verifySameOrigin({
        ...base,
        origin: "https://ops.kontaflow.dev",
        secFetchSite: null,
        trustedOrigins: "https://ops.kontaflow.dev,https://admin.kontaflow.dev",
      }).ok,
    ).toBe(true);
    expect(
      verifySameOrigin({
        requestUrl: "http://internal:3000/api/sync",
        appUrl: "https://app.kontaflow.com",
        origin: "https://preview.kontaflow.dev",
        secFetchSite: null,
      }),
    ).toMatchObject({ ok: false, reason: "untrusted_origin" });
  });

  it("rejects malformed origins", () => {
    expect(verifySameOrigin({ ...base, origin: "not-a-url", secFetchSite: null }).ok).toBe(false);
  });
});

describe("upload validation", () => {
  function validate(overrides: Partial<Parameters<typeof validateUploadedFile>[0]> = {}) {
    return validateUploadedFile({
      name: "receipt.png",
      type: "image/png",
      size: png.byteLength,
      bytes: png,
      allowed: RECEIPT_MIMES,
      maxBytes: 10 * 1024 * 1024,
      ...overrides,
    });
  }

  it("accepts raster images and PDF receipts with matching signatures", () => {
    expect(validate()).toMatchObject({ ok: true, mime: "image/png", extension: "png" });
    expect(
      validate({ name: "receipt.jpg", type: "image/jpeg", bytes: jpeg, size: jpeg.byteLength }),
    ).toMatchObject({ ok: true, mime: "image/jpeg", extension: "jpg" });
    expect(
      validate({ name: "receipt.pdf", type: "application/pdf", bytes: pdf, size: pdf.byteLength }),
    ).toMatchObject({ ok: true, mime: "application/pdf", extension: "pdf" });
    expect(
      validate({ name: "logo.webp", type: "image/webp", bytes: webp, size: webp.byteLength }),
    ).toMatchObject({ ok: true, mime: "image/webp", extension: "webp" });
  });

  it("rejects MIME spoofing, SVG and oversized files", () => {
    expect(validate({ type: "image/png", bytes: pdf })).toMatchObject({
      ok: false,
      error: "content_mismatch",
    });
    expect(validate({ name: "logo.svg", type: "image/svg+xml" })).toMatchObject({
      ok: false,
      error: "unsupported_type",
    });
    expect(validate({ size: 20 * 1024 * 1024, bytes: png })).toMatchObject({
      ok: false,
      error: "too_large",
    });
    expect(validate({ size: 0, bytes: new Uint8Array() })).toMatchObject({
      ok: false,
      error: "empty_file",
    });
  });

  it("does not accept PDFs as workspace logos", () => {
    expect(
      validateUploadedFile({
        name: "logo.pdf",
        type: "application/pdf",
        size: pdf.byteLength,
        bytes: pdf,
        allowed: LOGO_MIMES,
        maxBytes: 2 * 1024 * 1024,
      }),
    ).toMatchObject({ ok: false, error: "unsupported_type" });
  });

  it("sanitises path traversal and control characters", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("my receipt (1).png")).toBe("my_receipt__1_.png");
    expect(safeFileName("")).toBe("file");
  });
});

describe("security headers", () => {
  const headers = buildSecurityHeaders({
    isDevelopment: false,
    appUrl: "https://app.kontaflow.com",
    supabaseUrl: "https://project.supabase.co",
  });
  const csp = headers.find((header) => header.key === "Content-Security-Policy")?.value ?? "";

  it("locks framing, plugins and base URLs", () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });

  it("allows only the app and Supabase connection targets", () => {
    expect(csp).toContain("https://project.supabase.co");
    expect(csp).toContain("wss://project.supabase.co");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("upgrade-insecure-requests");
  });

  it("adds transport and cross-origin protections", () => {
    expect(headers).toContainEqual({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains; preload",
    });
    expect(headers).toContainEqual({ key: "X-Frame-Options", value: "DENY" });
    expect(headers).toContainEqual({ key: "Cross-Origin-Opener-Policy", value: "same-origin" });
    expect(headers).toContainEqual({ key: "X-Content-Type-Options", value: "nosniff" });
  });

  it("only permits eval in development", () => {
    const dev = buildSecurityHeaders({ isDevelopment: true }).find(
      (header) => header.key === "Content-Security-Policy",
    )?.value;
    expect(dev).toContain("'unsafe-eval'");
    expect(dev).not.toContain("upgrade-insecure-requests");
  });
});
