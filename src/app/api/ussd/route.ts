import { createHash } from "node:crypto";
import { addDays, todayInZone } from "@/lib/dates";
import { getServerEnv } from "@/lib/env";
import { hasServiceRole } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { safeEqual } from "@/lib/security/safe-equal";
import { buildChannelAccess, type ChannelAccess } from "@/lib/channels/access";
import {
  dashboardSummaryAsService,
  receivablesAsService,
  reportAsService,
} from "@/lib/channels/data";
import { cashBalance, defaultCashAccount, formatMinor, recordChannelTransaction } from "@/lib/channels";
import { toMinorUnits } from "@/lib/money";
import { DEFAULT_LOCALE, intlLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/interpolate";
import { logger } from "@/lib/logger";
import {
  findUssdIdentity,
  resolveUssdLocale,
  setUssdLocale,
  verifyPendingUssdIdentity,
} from "@/lib/ussd/identity";
import { listUssdCategories } from "@/lib/ussd/categories";
import { USSD_LANGUAGES } from "@/lib/ussd/commands";
import {
  clampUssdResponse,
  isUssdSessionExpired,
  lastUssdInput,
  parseUssdAmount,
  parseUssdText,
  ussdClientId,
  type UssdKind,
  type UssdSessionState,
} from "@/lib/ussd/menu";
import { completeUssdSession, loadUssdSession, saveUssdSession } from "@/lib/ussd/session";

type Dictionary = Awaited<ReturnType<typeof getDictionary>>;
type UssdCopy = Dictionary["channels"]["ussd"];

function reply(kind: "CON" | "END", body: string, status = 200): Response {
  return new Response(clampUssdResponse(kind, body), {
    status,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "referrer-policy": "no-referrer",
    },
  });
}

function deniedMessage(copy: UssdCopy, access: ChannelAccess): string {
  if (!access.activeMember) return access.restricted ? copy.restricted : copy.accessRevoked;
  if (!access.subscriptionReadable) return copy.subscriptionInactive;
  if (!access.subscriptionWritable) return copy.subscriptionReadOnly;
  return copy.noPermission;
}

function samePhone(left: string, right: string): boolean {
  return left.replace(/[^\d]/g, "") === right.replace(/[^\d]/g, "");
}

