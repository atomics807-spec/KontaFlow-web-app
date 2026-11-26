import { describe, expect, it } from "vitest";
import {
  banDurationForExpiry,
  createPlatformAdminSchema,
  expiryFromDuration,
  platformAdminStatusSchema,
  restrictUserSchema,
} from "@/lib/validation/platform-admin";

const NOW = new Date("2026-01-15T12:00:00.000Z");
const USER = "11111111-1111-4111-8111-111111111111";

describe("platform admin validation", () => {
  it("turns duration choices into exact expiry timestamps", () => {
    expect(expiryFromDuration("24h", NOW)).toBe("2026-01-16T12:00:00.000Z");
    expect(expiryFromDuration("7d", NOW)).toBe("2026-01-22T12:00:00.000Z");
    expect(expiryFromDuration("30d", NOW)).toBe("2026-02-14T12:00:00.000Z");
    expect(expiryFromDuration("forever", NOW)).toBeNull();
  });

  it("converts an expiry into a Supabase ban duration", () => {
    expect(banDurationForExpiry("2026-01-16T12:00:00.000Z", NOW)).toBe("24h");
    expect(banDurationForExpiry("2026-01-15T12:01:00.000Z", NOW)).toBe("1h");
    expect(banDurationForExpiry(null, NOW)).toBe("876000h");
  });

  it("requires a meaningful restriction reason", () => {
    const result = restrictUserSchema.safeParse({
      userId: USER,
      severity: "limited",
      reason: "no",
      duration: "7d",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a suspended restriction", () => {
    const result = restrictUserSchema.safeParse({
      userId: USER,
      severity: "suspended",
      reason: "Fraud investigation opened by the payments desk.",
      duration: "30d",
    });
    expect(result.success).toBe(true);
  });

  it("rejects unknown platform roles", () => {
    const result = createPlatformAdminSchema.safeParse({
      fullName: "Platform Operator",
      email: "operator@example.com",
      password: "StrongPass123",
      role: "owner",
    });
    expect(result.success).toBe(false);
  });

  it("accepts a strong separate super-admin credential", () => {
    const result = createPlatformAdminSchema.safeParse({
      fullName: "Platform Operator",
      email: "operator@example.com",
      password: "StrongPass123",
      role: "super_admin",
    });
    expect(result.success).toBe(true);
  });

  it("normalises the admin status checkbox value", () => {
    expect(platformAdminStatusSchema.parse({ userId: USER, active: "true" }).active).toBe(true);
    expect(platformAdminStatusSchema.parse({ userId: USER, active: "false" }).active).toBe(false);
  });
});
