import { z } from "zod";

const optionalSecret = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url("NEXT_PUBLIC_APP_URL must be an absolute URL"),
  NEXT_PUBLIC_SUPABASE_URL: z.url("NEXT_PUBLIC_SUPABASE_URL must be an absolute URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, "NEXT_PUBLIC_SUPABASE_ANON_KEY is required"),
  NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET: z.string().min(1).default("kontaflow-documents"),
  NEXT_PUBLIC_DEFAULT_LOCALE: z.enum(["en", "fr", "pcm"]).default("en"),
  NEXT_PUBLIC_TOLGEE_PROJECT_ID: optionalSecret,
});

const serverSchema = z.object({
  APP_ENV: z.enum(["development", "preview", "production", "test"]).default("development"),
  DEPLOYMENT_TARGET: z.enum(["local", "node", "vercel", "cloudflare"]).default("local"),
  SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
  SUPABASE_INTERNAL_URL: optionalSecret,
  SUPABASE_DB_URL: optionalSecret,
  OPENAI_API_KEY: optionalSecret,
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().min(64).max(4096).default(900),
  AI_MONTHLY_MESSAGE_QUOTA: z.coerce.number().int().min(1).default(300),
  RESEND_API_KEY: optionalSecret,
  EMAIL_FROM: z.string().default("KontaFlow <notifications@kontaflow.com>"),
  EMAIL_REPLY_TO: optionalSecret,
  CONTACT_INBOX_EMAIL: z.string().default("info@kontaflow.com"),
  AFRICASTALKING_USERNAME: z.string().default("sandbox"),
  AFRICASTALKING_API_KEY: optionalSecret,
  AFRICASTALKING_SENDER_ID: optionalSecret,
  SMS_PROVIDER: z.enum(["none", "africastalking", "console"]).default("none"),
  OTP_HMAC_SECRET: optionalSecret,
  USSD_SERVICE_CODE: optionalSecret,
  USSD_CALLBACK_TOKEN: optionalSecret,
  USSD_SESSION_TTL_SECONDS: z.coerce.number().int().min(30).max(600).default(180),
  WHATSAPP_PHONE_NUMBER_ID: optionalSecret,
  WHATSAPP_BUSINESS_ACCOUNT_ID: optionalSecret,
  WHATSAPP_ACCESS_TOKEN: optionalSecret,
  WHATSAPP_VERIFY_TOKEN: optionalSecret,
  WHATSAPP_APP_SECRET: optionalSecret,
  WHATSAPP_GRAPH_VERSION: z.string().regex(/^v\d+\.\d+$/, "WHATSAPP_GRAPH_VERSION must look like v27.0").default("v27.0"),
  WHATSAPP_DISPLAY_PHONE_NUMBER: optionalSecret,
  WHATSAPP_VERIFICATION_TEMPLATE_NAME: optionalSecret,
  WHATSAPP_VERIFICATION_TEMPLATE_LANG: z.string().default("en_US"),
  WHATSAPP_REPORT_TEMPLATE_NAME: optionalSecret,
  WHATSAPP_REPORT_TEMPLATE_LANG: z.string().default("en_US"),
  PAYMENT_PROVIDER: z.enum(["none", "mtn-momo", "orange-money", "aggregator", "stripe"]).default("none"),
  PAYMENT_MODE: z.enum(["disabled", "sandbox", "production"]).default("disabled"),
  PAYMENT_API_BASE_URL: optionalSecret,
  PAYMENT_API_KEY: optionalSecret,
  PAYMENT_API_USER_ID: optionalSecret,
  PAYMENT_API_SUBSCRIPTION_KEY: optionalSecret,
  PAYMENT_WEBHOOK_SECRET: optionalSecret,
  PAYMENT_AGGREGATOR_CREATE_PATH: z.string().default("/payments"),
  PAYMENT_AGGREGATOR_STATUS_PATH: z.string().default("/payments/{id}"),
  PAYMENT_AGGREGATOR_REFUND_PATH: z.string().default("/refunds"),
  PAYMENT_AGGREGATOR_SIGNATURE_HEADER: z.string().default("x-kontaflow-signature"),
  MTN_MOMO_BASE_URL: optionalSecret,
  MTN_MOMO_SUBSCRIPTION_KEY: optionalSecret,
  MTN_MOMO_API_USER_ID: optionalSecret,
  MTN_MOMO_API_KEY: optionalSecret,
  MTN_MOMO_TARGET_ENV: z.string().default("mtncameroon"),
  MTN_MOMO_WEBHOOK_SECRET: optionalSecret,
  MTN_MOMO_SIGNATURE_HEADER: z.string().default("x-mtn-signature"),
  ORANGE_MONEY_BASE_URL: z.url().default("https://api.orange.com"),
  ORANGE_MONEY_CLIENT_ID: optionalSecret,
  ORANGE_MONEY_CLIENT_SECRET: optionalSecret,
  ORANGE_MONEY_MERCHANT_KEY: optionalSecret,
  ORANGE_MONEY_WEBPAY_PATH: z.string().default("/orange-money-webpay/cm/v1/webpayment"),
  ORANGE_MONEY_STATUS_PATH: z.string().default("/orange-money-webpay/cm/v1/transactionstatus"),
  ORANGE_MONEY_WEBHOOK_SECRET: optionalSecret,
  ORANGE_MONEY_SIGNATURE_HEADER: z.string().default("x-orange-signature"),
  ORANGE_MONEY_LANG: z.enum(["en", "fr"]).default("en"),
  CRON_SECRET: optionalSecret,
  SYNC_SHARED_SECRET: optionalSecret,
  TOLGEE_API_URL: z.url().default("https://app.tolgee.io"),
  TOLGEE_API_KEY: optionalSecret,
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
  SENTRY_DSN: optionalSecret,
  TRUSTED_ORIGINS: optionalSecret,
  MALWARE_SCAN_MODE: z.enum(["disabled", "warn", "enforce"]).default("disabled"),
  MALWARE_SCAN_URL: optionalSecret,
  MALWARE_SCAN_API_KEY: optionalSecret,
  RATE_LIMIT_AI_PER_MINUTE: z.coerce.number().int().min(1).default(20),
  RATE_LIMIT_USSD_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  RATE_LIMIT_WHATSAPP_PER_MINUTE: z.coerce.number().int().min(1).default(30),
  RATE_LIMIT_WEBHOOK_PER_MINUTE: z.coerce.number().int().min(1).default(120),
  RATE_LIMIT_UPLOAD_PER_MINUTE: z.coerce.number().int().min(1).default(20),
  RATE_LIMIT_SYNC_PER_MINUTE: z.coerce.number().int().min(1).default(60),
  RATE_LIMIT_EXPORT_PER_MINUTE: z.coerce.number().int().min(1).default(10),
  SESSION_COOKIE_MAX_AGE_SECONDS: z.coerce.number().int().min(3600).max(2592000).default(604800),
});

