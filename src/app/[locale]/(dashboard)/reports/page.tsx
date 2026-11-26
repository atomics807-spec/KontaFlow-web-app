import type { Metadata } from "next";
import Link from "next/link";
import { Download, FileBarChart2, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DailyChart } from "@/components/charts/daily-chart";
import { buttonVariants } from "@/components/ui/button";
import { getReport } from "@/services/reports";
import { requireWorkspaceContext } from "@/lib/supabase/auth";
import { intlLocale, pickTranslation, resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/interpolate";
import { formatMoney, moneyLocale, toMinorUnits } from "@/lib/money";
import { formatDate, monthBounds, todayInZone } from "@/lib/dates";
import type { ReportResult } from "@/types/database";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.reports.title, robots: { index: false, follow: false } };
}

type Preset = "month" | "last-month" | "quarter" | "year";

function periodFor(preset: Preset, timezone: string): { from: string; to: string } {
  const today = todayInZone(timezone);
  const [year, month] = today.split("-").map(Number);

  if (preset === "month") {
    const bounds = monthBounds(new Date(), timezone);
    return { from: bounds.start, to: bounds.end };
  }
  if (preset === "last-month") {
    const start = new Date(Date.UTC(year, month - 2, 1));
    const bounds = monthBounds(start, timezone);
    return { from: bounds.start, to: bounds.end };
  }
  if (preset === "quarter") {
    const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
    const start = `${year}-${String(quarterStartMonth).padStart(2, "0")}-01`;
    const end = new Date(Date.UTC(year, quarterStartMonth + 2, 0));
    return { from: start, to: end.toISOString().slice(0, 10) };
  }
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

const PRESETS: Preset[] = ["month", "last-month", "quarter", "year"];

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const context = await requireWorkspaceContext(locale);
  const { workspace } = context;
  const query = await searchParams;

  const preset: Preset = PRESETS.includes((query.period ?? "month") as Preset)
    ? ((query.period ?? "month") as Preset)
    : "month";
  const { from, to } = periodFor(preset, workspace.timezone);

  let report: ReportResult | null = null;
  try {
    report = await getReport(workspace.id, from, to);
  } catch {
    report = null;
  }

  const currency = workspace.currency;
  const money = (value: bigint | string) => formatMoney(toMinorUnits(value), currency, moneyLocale(locale, currency));

  const revenue = report ? toMinorUnits(report.revenueMinor) : 0n;
  const expenses = report ? toMinorUnits(report.expenseMinor) : 0n;
  const net = report ? toMinorUnits(report.netProfitMinor) : 0n;
  const margin = revenue > 0n ? Number((net * 100n) / revenue) : null;

  const presetLabel: Record<Preset, string> = {
    month: dict.dashboard.thisMonthLabel,
    "last-month": dict.reports.lastMonth,
    quarter: dict.reports.quarter,
    year: dict.reports.year,
  };

  const series = (report?.dailySeries ?? []).map((point) => ({
    date: point.date,
    income: Number(BigInt(point.income)),
    expense: Number(BigInt(point.expense)),
  }));

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-heading">{dict.reports.title}</h1>
          <p className="mt-1 text-sm text-muted">{dict.reports.subtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <a
            href={`/api/reports/export/pdf?from=${from}&to=${to}&locale=${locale}`}
            className={buttonVariants({ variant: "secondary", size: "md" })}
          >
            <FileText className="h-4 w-4" aria-hidden />
            {dict.reports.downloadPdf}
          </a>
          <a
            href={`/api/reports/export?from=${from}&to=${to}&locale=${locale}`}
            className={buttonVariants({ variant: "secondary", size: "md" })}
          >
            <Download className="h-4 w-4" aria-hidden />
            {dict.reports.export}
          </a>
        </div>
      </header>

      <nav aria-label={dict.reports.period} className="flex flex-wrap gap-2 text-sm">
        {PRESETS.map((option) => (
          <Link
            key={option}
            href={`/${locale}/reports?period=${option}`}
            aria-current={preset === option ? "page" : undefined}
            className={
              preset === option
                ? "rounded-full bg-forest px-3.5 py-1.5 text-xs font-bold text-white"
                : "rounded-full border border-line bg-panel px-3.5 py-1.5 text-xs font-semibold text-muted hover:border-accent-line hover:text-heading"
            }
          >
            {option === "month"
              ? dict.dashboard.thisMonthLabel
              : option === "last-month"
                ? dict.reports.lastMonth
                : option === "quarter"
                  ? `Q${Math.floor(Number(todayInZone(workspace.timezone).slice(5, 7)) / 3) + 1}`
                  : String(new Date().getFullYear())}
            <span className="sr-only"> {presetLabel[option]}</span>
          </Link>
        ))}
      </nav>

      <p className="text-xs text-muted">
        {formatDate(from, intlLocale(locale), workspace.timezone, { day: "2-digit", month: "short", year: undefined })} —{" "}
        {formatDate(to, intlLocale(locale), workspace.timezone, { day: "2-digit", month: "short", year: undefined })}
      </p>

      {!report ? (
        <Card className="p-6 text-sm text-muted">{dict.errors.generic}</Card>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label={dict.reports.profitAndLoss}>
            {[
              { label: dict.reports.revenue, value: revenue, tone: "text-accent" },
              { label: dict.reports.expenses, value: expenses, tone: "text-danger" },
              { label: dict.reports.netProfit, value: net, tone: "text-heading" },
            ].map((row) => (
              <Card key={row.label} className="p-5">
                <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted">{row.label}</p>
                <p className={`kpi-value mt-2 text-xl font-semibold ${row.tone}`}>{money(row.value)}</p>
              </Card>
            ))}
            <Card className="p-5">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted">{dict.reports.margin}</p>
              <p className="kpi-value mt-2 text-xl font-semibold text-heading">
                {margin === null ? "—" : `${margin}%`}
              </p>
              <p className="mt-1 text-xs text-muted">
                {interpolate(dict.transactions.showingCount, { count: report.transactionCount }, { locale: intlLocale(locale) })}
              </p>
            </Card>
          </section>

          <Card className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-bold text-heading">{dict.reports.profitAndLoss}</h2>
                <p className="mt-0.5 text-sm text-muted">{dict.reports.byCategory}</p>
              </div>
              <Badge tone="jade">{dict.reports.profitAndLoss}</Badge>
            </div>
            <div className="mt-4">
              <DailyChart
                data={series}
                currency={currency}
                locale={locale}
                label={dict.reports.profitAndLoss}
                monthLabel={dict.common.month}
                incomeLabel={dict.reports.revenue}
                expenseLabel={dict.reports.expenses}
                emptyLabel={dict.reports.noData}
              />
            </div>
            {series.length === 0 ? <p className="mt-3 text-sm text-muted">{dict.reports.noData}</p> : null}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-5 sm:p-6">
              <h2 className="text-base font-bold text-heading">{dict.reports.byCategory}</h2>
              {report.byCategory.length === 0 ? (
                <p className="mt-4 text-sm text-muted">{dict.reports.noData}</p>
              ) : (
                <ul className="mt-4 space-y-3.5">
                  {report.byCategory.slice(0, 8).map((row) => {
                    const total = toMinorUnits(row.total);
                    const base = row.kind === "income" ? revenue : expenses;
                    const percent = base > 0n ? Number((total * 100n) / base) : 0;
                    return (
                      <li key={`${row.kind}-${row.name}`}>
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="truncate text-sm font-medium text-heading">
                            {pickTranslation(row.translations, locale) ?? row.name}
                          </p>
                          <p className="kpi-value shrink-0 text-sm text-heading">{money(total)}</p>
                        </div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-page-soft">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${Math.max(percent, 2)}%`, backgroundColor: row.color || "#0B7A5A" }}
                            />
                          </div>
                          <span className="w-8 text-right text-[0.65rem] text-muted">{percent}%</span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>

            <Card className="p-5 sm:p-6">
              <h2 className="text-base font-bold text-heading">{dict.reports.topCustomer}</h2>
              {report.topCustomers.length === 0 ? (
                <p className="mt-4 text-sm text-muted">{dict.reports.noData}</p>
              ) : (
                <ul className="mt-4 divide-y divide-line/70">
                  {report.topCustomers.map((customer, index) => (
                    <li key={customer.name} className="flex items-center gap-3 py-2.5">
                      <span className="kpi-value w-5 text-xs text-muted">{index + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-heading">{customer.name}</span>
                      <span className="kpi-value text-sm text-heading">{money(customer.total)}</span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
                <FileBarChart2 className="h-3.5 w-3.5" aria-hidden />
                {dict.reports.generated.replace("{date}", todayInZone(workspace.timezone))}
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
