import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { TransactionForm } from "@/components/forms/transaction-form";
import { SpeakButton } from "@/components/easy/speak-button";
import { getTransactionOptions } from "@/services/transactions";
import { requireWorkspaceContext } from "@/lib/supabase/auth";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { todayInZone } from "@/lib/dates";
import type { TransactionKind } from "@/types/database";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.easy.recordTitle, robots: { index: false, follow: false } };
}

export default async function EasyRecordPage({
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
    redirect(`/${locale}/easy`);
  }

  const requested = (await searchParams).kind;
  const kind: TransactionKind = requested === "expense" ? "expense" : "income";
  const options = await getTransactionOptions(context.workspace.id);
  const title = kind === "expense" ? dict.easy.iSpent : dict.easy.iSold;
  const instructions = kind === "expense" ? dict.easy.recordExpenseSpoken : dict.easy.recordIncomeSpoken;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header>
        <Link
          href={`/${locale}/easy`}
          className="inline-flex min-h-11 items-center gap-1.5 text-base font-bold text-accent hover:underline"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden />
          {dict.easy.backToEasy}
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-heading">{title}</h1>
            <p className="mt-1 text-base font-medium text-muted">{dict.easy.recordHint}</p>
          </div>
          <SpeakButton text={instructions} label={dict.easy.listen} />
        </div>
      </header>

      {options.accounts.length === 0 ? (
        <Alert tone="warning">
          <p className="font-bold">{dict.easy.noAccount}</p>
          <Link href={`/${locale}/accounts`} className="mt-2 inline-block font-bold underline">
            {dict.easy.openAccounts}
          </Link>
        </Alert>
      ) : (
        <div className="rounded-3xl border-2 border-line bg-panel p-4 sm:p-6">
          <TransactionForm
            workspaceId={context.workspace.id}
            currency={context.workspace.currency}
            defaultDate={todayInZone(context.workspace.timezone)}
            defaultKind={kind}
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
              icon: category.icon,
              translations: category.translations,
            }))}
            contacts={options.contacts.map((contact) => ({
              id: contact.id,
              name: contact.name,
              kind: contact.kind,
            }))}
            simple
          />
        </div>
      )}
    </div>
  );
}
