import type { z } from "zod";

export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialFormState: FormState = { status: "idle" };

export function fieldErrorsFrom(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    (result[key] ??= []).push(issue.message);
  }
  return result;
}

export function formError(message: string, fieldErrors?: Record<string, string[]>): FormState {
  return { status: "error", message, fieldErrors };
}

export function formSuccess(message?: string): FormState {
  return { status: "success", message };
}

/** Prevents open redirects: only same-origin absolute paths are allowed. */
export function safeNextPath(value: FormDataEntryValue | null, fallback: string): string {
  const path = typeof value === "string" ? value.trim() : "";
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return fallback;
  return path;
}
