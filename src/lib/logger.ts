import { getServerEnv } from "./env";

export type LogLevel = "debug" | "info" | "warn" | "error";

const LEVEL_WEIGHT: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

const REDACTED_KEYS = new Set([
  "password",
  "token",
  "access_token",
  "refresh_token",
  "authorization",
  "apikey",
  "api_key",
  "secret",
  "service_role_key",
  "cookie",
  "set-cookie",
]);

type LogContext = Record<string, unknown>;

function currentLevel(): LogLevel {
  try {
    return getServerEnv().LOG_LEVEL;
  } catch {
    return "info";
  }
}

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => redact(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        REDACTED_KEYS.has(key.toLowerCase()) ? "[redacted]" : redact(item, depth + 1),
      ]),
    );
  }
  return value;
}

function emit(level: LogLevel, message: string, context?: LogContext): void {
  if (LEVEL_WEIGHT[level] < LEVEL_WEIGHT[currentLevel()]) return;

  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(context ? (redact(context) as Record<string, unknown>) : {}),
  };

  const line = JSON.stringify(entry);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export const logger = {
  debug: (message: string, context?: LogContext) => emit("debug", message, context),
  info: (message: string, context?: LogContext) => emit("info", message, context),
  warn: (message: string, context?: LogContext) => emit("warn", message, context),
  error: (message: string, context?: LogContext) => emit("error", message, context),
  child: (base: LogContext) => ({
    debug: (message: string, context?: LogContext) => emit("debug", message, { ...base, ...context }),
    info: (message: string, context?: LogContext) => emit("info", message, { ...base, ...context }),
    warn: (message: string, context?: LogContext) => emit("warn", message, { ...base, ...context }),
    error: (message: string, context?: LogContext) => emit("error", message, { ...base, ...context }),
  }),
};
