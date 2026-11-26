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
import { logger } from "@/lib/logger";

function reply(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" },
  });
}

const MENU = [
  "KontaFlow",
  "1. Record sale",
  "2. Record expense",
  "3. Cash on hand",
  "4. Last entries",
  "",
  "Reply with a number.",
].join("\n");

export async function POST(request: Request) {
  const env = getServerEnv();

  if (env.USSD_CALLBACK_TOKEN) {
    const url = new URL(request.url);
    const provided = url.searchParams.get("token") ?? request.headers.get("x-ussd-token") ?? "";
    if (!safeEqual(provided, env.USSD_CALLBACK_TOKEN)) {
      logger.warn("ussd.bad_token");
      return reply("END Service unavailable.", 403);
    }
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply("END Invalid request.", 400);
  }

  const sessionId = String(form.get("sessionId") ?? "").slice(0, 120);
  const phone = String(form.get("phoneNumber") ?? "").slice(0, 24);
  const text = String(form.get("text") ?? "").slice(0, 120);
  const serviceCode = String(form.get("serviceCode") ?? "").slice(0, 32);

  if (!phone) return reply("END Missing phone number.", 400);

  const key = `ussd:${createHash("sha256").update(phone).digest("hex").slice(0, 16)}`;
  if (!rateLimit(key, env.RATE_LIMIT_USSD_PER_MINUTE)) {
    return reply("END Too many requests. Try again in a minute.", 429);
  }

  if (!hasServiceRole()) {
    logger.error("ussd.service_role_missing");
    return reply("END KontaFlow is not fully configured yet.");
  }

  const identity = await resolveChannelIdentity("ussd", phone);
  if (!identity) {
    return reply("END This number is not linked to a KontaFlow business. Ask the owner to add it in Settings > Connected channels.");
  }

  await logUssdSession({
    sessionId: sessionId || `anon-${Date.now()}`,
    phone,
    workspaceId: identity.workspaceId,
    userId: identity.userId,
    state: { text },
    serviceCode,
  }).catch(() => undefined);

  const [step, ...rest] = text.split("*").filter((part) => part.length > 0);

  if (!step) return reply(`CON ${MENU}`);

  if (step === "3") {
    const balance = await cashBalance(identity.workspaceId);
    return reply(`END Cash on hand: ${formatMinor(balance.minor, balance.currency)}`);
  }

  if (step === "4") {
    const entries = await recentEntries(identity.workspaceId, 3);
    if (entries.length === 0) return reply("END No entries yet.");
    const lines = entries.map((entry) => {
      const sign = entry.kind === "income" ? "+" : entry.kind === "expense" ? "-" : "";
      return `${entry.occurred_on} ${sign}${formatMinor(BigInt(String(entry.amount_minor)), entry.currency)}`;
    });
    return reply(`END Recent:\n${lines.join("\n")}`);
  }

  if (step === "1" || step === "2") {
    const kind = step === "1" ? "income" : "expense";
    if (rest.length === 0) {
      return reply(`CON ${kind === "income" ? "Sale" : "Expense"} amount in FCFA (digits only):`);
    }

    const account = await defaultCashAccount(identity.workspaceId);
    if (!account) return reply("END No cash account found for this business.");

    const raw = rest[0];
    let amountMinor: bigint;
    try {
      amountMinor = parseMoneyToMinor(raw, account.currency);
    } catch {
      return reply("END Invalid amount. Start again.");
    }
    if (amountMinor <= 0n) return reply("END Amount must be more than zero.");

    const categoryId = await categoryFor(identity.workspaceId, kind);
    const description = kind === "income" ? "Sale via USSD" : "Expense via USSD";

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
        `END ${created.duplicate ? "Already recorded" : "Recorded"}: ${formatMinor(amountMinor, account.currency)}.\nCash on hand: ${formatMinor(balance.minor, balance.currency)}`,
      );
    } catch (error) {
      logger.warn("ussd.record_failed", { error });
      return reply("END Could not record that. Please try again.");
    }
  }

  if (step === "0") return reply(`CON ${MENU}`);

  return reply("END Invalid choice. Dial again.");
}
