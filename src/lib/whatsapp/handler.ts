import "server-only";

import { addDays, formatDate, todayInZone } from "@/lib/dates";
import { isAppError } from "@/lib/errors";
import { intlLocale, pickTranslation, type Locale } from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n/interpolate";
import { getDictionary } from "@/lib/i18n/server";
import { formatMinor, cashBalance } from "@/lib/channels";
import { toMinorUnits } from "@/lib/money";
import { logger } from "@/lib/logger";
import { isAiConfigured } from "@/lib/ai/client";
import { runAssistant } from "@/lib/ai/assistant";
import { parseWhatsappIntent } from "@/lib/whatsapp/commands";
import { dashboardSummaryAsService, receivablesAsService, reportAsService } from "@/lib/channels/data";
import type { WhatsappAccess } from "@/lib/whatsapp/access";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

export async function handleWhatsappCommand(params: {
  access: WhatsappAccess;
  body: string;
  messageId: string;
  locale: Locale;
}): Promise<string> {
  const { access, body, messageId, locale } = params;
  const dict = await getDictionary(locale);
  const copy = dict.channels.whatsapp;
  const intent = parseWhatsappIntent(body);

  if (intent.intent === "help") return copy.help;
  if (intent.intent === "stop") return copy.stop;
  if (intent.intent === "start") return copy.optedIn;

  if (!access.activeMember) return access.restricted ? copy.restricted : copy.accessRevoked;
  if (!access.subscriptionReadable) return copy.subscriptionInactive;

  const money = (value: bigint | number | string) =>
    formatMinor(toMinorUnits(value), access.workspace.currency, locale);

  try {
    switch (intent.intent) {
      case "sales_today": {
        if (!access.readAllowed) return denied(access, copy);
        const today = todayInZone(access.workspace.timezone);
        const summary = await dashboardSummaryAsService(access.workspace.id, today, today);
        return interpolate(
          copy.salesToday,
          {
            date: formatDate(today, intlLocale(locale), access.workspace.timezone),
            income: money(summary.totalIncomeMinor),
            expenses: money(summary.totalExpenseMinor),
            net: money(summary.netProfitMinor),
            cash: money(summary.cashBalanceMinor),
          },
          { locale },
        );
      }

      case "weekly_report": {
        if (!access.reportAllowed) return copy.noPermission;
        const to = todayInZone(access.workspace.timezone);
        const from = addDays(to, -6);
        const report = await reportAsService(access.workspace.id, from, to);
        const top = report.byCategory
          .filter((row) => row.kind === "expense")
          .reduce<typeof report.byCategory[number] | undefined>(
            (best, row) => (!best || BigInt(row.total) > BigInt(best.total) ? row : best),
            undefined,
          );
        const topName = top
          ? `${pickTranslation(top.translations, locale) ?? top.name} (${money(top.total)})`
          : copy.noTopExpense;
        return interpolate(
          copy.weeklyReport,
          {
            from: formatDate(from, intlLocale(locale), access.workspace.timezone, {
              day: "2-digit",
              month: "short",
              year: undefined,
            }),
            to: formatDate(to, intlLocale(locale), access.workspace.timezone),
            income: money(report.revenueMinor),
            expenses: money(report.expenseMinor),
            net: money(report.netProfitMinor),
            count: report.transactionCount,
            top: topName,
          },
          { locale },
        );
      }

      case "receivables": {
        if (!access.readAllowed) return denied(access, copy);
        const summary = await receivablesAsService(access.workspace.id);
        if (summary.count === 0) return copy.noReceivables;
        return interpolate(
          copy.receivables,
          {
            total: money(summary.totalMinor),
            count: summary.count,
            overdue: money(summary.overdueMinor),
          },
          { locale },
        );
      }

      case "cash": {
        if (!access.readAllowed) return denied(access, copy);
        const balance = await cashBalance(access.workspace.id);
        return interpolate(copy.cash, { amount: money(balance.minor) }, { locale });
      }

      case "verify":
        return copy.verificationAlready;

      default: {
        if (!access.aiAllowed) return denied(access, copy);
        if (!isAiConfigured()) return copy.assistantUnavailable;
        try {
          const result = await runAssistant({
            workspace: access.workspace,
            userId: access.userId,
            locale,
            message: body,
            requestId: `wa:${messageId}`,
            mode: "direct",
            serviceRole: true,
          });
          return result.reply.trim() || copy.assistantFailed;
        } catch (error) {
          logger.error("whatsapp.assistant_failed", { error });
          if (isAppError(error) && error.code === "rate_limited") return copy.quotaReached;
          if (
            isAppError(error) &&
            (error.code === "integration_unavailable" || error.code === "configuration_missing")
          ) {
            return copy.assistantUnavailable;
          }
          return copy.assistantFailed;
        }
      }
    }
  } catch (error) {
    logger.error("whatsapp.command_failed", { error, intent: intent.intent });
    return copy.commandFailed;
  }
}

function denied(access: WhatsappAccess, copy: Dictionary["channels"]["whatsapp"]): string {
  if (access.restricted) return copy.restricted;
  if (!access.activeMember) return copy.accessRevoked;
  if (access.subscriptionStatus === "past_due") return copy.subscriptionReadOnly;
  if (!access.subscriptionWritable) return copy.subscriptionInactive;
  return copy.noPermission;
}
