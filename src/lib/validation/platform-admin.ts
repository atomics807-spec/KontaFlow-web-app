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

export const planSaveSchema = z.object({
  planCode: z.enum(["starter", "growth", "scale"]),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(500).default(""),
  priceMinor: z.coerce.number().int().min(0),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  billingInterval: z.enum(["month", "year"]).default("month"),
  seats: z.coerce.number().int().min(1).max(100000),
  workspaceLimit: optionalLimit(1),
  aiMessageLimit: z.coerce.number().int().min(0),
  transactionLimit: optionalLimit(1),
  integrationLimit: optionalLimit(0),
  exportLimit: optionalLimit(0),
  sortOrder: z.coerce.number().int().min(0).max(100),
  isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const billingSettingsSchema = z.object({
  trialDays: z.coerce.number().int().min(1).max(90),
  trialPlanCode: z.enum(["starter", "growth", "scale"]),
  reminderDays: z
    .string()
    .trim()
    .default("7,3,1")
    .transform((value) =>
      [...new Set(value.split(",").map((part) => Number(part.trim())).filter((day) => Number.isInteger(day) && day >= 1 && day <= 90))].sort(
        (a, b) => b - a,
      ),
    )
    .refine((days) => days.length > 0, "Add at least one reminder day."),
});

function emptyToNull(value: unknown): unknown {
  return value === "" || value === null || value === undefined ? null : value;
}

function optionalLimit(minimum: number) {
  return z.preprocess(emptyToNull, z.union([z.null(), z.coerce.number().int().min(minimum)]));
}

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

export const announcementSchema = z
  .object({
    id: z.preprocess(emptyToNull, z.union([z.null(), uuid])),
    title: z.string().trim().min(3, "Enter a title of at least 3 characters.").max(160),
    body: z.string().trim().min(3, "Enter a message of at least 3 characters.").max(2000),
    tone: z.enum(["info", "success", "warning", "critical"]),
    audience: z.enum(["all", "workspace_admins"]),
    startsAt: z.preprocess(emptyToNull, z.union([z.null(), z.iso.datetime({ local: true })])),
    endsAt: z.preprocess(emptyToNull, z.union([z.null(), z.iso.datetime({ local: true })])),
    isActive: z.enum(["true", "false"]).transform((value) => value === "true"),
  })
  .refine((value) => !value.endsAt || !value.startsAt || value.endsAt > value.startsAt, {
    path: ["endsAt"],
    message: "The end time must be after the start time.",
  });

export const announcementToggleSchema = z.object({
  id: uuid,
  active: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export const supportRequestStatusSchema = z.object({
  id: uuid,
  status: z.enum(["new", "read", "replied", "closed", "spam"]),
});

export const supportAccessRequestSchema = z.object({
  workspaceId: uuid,
  justification: z
    .string()
    .trim()
    .min(20, "Explain what you need to investigate (at least 20 characters).")
    .max(1000),
  hours: z.coerce.number().int().min(1).max(72),
});

export const supportAccessDecisionSchema = z.object({
  grantId: uuid,
  decision: z.enum(["approve", "deny"]),
  note: z.string().trim().max(500).optional(),
});

export const supportAccessRevokeSchema = z.object({
  grantId: uuid,
  reason: z.string().trim().max(500).optional(),
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