export type PublicEnv = z.infer<typeof publicSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

export class EnvValidationError extends Error {
  readonly issues: string[];

  constructor(scope: string, issues: string[]) {
    super(
      `Invalid ${scope} environment configuration:\n${issues.map((i) => `  - ${i}`).join("\n")}\n` +
        "Copy .env.example to .env.local and fill in the values.",
    );
    this.name = "EnvValidationError";
    this.issues = issues;
  }
}

let cachedPublicEnv: PublicEnv | null = null;
let cachedServerEnv: ServerEnv | null = null;

function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`);
}

export function getPublicEnv(): PublicEnv {
  if (cachedPublicEnv) return cachedPublicEnv;

  const parsed = publicSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET: process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET,
    NEXT_PUBLIC_DEFAULT_LOCALE: process.env.NEXT_PUBLIC_DEFAULT_LOCALE,
    NEXT_PUBLIC_TOLGEE_PROJECT_ID: process.env.NEXT_PUBLIC_TOLGEE_PROJECT_ID,
  });

  if (!parsed.success) throw new EnvValidationError("public", formatIssues(parsed.error));
  cachedPublicEnv = parsed.data;
  return cachedPublicEnv;
}

export function getServerEnv(): ServerEnv {
  if (cachedServerEnv) return cachedServerEnv;

  const parsed = serverSchema.safeParse({
    APP_ENV: process.env.APP_ENV,
    DEPLOYMENT_TARGET: process.env.DEPLOYMENT_TARGET,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_INTERNAL_URL: process.env.SUPABASE_INTERNAL_URL,
    SUPABASE_DB_URL: process.env.SUPABASE_DB_URL,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
    AI_MAX_OUTPUT_TOKENS: process.env.AI_MAX_OUTPUT_TOKENS,
    AI_MONTHLY_MESSAGE_QUOTA: process.env.AI_MONTHLY_MESSAGE_QUOTA,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    EMAIL_FROM: process.env.EMAIL_FROM,
    EMAIL_REPLY_TO: process.env.EMAIL_REPLY_TO,
    CONTACT_INBOX_EMAIL: process.env.CONTACT_INBOX_EMAIL,
    AFRICASTALKING_USERNAME: process.env.AFRICASTALKING_USERNAME,
    AFRICASTALKING_API_KEY: process.env.AFRICASTALKING_API_KEY,
    AFRICASTALKING_SENDER_ID: process.env.AFRICASTALKING_SENDER_ID,
    SMS_PROVIDER: process.env.SMS_PROVIDER,
    OTP_HMAC_SECRET: process.env.OTP_HMAC_SECRET,
    USSD_SERVICE_CODE: process.env.USSD_SERVICE_CODE,
    USSD_CALLBACK_TOKEN: process.env.USSD_CALLBACK_TOKEN,
    USSD_SESSION_TTL_SECONDS: process.env.USSD_SESSION_TTL_SECONDS,
    WHATSAPP_PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    WHATSAPP_ACCESS_TOKEN: process.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
    WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET,
    WHATSAPP_GRAPH_VERSION: process.env.WHATSAPP_GRAPH_VERSION,
    WHATSAPP_DISPLAY_PHONE_NUMBER: process.env.WHATSAPP_DISPLAY_PHONE_NUMBER,
    WHATSAPP_VERIFICATION_TEMPLATE_NAME: process.env.WHATSAPP_VERIFICATION_TEMPLATE_NAME,
    WHATSAPP_VERIFICATION_TEMPLATE_LANG: process.env.WHATSAPP_VERIFICATION_TEMPLATE_LANG,
    WHATSAPP_REPORT_TEMPLATE_NAME: process.env.WHATSAPP_REPORT_TEMPLATE_NAME,
    WHATSAPP_REPORT_TEMPLATE_LANG: process.env.WHATSAPP_REPORT_TEMPLATE_LANG,
    PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER,
    PAYMENT_MODE: process.env.PAYMENT_MODE,
    PAYMENT_API_BASE_URL: process.env.PAYMENT_API_BASE_URL,
    PAYMENT_API_KEY: process.env.PAYMENT_API_KEY,
    PAYMENT_API_USER_ID: process.env.PAYMENT_API_USER_ID,
    PAYMENT_API_SUBSCRIPTION_KEY: process.env.PAYMENT_API_SUBSCRIPTION_KEY,
    PAYMENT_WEBHOOK_SECRET: process.env.PAYMENT_WEBHOOK_SECRET,
    PAYMENT_AGGREGATOR_CREATE_PATH: process.env.PAYMENT_AGGREGATOR_CREATE_PATH,
    PAYMENT_AGGREGATOR_STATUS_PATH: process.env.PAYMENT_AGGREGATOR_STATUS_PATH,
    PAYMENT_AGGREGATOR_REFUND_PATH: process.env.PAYMENT_AGGREGATOR_REFUND_PATH,
    PAYMENT_AGGREGATOR_SIGNATURE_HEADER: process.env.PAYMENT_AGGREGATOR_SIGNATURE_HEADER,
    MTN_MOMO_BASE_URL: process.env.MTN_MOMO_BASE_URL,
    MTN_MOMO_SUBSCRIPTION_KEY: process.env.MTN_MOMO_SUBSCRIPTION_KEY,
    MTN_MOMO_API_USER_ID: process.env.MTN_MOMO_API_USER_ID,
    MTN_MOMO_API_KEY: process.env.MTN_MOMO_API_KEY,
    MTN_MOMO_TARGET_ENV: process.env.MTN_MOMO_TARGET_ENV,
    MTN_MOMO_WEBHOOK_SECRET: process.env.MTN_MOMO_WEBHOOK_SECRET,
    MTN_MOMO_SIGNATURE_HEADER: process.env.MTN_MOMO_SIGNATURE_HEADER,
    ORANGE_MONEY_BASE_URL: process.env.ORANGE_MONEY_BASE_URL,
    ORANGE_MONEY_CLIENT_ID: process.env.ORANGE_MONEY_CLIENT_ID,
    ORANGE_MONEY_CLIENT_SECRET: process.env.ORANGE_MONEY_CLIENT_SECRET,
    ORANGE_MONEY_MERCHANT_KEY: process.env.ORANGE_MONEY_MERCHANT_KEY,
    ORANGE_MONEY_WEBPAY_PATH: process.env.ORANGE_MONEY_WEBPAY_PATH,
    ORANGE_MONEY_STATUS_PATH: process.env.ORANGE_MONEY_STATUS_PATH,
    ORANGE_MONEY_WEBHOOK_SECRET: process.env.ORANGE_MONEY_WEBHOOK_SECRET,
    ORANGE_MONEY_SIGNATURE_HEADER: process.env.ORANGE_MONEY_SIGNATURE_HEADER,
    ORANGE_MONEY_LANG: process.env.ORANGE_MONEY_LANG,
    CRON_SECRET: process.env.CRON_SECRET,
    SYNC_SHARED_SECRET: process.env.SYNC_SHARED_SECRET,
    TOLGEE_API_URL: process.env.TOLGEE_API_URL,
    TOLGEE_API_KEY: process.env.TOLGEE_API_KEY,
    LOG_LEVEL: process.env.LOG_LEVEL,
    SENTRY_DSN: process.env.SENTRY_DSN,
    TRUSTED_ORIGINS: process.env.TRUSTED_ORIGINS,
    MALWARE_SCAN_MODE: process.env.MALWARE_SCAN_MODE,
    MALWARE_SCAN_URL: process.env.MALWARE_SCAN_URL,
    MALWARE_SCAN_API_KEY: process.env.MALWARE_SCAN_API_KEY,
    RATE_LIMIT_AI_PER_MINUTE: process.env.RATE_LIMIT_AI_PER_MINUTE,
    RATE_LIMIT_USSD_PER_MINUTE: process.env.RATE_LIMIT_USSD_PER_MINUTE,
    RATE_LIMIT_WHATSAPP_PER_MINUTE: process.env.RATE_LIMIT_WHATSAPP_PER_MINUTE,
    RATE_LIMIT_WEBHOOK_PER_MINUTE: process.env.RATE_LIMIT_WEBHOOK_PER_MINUTE,
    RATE_LIMIT_UPLOAD_PER_MINUTE: process.env.RATE_LIMIT_UPLOAD_PER_MINUTE,
    RATE_LIMIT_SYNC_PER_MINUTE: process.env.RATE_LIMIT_SYNC_PER_MINUTE,
    RATE_LIMIT_EXPORT_PER_MINUTE: process.env.RATE_LIMIT_EXPORT_PER_MINUTE,
    SESSION_COOKIE_MAX_AGE_SECONDS: process.env.SESSION_COOKIE_MAX_AGE_SECONDS,
  });

  if (!parsed.success) throw new EnvValidationError("server", formatIssues(parsed.error));
  cachedServerEnv = parsed.data;
  return cachedServerEnv;
}

/** Server-side Supabase origin. Local previews can proxy through the app. */
export function getSupabaseServerUrl(): string {
  const internal = process.env.SUPABASE_INTERNAL_URL?.trim();
  if (internal) {
    const parsed = z.url().safeParse(internal);
    if (parsed.success) return parsed.data.replace(/\/$/, "");
  }
  return getPublicEnv().NEXT_PUBLIC_SUPABASE_URL;
}

/** True when the public Supabase credentials are present and well-formed. */
export function isSupabaseConfigured(): boolean {
  try {
    getPublicEnv();
    return true;
  } catch {
    return false;
  }
}

/** Test helper: forget memoized values. */
export function resetEnvCache(): void {
  cachedPublicEnv = null;
  cachedServerEnv = null;
}
