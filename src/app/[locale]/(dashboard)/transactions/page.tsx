import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Download, FileText, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { TransactionsTable } from "@/components/dashboard/transactions-table";
import { DebouncedSearch } from "@/components/dashboard/debounced-search";
import { OfflineOutboxPanel } from "@/components/offline/offline-outbox-panel";
import { listTransactions } from "@/services/transactions";
import { requireWorkspaceContext } from "@/lib/supabase/auth";
import { intlLocale, pickTranslation, resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { interpolate } from "@/lib/i18n/interpolate";
import type { TransactionKind } from "@/types/database";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.transactions.title, robots: { index: false, follow: false } };
}

const KINDS: (TransactionKind | "all")[] = ["all", "income", "expense", "transfer"];

export default async function TransactionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ kind?: string; q?: string; from?: string; to?: string; page?: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const context = await requireWorkspaceContext(locale);
  const query = await searchParams;

  const kind = KINDS.includes((query.kind ?? "all") as TransactionKind | "all")
    ? ((query.kind ?? "all") as TransactionKind | "all")
    : "all";
  const search = (query.q ?? "").slice(0, 80);
  const from = /^\d{4}-\d{2}-\d{2}$/.test(query.from ?? "") ? query.from : undefined;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(query.to ?? "") ? query.to : undefined;

  const PAGE_SIZE = 50;
  const requestedPage = Number.parseInt(query.page ?? "1", 10);
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const rows = await listTransactions(context.workspace.id, {
    kind,
    search,
    from,
    to,
    limit: PAGE_SIZE + 1,
    offset: (page - 1) * PAGE_SIZE,
  });
  const hasNext = rows.length > PAGE_SIZE;
  const hasPrev = page > 1;
  const items = rows.slice(0, PAGE_SIZE);

  const kindLabel = (value: TransactionKind | "all") =>
    value === "all"
      ? dict.transactions.filterAll
      : value === "income"
        ? dict.transactions.income
        : value === "expense"
          ? dict.transactions.expense
          : dict.transactions.transfer;

  const exportHref = (format: "csv" | "pdf" = "csv") => {
    const params = new URLSearchParams();
    if (kind !== "all") params.set("kind", kind);
    if (search) params.set("q", search);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    params.set("locale", locale);
    return `/api/transactions/export${format === "pdf" ? "/pdf" : ""}?${params.toString()}`;
  };

  const pageHref = (nextPage: number) => {
    const params = new URLSearchParams();
    if (kind !== "all") params.set("kind", kind);
    if (search) params.set("q", search);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (nextPage > 1) params.set("page", String(nextPage));
    const qs = params.toString();
    return `/${locale}/transactions${qs ? `?${qs}` : ""}`;
  };

  const kindHref = (value: TransactionKind | "all") => {
    const params = new URLSearchParams();
    if (value !== "all") params.set("kind", value);
    if (search) params.set("q", search);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const qs = params.toString();
    return `/${locale}/transactions${qs ? `?${qs}` : ""}`;
  };

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-heading">{dict.transactions.title}</h1>
          <p className="mt-1 text-sm text-muted">{dict.transactions.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {context.can("reports:export") ? (
            <>
              <a href={exportHref("csv")} className={buttonVariants({ variant: "secondary", size: "md" })}>
                <Download className="h-4 w-4" aria-hidden />
                {dict.settings.downloadCsv}
              </a>
              <a href={exportHref("pdf")} className={buttonVariants({ variant: "secondary", size: "md" })}>
                <FileText className="h-4 w-4" aria-hidden />
                {dict.settings.downloadPdf}
              </a>
            </>
          ) : null}
          {context.can("transactions:create") ? (
            <Link href={`/${locale}/transactions/new`} className={buttonVariants({ size: "md" })}>
              <Plus className="h-4 w-4" aria-hidden />
              {dict.transactions.new}
            </Link>
          ) : null}
        </div>
      </header>

      <nav aria-label={dict.common.filter} className="flex flex-wrap gap-2">
        {KINDS.map((value) => (
          <Link key={value} href={kindHref(value)} aria-current={kind === value ? "page" : undefined}>
            <Badge
              tone={kind === value ? "jade" : "outline"}
              className="px-3 py-1.5 text-xs transition hover:border-accent-line"
            >
              {kindLabel(value)}
            </Badge>
          </Link>
        ))}
      </nav>

      <Card className="p-4">
        <form method="get" className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {kind !== "all" ? <input type="hidden" name="kind" value={kind} /> : null}
          <div className="min-w-0 flex-1">
            <DebouncedSearch
              defaultValue={search}
              placeholder={dict.transactions.searchPlaceholder}
              label={dict.common.search}
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-end">
            <div>
              <label htmlFor="from" className="mb-1 block text-xs font-semibold text-muted">
                {dict.common.date}
              </label>
              <Input id="from" name="from" type="date" defaultValue={from ?? ""} className="h-11" />
            </div>
            <div>
              <label htmlFor="to" className="mb-1 block text-xs font-semibold text-muted">
                {dict.common.date}
              </label>
              <Input id="to" name="to" type="date" defaultValue={to ?? ""} className="h-11" />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" variant="dark">
              {dict.common.filter}
            </Button>
            <Link href={`/${locale}/transactions`} className={buttonVariants({ variant: "ghost", className: "h-11" })}>
              {dict.common.cancel}
            </Link>
          </div>
        </form>
      </Card>

      <p className="text-xs text-muted">{interpolate(dict.transactions.showingCount, { count: items.length }, { locale: intlLocale(locale) })}</p>

      <OfflineOutboxPanel compact />

      <Card className="overflow-hidden">
        <TransactionsTable
          allowVoid={context.can("transactions:void")}
          items={items.map((row) => ({
            id: row.id,
            kind: row.kind,
            status: row.status,
            amountMinor: String(row.amount_minor),
            currency: row.currency,
            occurredOn: row.occurred_on,
            description: row.description,
            categoryName: pickTranslation(row.category_translations, locale) ?? row.category_name,
            contactName: row.contact_name,
            channel: row.channel,
            accountName: row.account_name,
            attachmentPath: row.attachment_path,
          }))}
        />
      </Card>

      {hasPrev || hasNext ? (
        <nav className="flex items-center justify-between gap-2" aria-label={dict.pwa.pagination}>
          <Link
            href={pageHref(Math.max(1, page - 1))}
            aria-disabled={!hasPrev}
            className={buttonVariants({
              variant: "secondary",
              size: "sm",
              className: hasPrev ? undefined : "pointer-events-none opacity-40",
            })}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
            {dict.common.back}
          </Link>
          <span className="text-xs font-semibold text-muted">
            {dict.pwa.page} {page}
          </span>
          <Link
            href={pageHref(page + 1)}
            aria-disabled={!hasNext}
            className={buttonVariants({
              variant: "secondary",
              size: "sm",
              className: hasNext ? undefined : "pointer-events-none opacity-40",
            })}
          >
            {dict.common.next}
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </nav>
      ) : null}
    </div>
  );
}
