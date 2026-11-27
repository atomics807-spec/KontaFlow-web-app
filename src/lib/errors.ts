export type AppErrorCode =
  | "unauthenticated"
  | "forbidden"
  | "not_found"
  | "validation_failed"
  | "conflict"
  | "rate_limited"
  | "plan_required"
  | "limit_reached"
  | "integration_unavailable"
  | "configuration_missing"
  | "internal_error";

const STATUS_BY_CODE: Record<AppErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  validation_failed: 422,
  conflict: 409,
  rate_limited: 429,
  plan_required: 402,
  limit_reached: 402,
  integration_unavailable: 503,
  configuration_missing: 500,
  internal_error: 500,
};

export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  /** Message safe to surface to end users; never contains secrets or SQL. */
  readonly publicMessage: string;
  readonly details?: Record<string, string[]>;

  constructor(
    code: AppErrorCode,
    publicMessage: string,
    options?: { details?: Record<string, string[]>; cause?: unknown },
  ) {
    super(publicMessage, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.status = STATUS_BY_CODE[code];
    this.publicMessage = publicMessage;
    this.details = options?.details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function normalizeError(error: unknown): AppError {
  if (isAppError(error)) return error;
  return new AppError("internal_error", "Something went wrong. Please try again.", {
    cause: error,
  });
}

export type ActionState<T = undefined> =
  | { status: "idle" }
  | { status: "error"; message: string; code: AppErrorCode; fieldErrors?: Record<string, string[]> }
  | { status: "success"; data: T };

export function toActionState(error: unknown): ActionState<never> {
  const normalized = normalizeError(error);
  return {
    status: "error",
    code: normalized.code,
    message: normalized.publicMessage,
    fieldErrors: normalized.details,
  };
}

export const idleState: ActionState<never> = { status: "idle" };