function amountOrNull(raw: string, currency: string): bigint | null {
  try {
    return parseUssdAmount(raw, currency);
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<Response> {
  const env = getServerEnv();
  const fallbackDict = await getDictionary(DEFAULT_LOCALE);
  const fallbackCopy = fallbackDict.channels.ussd;
  let copy = fallbackCopy;

  const callbackToken = env.USSD_CALLBACK_TOKEN;
  if (!callbackToken) {
    logger.error("ussd.callback_token_missing");
    return reply("END", fallbackCopy.notConfigured, 503);
  }

  const url = new URL(request.url);
  const provided = url.searchParams.get("token") ?? request.headers.get("x-ussd-token") ?? "";
  if (!safeEqual(provided, callbackToken)) {
    logger.warn("ussd.bad_token");
    return reply("END", fallbackCopy.serviceUnavailable, 403);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return reply("END", fallbackCopy.invalidRequest, 400);
  }

  const sessionId = String(form.get("sessionId") ?? "").trim().slice(0, 120);
  const phone = String(form.get("phoneNumber") ?? "").trim().slice(0, 24);
  const text = String(form.get("text") ?? "").slice(0, 120);
  const serviceCode = String(form.get("serviceCode") ?? "").trim().slice(0, 32);

  if (!sessionId) return reply("END", fallbackCopy.missingSession, 400);
  if (!phone) return reply("END", fallbackCopy.missingPhone, 400);
  if (env.USSD_SERVICE_CODE && serviceCode !== env.USSD_SERVICE_CODE) {
    logger.warn("ussd.service_code_mismatch");
    return reply("END", fallbackCopy.serviceUnavailable, 403);
  }

  const key = `ussd:${createHash("sha256").update(phone).digest("hex").slice(0, 16)}`;
  if (!rateLimit(key, env.RATE_LIMIT_USSD_PER_MINUTE)) {
    return reply("END", fallbackCopy.tooManyRequests, 429);
  }

  if (!hasServiceRole()) {
    logger.error("ussd.service_role_missing");
    return reply("END", fallbackCopy.notConfigured, 503);
  }

  try {
    const identity = await findUssdIdentity(phone);
    if (!identity) return reply("END", fallbackCopy.notLinked);

    const locale = await resolveUssdLocale(identity);
    const dict = await getDictionary(locale);
    copy = dict.channels.ussd;
    const format = (template: string, values: Record<string, string | number> = {}) =>
      interpolate(template, values, { locale: intlLocale(locale) });

    if (!identity.verified_at) {
      if (!text.trim()) return reply("CON", copy.verifyPrompt);
      const code = lastUssdInput(text);
      if (!/^\d{6}$/.test(code)) return reply("CON", copy.verifyInvalidFormat);

      const result = await verifyPendingUssdIdentity(phone, code);
      switch (result.status) {
        case "verified":
        case "already":
          return reply("END", copy.verifySuccess);
        case "invalid":
          return result.remaining > 0
            ? reply("CON", format(copy.verifyInvalid, { remaining: result.remaining }))
            : reply("END", copy.verifyLocked);
        case "expired":
          return reply("END", copy.verifyExpired);
        case "locked":
          return reply("END", copy.verifyLocked);
        case "unavailable":
          return reply("END", copy.notConfigured);
        case "missing":
          return reply("END", copy.verifyMissing);
      }
    }

    const access = await buildChannelAccess(identity);
    if (!access.activeMember) {
      return reply("END", access.restricted ? copy.restricted : copy.accessRevoked);
    }
    if (!access.subscriptionReadable) return reply("END", copy.subscriptionInactive);

    let existing = await loadUssdSession(sessionId);
    if (existing && !samePhone(existing.phone, phone)) {
      return reply("END", copy.invalidSession);
    }
    if (
      existing &&
      (existing.userId !== identity.user_id || existing.workspaceId !== identity.workspace_id)
    ) {
      return reply("END", copy.invalidSession);
    }
    if (existing && isUssdSessionExpired(existing.expiresAt)) {
      if (text.trim()) return reply("END", copy.sessionExpired);
      existing = null;
    }
    if (!existing && text.trim()) return reply("END", copy.missingSession);

    if (existing?.state.completedAt) {
      if (existing.state.lastText === text && existing.state.response) {
        return reply("END", existing.state.response);
      }
      return reply("END", copy.sessionExpired);
    }
    if (existing?.state.lastText && text && !text.startsWith(existing.state.lastText)) {
      return reply("END", copy.invalidSession);
    }

    let state: UssdSessionState = existing?.state ?? { version: 1, stage: "menu" };

    const prompt = async (next: UssdSessionState, body: string) => {
      state = { ...next, lastText: text };
      await saveUssdSession({
        sessionId,
        phone,
        userId: identity.user_id,
        workspaceId: identity.workspace_id,
        state,
        serviceCode,
      });
      return reply("CON", body);
    };

    const finish = async (body: string) => {
      await completeUssdSession({
        sessionId,
        phone,
        userId: identity.user_id,
        workspaceId: identity.workspace_id,
        state,
        text,
        response: body,
      });
      return reply("END", body);
    };

    if (!text.trim()) {
      return prompt({ version: 1, stage: "menu" }, copy.menu);
    }

    const parts = parseUssdText(text);
    const [first, second, third, fourth] = parts;

    if (first === "0") return finish(copy.goodbye);

    if (first === "6") {
      if (parts.length === 1) return prompt({ version: 1, stage: "language" }, copy.languageMenu);
      if (parts.length === 2) {
        if (second === "0") return finish(copy.cancelled);
        const language = USSD_LANGUAGES[Number(second) - 1];
        if (!language) return finish(copy.invalidChoice);
        await setUssdLocale(identity, language.value);
        const nextDict = await getDictionary(language.value);
        return finish(
          interpolate(
            nextDict.channels.ussd.languageSet,
            { language: language.label },
            { locale: intlLocale(language.value) },
          ),
        );
      }
      return finish(copy.invalidChoice);
    }

    if (first === "3" || first === "4" || first === "5") {
      if (parts.length !== 1) return finish(copy.invalidChoice);
      if (!access.readAllowed) return finish(deniedMessage(copy, access));

      try {
        const today = todayInZone(access.workspace.timezone);
        if (first === "3") {
          const summary = await dashboardSummaryAsService(identity.workspace_id, today, today);
          const currency = summary.workspace.currency;
          return finish(
            format(copy.todaySummary, {
              income: formatMinor(toMinorUnits(summary.totalIncomeMinor), currency, locale),
              expenses: formatMinor(toMinorUnits(summary.totalExpenseMinor), currency, locale),
              net: formatMinor(toMinorUnits(summary.netProfitMinor), currency, locale),
              cash: formatMinor(toMinorUnits(summary.cashBalanceMinor), currency, locale),
            }),
          );
        }
        if (first === "4") {
          const report = await reportAsService(identity.workspace_id, addDays(today, -6), today);
          const currency = access.workspace.currency;
          return finish(
            format(copy.weekSummary, {
              income: formatMinor(toMinorUnits(report.revenueMinor), currency, locale),
              expenses: formatMinor(toMinorUnits(report.expenseMinor), currency, locale),
              net: formatMinor(toMinorUnits(report.netProfitMinor), currency, locale),
            }),
          );
        }
        const debts = await receivablesAsService(identity.workspace_id);
        if (debts.count === 0) return finish(copy.noDebts);
        return finish(
          format(copy.debts, {
            total: formatMinor(debts.totalMinor, debts.currency, locale),
            count: String(debts.count),
            overdue: formatMinor(debts.overdueMinor, debts.currency, locale),
          }),
        );
      } catch (error) {
        logger.warn("ussd.read_failed", { error });
        return finish(copy.serviceUnavailable);
      }
    }

    if (first === "1" || first === "2") {
      const kind: UssdKind = first === "1" ? "income" : "expense";
      if (!access.writeAllowed) return finish(deniedMessage(copy, access));

      if (parts.length === 1) {
        return prompt(
          { version: 1, stage: "amount", kind },
          kind === "income" ? copy.amountIncomePrompt : copy.amountExpensePrompt,
        );
      }

      if (parts.length === 2) {
        if (second === "0") return finish(copy.cancelled);
        const account = await defaultCashAccount(identity.workspace_id);
        if (!account) return finish(copy.noCashAccount);
        const amount = amountOrNull(second, account.currency);
        if (amount === null) return finish(copy.invalidAmount);

        const options = await listUssdCategories(identity.workspace_id, kind, locale);
        if (options.length === 0) return finish(copy.noCategory);
        const categoryMenu = [
          copy.categoryPrompt,
          ...options.map((option, index) => `${index + 1}. ${option.label}`),
          "0 Cancel",
        ].join("\n");
        return prompt(
          {
            version: 1,
            stage: "category",
            kind,
            amountMinor: amount.toString(),
            categoryIds: options.map((option) => option.id),
            accountId: account.id,
            currency: account.currency,
          },
          categoryMenu,
        );
      }

      if (parts.length === 3) {
        if (third === "0") return finish(copy.cancelled);
        const currency = state.currency ?? access.workspace.currency;
        const amount = amountOrNull(second, currency);
        if (amount === null) return finish(copy.invalidAmount);
        const categoryIds = state.categoryIds ?? [];
        const selected = Number(third);
        if (!Number.isInteger(selected) || selected < 1 || selected > categoryIds.length) {
          return finish(copy.invalidChoice);
        }
        if (state.kind !== kind || state.amountMinor !== amount.toString() || !state.accountId) {
          return finish(copy.invalidSession);
        }
        return prompt(
          {
            ...state,
            stage: "confirm",
            categoryId: categoryIds[selected - 1],
          },
          format(
            kind === "income" ? copy.confirmIncome : copy.confirmExpense,
            { amount: formatMinor(amount, currency, locale) },
          ),
        );
      }

      if (parts.length === 4) {
        if (fourth === "2" || fourth === "0") return finish(copy.cancelled);
        if (fourth !== "1") return finish(copy.invalidChoice);
        if (state.stage !== "confirm" || !state.amountMinor || !state.accountId || !state.categoryId) {
          return finish(copy.invalidSession);
        }
        const accountId = state.accountId;
        const categoryId = state.categoryId;
        const currency = state.currency ?? access.workspace.currency;
        const amount = amountOrNull(state.amountMinor, currency);
        if (amount === null) return finish(copy.invalidAmount);
        if (state.kind !== kind) return finish(copy.invalidSession);

        try {
          const created = await recordChannelTransaction({
            workspaceId: identity.workspace_id,
            actorId: identity.user_id,
            channel: "ussd",
            kind,
            amountMinor: amount,
            description: kind === "income" ? copy.saleDescription : copy.expenseDescription,
            accountId,
            paymentMethod: "cash",
            categoryId,
            clientGeneratedId: ussdClientId(sessionId, text),
          });
          let body: string;
          try {
            const balance = await cashBalance(identity.workspace_id);
            body = format(created.duplicate ? copy.alreadyRecorded : copy.recorded, {
              amount: formatMinor(amount, currency, locale),
              balance: formatMinor(balance.minor, balance.currency, locale),
            });
          } catch (error) {
            logger.warn("ussd.balance_after_record_failed", { error });
            body = format(copy.recordedNoBalance, { amount: formatMinor(amount, currency, locale) });
          }
          return finish(body);
        } catch (error) {
          logger.warn("ussd.record_failed", { error });
          return finish(copy.recordFailed);
        }
      }

      return finish(copy.invalidChoice);
    }

    return finish(copy.invalidChoice);
  } catch (error) {
    logger.error("ussd.unhandled", { error });
    return reply("END", copy.serviceUnavailable, 500);
  }
}
