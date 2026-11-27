export const JOB_TYPES = {
  aiBookkeeping: "ai.bookkeeping",
  aiInsight: "ai.insight",
  reportDaily: "report.daily",
  reportWeekly: "report.weekly",
  reportMonthly: "report.monthly",
  email: "notification.email",
  whatsapp: "notification.whatsapp",
  ussd: "channel.ussd",
  paymentWebhook: "payment.webhook",
  offlineSync: "sync.batch",
  dataExport: "export.data",
} as const;

export type JobType = (typeof JOB_TYPES)[keyof typeof JOB_TYPES] | string;

export type JobStatus = "queued" | "processing" | "completed" | "failed" | "retrying" | "dead_lettered";

export type EnqueueJobInput = {
  type: JobType;
  payload?: Record<string, unknown>;
  workspaceId?: string | null;
  actorId?: string | null;
  priority?: number;
  runAt?: Date;
  maxAttempts?: number;
  idempotencyKey?: string | null;
};

export type JobHandlerResult = {
  result?: Record<string, unknown>;
  resultRef?: string;
};

export type JobHandler = (job: import("@/types/database").JobRow) => Promise<JobHandlerResult | void>;

export type DrainResult = {
  claimed: number;
  completed: number;
  failed: number;
  deadLettered: number;
  outboxDelivered: number;
  outboxFailed: number;
};
