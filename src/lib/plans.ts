import type { WorkspacePlan } from "@/types/database";

export const PLAN_CODES: readonly WorkspacePlan[] = ["starter", "growth", "scale"];

export function isWorkspacePlan(value: unknown): value is WorkspacePlan {
  return typeof value === "string" && (PLAN_CODES as readonly string[]).includes(value);
}
