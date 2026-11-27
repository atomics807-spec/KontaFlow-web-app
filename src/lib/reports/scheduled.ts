import type { AdvisorInsightCode } from "@/types/ai-advisor";
import type { ReportKind } from "@/types/database";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { intlLocale, pickTranslation, type Locale } from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n/interpolate";
import { formatDate } from "@/lib/dates";
import { formatMoney, moneyLocale } from "@/lib/money";
import type { ReportCategory, ScheduledReportData } from "./data";

export type ReportObservation = {
  kind: "fact" | "suggestion";
  code: AdvisorInsightCode;
  params: Record<string, string | number>;
};

export type BuiltReport = {
  subject: string;
  title: string;
  text: string;
  html: string;
  whatsappText: string;
  whatsappTemplateParams: string[];
  notificationBody: string;
  data: {
    report_kind: ReportKind;
    report_date: string;
    from: string;
    to: string;
    href: string;
  };
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function signedPercent(current: bigint, previous: bigint): string | null {
  if (previous <= 0n) return null;
  const change = ((current - previous) * 10_000n) / previous;
  const value = Number(change) / 100;
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${new Intl.NumberFormat("en", { maximumFractionDigits: 1 }).format(Math.abs(value))}%`;
}

function categoryLabel(category: ReportCategory, locale: Locale): string {
  return pickTranslation(category.translations, locale) ?? category.name;
}

function budgetLabel(
  budget: ScheduledReportData["budgets"][number],
  locale: Locale,
): string {
  if (budget.categoryName) {
    return pickTranslation(budget.categoryTranslations, locale) ?? budget.categoryName;
  }
  return budget.name;
}

export function buildReportObservations(data: ScheduledReportData): {
  facts: ReportObservation[];
  suggestions: ReportObservation[];
} {
  const facts: ReportObservation[] = [];
  const suggestions: ReportObservation[] = [];
  const top = data.expenseCategories[0];
  const revenueChange = signedPercent(data.incomeMinor, data.previousIncomeMinor);

  if (top && top.totalMinor > 0n) {
    facts.push({
      kind: "fact",
      code: "top_expense_category",
      params: { category: top.name, sharePct: Math.round(top.shareBp / 100) },
    });
  }

  if (data.netMinor < 0n) {
    facts.push({ kind: "fact", code: "net_result_negative", params: {} });
  } else if (data.netMinor > 0n) {
    facts.push({ kind: "fact", code: "net_result_positive", params: {} });
  }

  for (const budget of data.budgets.slice(0, 2)) {
    const usedPct = Math.round(budget.usedBp / 100);
    if (usedPct >= 100) {
      facts.push({
        kind: "fact",
        code: "budget_over",
        params: { budget: budgetLabel(budget, "en"), usedPct },
      });
    } else if (usedPct >= 80) {
      facts.push({
        kind: "fact",
        code: "budget_near",
        params: { budget: budgetLabel(budget, "en"), usedPct },
      });
    }
  }

  if (data.debts.receivableMinor > 0n) {
    facts.push({
      kind: "fact",
      code: "receivables_outstanding",
      params: { count: data.debts.openCount },
    });
  }

  if (data.debts.overdueReceivableMinor > 0n) {
    facts.push({ kind: "fact", code: "overdue_receivables", params: {} });
  }

  if (data.debts.payableMinor > 0n) {
    facts.push({
      kind: "fact",
      code: "payables_outstanding",
      params: { count: data.debts.openCount },
    });
  }

  if (revenueChange) {
    const change = Number(revenueChange.replace(/[+%-]/g, ""));
    if (change >= 10) {
      facts.push({
        kind: "fact",
        code: data.incomeMinor >= data.previousIncomeMinor ? "revenue_increase" : "revenue_decrease",
        params: { changePct: Math.round(change), days: data.kind === "weekly" ? 7 : data.kind === "monthly" ? 30 : 1 },
      });
    }
  }

  if (data.debts.overdueReceivableMinor > 0n) {
    suggestions.push({ kind: "suggestion", code: "follow_up_receivables", params: {} });
  }
  for (const budget of data.budgets) {
    if (budget.usedBp >= 8_000) {
      suggestions.push({
        kind: "suggestion",
        code: "review_budget",
        params: { budget: budgetLabel(budget, "en") },
      });
      break;
    }
  }
  if (top && top.shareBp >= 3_000) {
    suggestions.push({
      kind: "suggestion",
      code: "review_category",
      params: { category: top.name },
    });
  }
  if (data.debts.overduePayableMinor > 0n) {
    suggestions.push({ kind: "suggestion", code: "review_payables", params: {} });
  }
  if (data.cashMinor > 0n && data.expenseMinor > 0n && data.cashMinor < data.expenseMinor * 3n) {
    suggestions.push({ kind: "suggestion", code: "protect_cash", params: {} });
  }

  return { facts: facts.slice(0, 5), suggestions: suggestions.slice(0, 4) };
}

function observationText(
  observation: ReportObservation,
  dict: Dictionary,
  locale: Locale,
  categoryNames: Map<string, string>,
): string {
  const params: Record<string, string | number> = { ...observation.params };
  if (typeof params.category === "string") {
    params.category = categoryNames.get(params.category) ?? params.category;
  }
  if (typeof params.budget === "string") {
    params.budget = categoryNames.get(params.budget) ?? params.budget;
  }
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "number") {
      params[key] = new Intl.NumberFormat(intlLocale(locale)).format(value);
    }
  }
  return interpolate(dict.advisor.insights[observation.code], params, { locale: intlLocale(locale) });
}

function periodLabel(data: ScheduledReportData, locale: Locale): string {
  const from = formatDate(data.from, intlLocale(locale), data.workspace.timezone);
  if (data.from === data.to) return from;
  return `${from} – ${formatDate(data.to, intlLocale(locale), data.workspace.timezone)}`;
}

export function buildScheduledReport(
  data: ScheduledReportData,
  dict: Dictionary,
  locale: Locale,
): BuiltReport {
  const copy = dict.emails;
  const money = (value: bigint) =>
    formatMoney(value, data.workspace.currency, moneyLocale(locale, data.workspace.currency));
  const categoryNames = new Map<string, string>();
  for (const category of data.expenseCategories) {
    categoryNames.set(category.name, categoryLabel(category, locale));
  }
  for (const budget of data.budgets) {
    const label = budgetLabel(budget, locale);
    categoryNames.set(budget.name, label);
    if (budget.categoryName) categoryNames.set(budget.categoryName, label);
  }

  const observations = buildReportObservations(data);
  const facts = observations.facts.map((item) => observationText(item, dict, locale, categoryNames));
  const suggestions = observations.suggestions.map((item) =>
    observationText(item, dict, locale, categoryNames),
  );
  const period = periodLabel(data, locale);
  const subject =
    data.kind === "weekly"
      ? interpolate(copy.weeklySubject, {
          workspace: data.workspace.name.replace(/[\r\n]+/g, " "),
          date: formatDate(data.to, intlLocale(locale), data.workspace.timezone),
        })
      : data.kind === "monthly"
        ? interpolate(copy.monthlySubject, {
            workspace: data.workspace.name.replace(/[\r\n]+/g, " "),
            month: formatDate(data.to, intlLocale(locale), data.workspace.timezone, {
              day: undefined,
              month: "long",
              year: "numeric",
            }),
          })
        : interpolate(copy.dailySubject, {
            workspace: data.workspace.name.replace(/[\r\n]+/g, " "),
            date: formatDate(data.from, intlLocale(locale), data.workspace.timezone),
          });

  const title =
    data.kind === "weekly"
      ? interpolate(copy.weeklyTitle, { from: data.from, to: data.to })
      : data.kind === "monthly"
        ? interpolate(copy.monthlyTitle, { from: data.from, to: data.to })
        : interpolate(copy.dailyTitle, { date: data.from });

  const incomeChange = signedPercent(data.incomeMinor, data.previousIncomeMinor);
  const expenseChange = signedPercent(data.expenseMinor, data.previousExpenseMinor);
  const netChange = signedPercent(data.netMinor, data.previousNetMinor);

  const lines: string[] = [
    `${data.workspace.name} · ${period}`,
    `${dict.reports.revenue}: ${money(data.incomeMinor)}`,
    `${dict.reports.expenses}: ${money(data.expenseMinor)}`,
    `${dict.reports.netProfit}: ${money(data.netMinor)}`,
    `${dict.advisor.kpiCash}: ${money(data.cashMinor)}`,
    `${copy.reportTransactions}: ${new Intl.NumberFormat(intlLocale(locale)).format(data.transactionCount)}`,
  ];

  if (data.kind !== "daily") {
    lines.push("", copy.reportComparison);
    if (incomeChange) {
      lines.push(`${copy.reportIncomeChange}: ${incomeChange} (${money(data.previousIncomeMinor)} → ${money(data.incomeMinor)})`);
    }
    if (expenseChange) {
      lines.push(
        `${copy.reportExpenseChange}: ${expenseChange} (${money(data.previousExpenseMinor)} → ${money(data.expenseMinor)})`,
      );
    }
    if (netChange) {
      lines.push(`${copy.reportNetChange}: ${netChange} (${money(data.previousNetMinor)} → ${money(data.netMinor)})`);
    }
  }

  if (data.expenseCategories.length > 0) {
    lines.push("", copy.reportSpending);
    for (const category of data.expenseCategories.slice(0, 4)) {
      const share = Math.round(category.shareBp / 100);
      lines.push(`${categoryLabel(category, locale)}: ${money(category.totalMinor)} (${share}%)`);
    }
  }

  if (data.kind === "weekly" && data.dailySeries.length > 0) {
    lines.push("", copy.reportRevenueTrend);
    for (const point of data.dailySeries.slice(-7)) {
      lines.push(
        `${formatDate(point.date, intlLocale(locale), data.workspace.timezone)}: ${money(point.incomeMinor)}`,
      );
    }
  }

  if (data.kind === "monthly" && data.monthlySeries.length > 0) {
    lines.push("", copy.reportCashFlowTrend);
    for (const point of data.monthlySeries.slice(-6)) {
      lines.push(`${point.month}: ${money(point.incomeMinor)} / ${money(point.expenseMinor)} / ${money(point.netMinor)}`);
    }
  }

  if (data.budgets.length > 0) {
    lines.push("", copy.reportBudgets);
    for (const budget of data.budgets.slice(0, 4)) {
      lines.push(
        `${budgetLabel(budget, locale)}: ${money(budget.spentMinor)} / ${money(budget.amountMinor)} (${Math.round(
          budget.usedBp / 100,
        )}%)`,
      );
    }
  }

  const hasOutstanding =
    data.debts.receivableMinor > 0n ||
    data.debts.payableMinor > 0n ||
    data.debts.overdueReceivableMinor > 0n ||
    data.debts.overduePayableMinor > 0n;
  if (data.kind !== "daily" || hasOutstanding) {
    lines.push(
      "",
      copy.reportOutstanding,
      `${copy.reportReceivables}: ${money(data.debts.receivableMinor)}`,
      `${copy.reportPayables}: ${money(data.debts.payableMinor)}`,
      `${copy.reportOverdue}: ${money(data.debts.overdueReceivableMinor)} / ${money(data.debts.overduePayableMinor)}`,
    );
  }

  if (facts.length > 0) {
    lines.push("", copy.reportObservations);
    for (const fact of facts) lines.push(`• ${fact}`);
  }
  if (suggestions.length > 0) {
    lines.push("", copy.reportRecommendations);
    for (const suggestion of suggestions) lines.push(`• ${suggestion}`);
  }

  lines.push("", copy.reportOpen, copy.reportFooter.replace("{workspace}", data.workspace.name));
  const text = lines.join("\n");

  const kpiRows = [
    [dict.reports.revenue, money(data.incomeMinor)],
    [dict.reports.expenses, money(data.expenseMinor)],
    [dict.reports.netProfit, money(data.netMinor)],
    [dict.advisor.kpiCash, money(data.cashMinor)],
    [copy.reportTransactions, new Intl.NumberFormat(intlLocale(locale)).format(data.transactionCount)],
  ];

  const htmlSection = (heading: string, items: string[]) => {
    if (items.length === 0) return "";
    return `<h2 style="font-size:14px;margin:24px 0 8px;color:#0b1f1a">${escapeHtml(heading)}</h2>
      <ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.8;color:#4b5f58">
        ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
      </ul>`;
  };

  const spending = data.expenseCategories.slice(0, 4).map((category) => {
    const share = Math.round(category.shareBp / 100);
    return `${categoryLabel(category, locale)}: ${money(category.totalMinor)} (${share}%)`;
  });
  const revenueTrend =
    data.kind === "weekly"
      ? data.dailySeries.slice(-7).map(
          (point) =>
            `${formatDate(point.date, intlLocale(locale), data.workspace.timezone)}: ${money(point.incomeMinor)}`,
        )
      : [];
  const cashFlowTrend =
    data.kind === "monthly"
      ? data.monthlySeries
          .slice(-6)
          .map(
            (point) =>
              `${point.month}: ${money(point.incomeMinor)} / ${money(point.expenseMinor)} / ${money(point.netMinor)}`,
          )
      : [];
  const budgets = data.budgets.slice(0, 4).map(
    (budget) =>
      `${budgetLabel(budget, locale)}: ${money(budget.spentMinor)} / ${money(budget.amountMinor)} (${Math.round(
        budget.usedBp / 100,
      )}%)`,
  );
  const outstanding =
    data.kind !== "daily" || hasOutstanding
      ? [
          `${copy.reportReceivables}: ${money(data.debts.receivableMinor)}`,
          `${copy.reportPayables}: ${money(data.debts.payableMinor)}`,
          `${copy.reportOverdue}: ${money(data.debts.overdueReceivableMinor)} / ${money(data.debts.overduePayableMinor)}`,
        ]
      : [];
  const comparison = [
    ...(incomeChange
      ? [`${copy.reportIncomeChange}: ${incomeChange} (${money(data.previousIncomeMinor)} → ${money(data.incomeMinor)})`]
      : []),
    ...(expenseChange
      ? [
          `${copy.reportExpenseChange}: ${expenseChange} (${money(data.previousExpenseMinor)} → ${money(data.expenseMinor)})`,
        ]
      : []),
    ...(netChange
      ? [`${copy.reportNetChange}: ${netChange} (${money(data.previousNetMinor)} → ${money(data.netMinor)})`]
      : []),
  ];

  const html = `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#0b1f1a">
      <p style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#0b7a5a;margin:0 0 20px">KontaFlow</p>
      <h1 style="font-size:20px;margin:0 0 4px">${escapeHtml(data.workspace.name)}</h1>
      <p style="font-size:13px;color:#7a8a83;margin:0 0 20px">${escapeHtml(title)} · ${escapeHtml(period)}</p>
      <table style="width:100%;font-size:14px;border-collapse:collapse">
        ${kpiRows
          .map(
            ([label, value]) =>
              `<tr><td style="padding:6px 0;color:#4b5f58">${escapeHtml(label)}</td><td style="text-align:right;font-weight:600">${escapeHtml(value)}</td></tr>`,
          )
          .join("")}
      </table>
      ${data.kind !== "daily" ? htmlSection(copy.reportComparison, comparison) : ""}
      ${htmlSection(copy.reportSpending, spending)}
      ${htmlSection(copy.reportRevenueTrend, revenueTrend)}
      ${htmlSection(copy.reportCashFlowTrend, cashFlowTrend)}
      ${htmlSection(copy.reportBudgets, budgets)}
      ${htmlSection(copy.reportOutstanding, outstanding)}
      ${htmlSection(copy.reportObservations, facts)}
      ${htmlSection(copy.reportRecommendations, suggestions)}
      <p style="font-size:12px;color:#7a8a83;margin:24px 0 0">${escapeHtml(copy.reportOpen)}</p>
      <p style="font-size:12px;color:#7a8a83;margin:8px 0 0">${escapeHtml(
        copy.reportFooter.replace("{workspace}", data.workspace.name),
      )}</p>
    </div>`;

  const whatsappLines = [
    `${data.workspace.name} · ${period}`,
    `${dict.reports.revenue}: ${money(data.incomeMinor)}`,
    `${dict.reports.expenses}: ${money(data.expenseMinor)}`,
    `${dict.reports.netProfit}: ${money(data.netMinor)}`,
    ...(facts[0] ? [facts[0]] : []),
  ];

  return {
    subject,
    title,
    text,
    html,
    whatsappText: whatsappLines.join("\n"),
    whatsappTemplateParams: [
      data.workspace.name,
      period,
      money(data.incomeMinor),
      money(data.expenseMinor),
      money(data.netMinor),
    ],
    notificationBody: text.slice(0, 900),
    data: {
      report_kind: data.kind,
      report_date: data.reportDate,
      from: data.from,
      to: data.to,
      href: `/${locale}/reports`,
    },
  };
}
