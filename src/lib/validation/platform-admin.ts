import { z } from "zod";
import { emailSchema, passwordSchema } from "@/lib/validation/schemas";
import {
  PLATFORM_ADMIN_ROLES,
  RESTRICTION_SEVERITIES,
} from "@/types/platform-admin";

const uuid = z.uuid("Select a valid option.");

export const RESTRICTION_DURATIONS = ["24h", "7d", "30d", "forever"] as const;
export type RestrictionDuration = (typeof RESTRICTION_DURATIONS)[number];

export const restrictUserSchema = z.object({
  userId: uuid,
  severity: z.enum(RESTRICTION_SEVERITIES),
  reason: z
    .string()
    .trim()
    .min(5, "Explain why this account is being restricted.")
    .max(1000, "Keep the reason under 1000 characters."),
  duration: z.enum(RESTRICTION_DURATIONS).default("7d"),
});

export const liftRestrictionSchema = z.object({
  restrictionId: uuid,
  reason: z.string().trim().max(500).optional(),
});

export const workspacePlanSchema = z.object({
  workspaceId: uuid,
  plan: z.enum(["starter", "growth", "scale"]),
  note: z.string().trim().max(500).optional(),
});

export const createPlatformAdminSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the person's name.").max(120),
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(PLATFORM_ADMIN_ROLES),
});

export const platformAdminStatusSchema = z.object({
  userId: uuid,
  active: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export function expiryFromDuration(duration: RestrictionDuration, now = new Date()): string | null {
  if (duration === "forever") return null;
  const hours = duration === "24h" ? 24 : duration === "7d" ? 24 * 7 : 24 * 30;
  return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
}

export function banDurationForExpiry(expiresAt: string | null, now = new Date()): string {
  if (!expiresAt) return "876000h";
  const hours = Math.max(1, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / 3_600_000));
  return `${hours}h`;
}
