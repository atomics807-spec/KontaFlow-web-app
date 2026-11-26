import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { CloudOff, MessageCircle, Smartphone, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TransactionForm } from "@/components/forms/transaction-form";
import { OfflineOutboxPanel } from "@/components/offline/offline-outbox-panel";
import { getTransactionOptions } from "@/services/transactions";
import { requireWorkspaceContext } from "@/lib/supabase/auth";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { todayInZone } from "@/lib/dates";
import type { TransactionKind } from "@/types/database";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.transactions.new, robots: { index: false, follow: false } };
}

export default async function NewTransactionPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ kind?: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const context = await requireWorkspaceContext(locale);

  if (!context.can("transactions:create")) {
    redirect(`/${locale}/transactions`);
  }

  const { kind } = await searchParams;
  const defaultKind: TransactionKind =
    kind === "expense" || kind === "transfer" ? (kind as TransactionKind) : "income";

  const options = await getTransactionOptions(context.workspace.id);

  return (
    <div className="space-y-5">
      <header>
        <Link href={`/${locale}/transactions`} className="text-xs font-semibold text-muted hover:text-heading">
          ← {dict.transactions.title}
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-heading">{dict.transactions.new}</h1>
        <p className="mt-1 text-sm text-muted">{context.workspace.name}</p>
      </header>

      {options.accounts.length === 0 ? (
        <Card className="p-6 text-sm text-muted">{dict.errors.generic}</Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
          <Card className="p-5 sm:p-6">
            <TransactionForm
              workspaceId={context.workspace.id}
              currency={context.workspace.currency}
              defaultDate={todayInZone(context.workspace.timezone)}
              defaultKind={defaultKind}
              accounts={options.accounts.map((account) => ({
                id: account.id,
                name: account.name,
                subtype: account.subtype,
              }))}
              categories={options.categories.map((category) => ({
                id: category.id,
                name: category.name,
                kind: category.kind,
                color: category.color,
                translations: category.translations,
              }))}
              contacts={options.contacts.map((contact) => ({
                id: contact.id,
                name: contact.name,
                kind: contact.kind,
              }))}
            />
          </Card>

          <aside className="space-y-4">
            <OfflineOutboxPanel compact />
            <Card className="p-5">
              <h2 className="text-sm font-bold text-heading">{dict.dashboard.channels}</h2>
              <p className="mt-1 text-xs text-muted">{dict.dashboard.channelsSubtitle}</p>
              <ul className="mt-4 space-y-3 text-sm text-muted">
                <li className="flex items-start gap-2.5">
                  <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
                  {dict.marketing.channelUssdDesc}
                </li>
                <li className="flex items-start gap-2.5">
                  <MessageCircle className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
                  {dict.marketing.channelWhatsappDesc}
                </li>
                <li className="flex items-start gap-2.5">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent-strong" aria-hidden />
                  {dict.marketing.channelAiDesc}
                </li>
              </ul>
            </Card>

            <Card className="border-accent-line bg-jade-50/60 p-5">
              <div className="flex items-start gap-2.5">
                <CloudOff className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                <div>
                  <p className="text-sm font-bold text-accent">{dict.pwa.offlineNotice}</p>
                  <p className="mt-1 text-xs leading-relaxed text-jade-700/80">{dict.pwa.installHint}</p>
                </div>
              </div>
            </Card>
          </aside>
        </div>
      )}
    </div>
  );
}
