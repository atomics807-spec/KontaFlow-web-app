import { createHash } from "node:crypto";
import { getServerEnv } from "@/lib/env";
import { hasServiceRole } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { safeEqual } from "@/lib/integrations/whatsapp";
import {
  cashBalance,
  categoryFor,
  defaultCashAccount,
  formatMinor,
  logUssdSession,
  recentEntries,
  recordChannelTransaction,
  resolveChannelIdentity,
} from "@/lib/channels";
import { parseMoneyToMinor } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { DEFAULT_LOCALE, intlLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/interpolate";
import { logger } from "@/lib/logger";

function reply(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

export async function POST(request: Request) {
  const env = getServerEnv();
  let dict = await getDictionary(DEFAULT_LOCALE);

  if (env.USSD_CALLBACK_TOKEN) {
    const url = new URL(request.url);
    const provided = url.searchParams.get("token") ?? request.headers.get("x-ussd-token") ?? "";
    if (!safeEqual(provided, env.USSD_CALLBACK_TOKEN)) {
      logger.warn("ussd.bad_token");
      return reply(`END ${dict.channels.ussd.serviceUnavailable}`, 403);
    }
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply(`END ${dict.channels.ussd.invalidRequest}`, 400);
  }

  const sessionId = String(form.get("sessionId") ?? "").slice(0, 120);
  const phone = String(form.get("phoneNumber") ?? "").slice(0, 24);
  const text = String(form.get("text") ?? "").slice(0, 120);
  const serviceCode = String(form.get("serviceCode") ?? "").slice(0, 32);

  if (!phone) return reply(`END ${dict.channels.ussd.missingPhone}`, 400);

  const key = `ussd:${createHash("sha256").update(phone).digest("hex").slice(0, 16)}`;
  if (!rateLimit(key, env.RATE_LIMIT_USSD_PER_MINUTE)) {
    return reply(`END ${dict.channels.ussd.tooManyRequests}`, 429);
  }

  if (!hasServiceRole()) {
    logger.error("ussd.service_role_missing");
    return reply(`END ${dict.channels.ussd.notConfigured}`);
  }

  const identity = await resolveChannelIdentity("ussd", phone);
  if (!identity) {
    return reply(`END ${dict.channels.ussd.notLinked}`);
  }

  dict = await getDictionary(identity.locale);
  const copy = dict.channels.ussd;
  const format = (template: string, values: Record<string, string | number> = {}) =>
    interpolate(template, values, { locale: intlLocale(identity.locale) });

  await logUssdSession({
    sessionId: sessionId || `anon-${Date.now()}`,
    phone,
    workspaceId: identity.workspaceId,
    userId: identity.userId,
    state: { text },
    serviceCode,
  }).catch(() => undefined);

  const [step, ...rest] = text.split("*").filter((part) => part.length > 0);

  if (!step) return reply(`CON ${copy.menu}`);

  if (step === "3") {
    const balance = await cashBalance(identity.workspaceId);
    return reply(`END ${format(copy.cashOnHand, { amount: formatMinor(balance.minor, balance.currency, identity.locale) })}`);
  }

  if (step === "4") {
    const entries = await recentEntries(identity.workspaceId, 3);
    if (entries.length === 0) return reply(`END ${copy.noEntries}`);
    const lines = entries.map((entry) => {
      const sign = entry.kind === "income" ? "+" : entry.kind === "expense" ? "-" : "";
      return `${formatDate(entry.occurred_on, intlLocale(identity.locale))} ${sign}${formatMinor(BigInt(String(entry.amount_minor)), entry.currency, identity.locale)}`;
    });
    return reply(`END ${copy.recent}\n${lines.join("\n")}`);
  }

  if (step === "1" || step === "2") {
    const kind = step === "1" ? "income" : "expense";
    if (rest.length === 0) {
      return reply(`CON ${kind === "income" ? copy.salePrompt : copy.expensePrompt}`);
    }

    const account = await defaultCashAccount(identity.workspaceId);
    if (!account) return reply(`END ${copy.noCashAccount}`);

    const raw = rest[0];
    let amountMinor: bigint;
    try {
      amountMinor = parseMoneyToMinor(raw, account.currency);
    } catch {
      return reply(`END ${copy.invalidAmount}`);
    }
    if (amountMinor <= 0n) return reply(`END ${copy.amountTooLow}`);

    const categoryId = await categoryFor(identity.workspaceId, kind);
    const description = kind === "income" ? copy.saleDescription : copy.expenseDescription;

    try {
      const created = await recordChannelTransaction({
        workspaceId: identity.workspaceId,
        actorId: identity.userId,
        channel: "ussd",
        kind,
        amountMinor,
        description,
        accountId: account.id,
        paymentMethod: "cash",
        clientGeneratedId: `ussd-${sessionId || phone}-${step}-${raw}`.slice(0, 120),
        categoryId,
      });

      const balance = await cashBalance(identity.workspaceId);
      return reply(
        `END ${format(created.duplicate ? copy.alreadyRecorded : copy.recorded, {
          amount: formatMinor(amountMinor, account.currency, identity.locale),
          balance: formatMinor(balance.minor, balance.currency, identity.locale),
        })}`,
      );
    } catch (error) {
      logger.warn("ussd.record_failed", { error });
      return reply(`END ${copy.recordFailed}`);
    }
  }

  if (step === "0") return reply(`CON ${copy.menu}`);

  return reply(`END ${copy.invalidChoice}`);
}
