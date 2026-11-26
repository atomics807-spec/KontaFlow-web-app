import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui/card";
import { InvoiceForm } from "@/components/forms/invoice-form";
import { hasFeature, listFinanceContacts } from "@/services/finance";
import { requireWorkspaceContext } from "@/lib/supabase/auth";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { addDays, todayInZone } from "@/lib/dates";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.finance.invoices.new, robots: { index: false, follow: false } };
}

export default async function NewInvoicePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const context = await requireWorkspaceContext(locale);

  if (!context.can("invoices:manage")) redirect(`/${locale}/invoices`);
  if (!(await hasFeature(context.workspace.id, "invoicing"))) redirect(`/${locale}/invoices`);

  const today = todayInZone(context.workspace.timezone);
  const contacts = await listFinanceContacts(context.workspace.id);
  const customers = contacts.filter((contact) => contact.kind === "customer" || contact.kind === "both");

  return (
    <div className="space-y-5">
      <header>
        <Link href={`/${locale}/invoices`} className="text-xs font-semibold text-muted hover:text-heading">
          ← {dict.finance.invoices.title}
        </Link>
        <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-heading">{dict.finance.invoices.new}</h1>
        <p className="mt-1 text-sm text-muted">{context.workspace.name}</p>
      </header>

      <Card className="p-5 sm:p-6">
        <InvoiceForm
          customers={customers}
          today={today}
          defaultDue={addDays(today, 30)}
          currency={context.workspace.currency}
        />
      </Card>
    </div>
  );
}
