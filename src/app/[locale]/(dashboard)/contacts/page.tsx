import type { Metadata } from "next";
import { Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { NewContactForm } from "@/components/forms/new-contact-form";
import { listContacts } from "@/services/workspaces";
import { requireWorkspaceContext } from "@/lib/supabase/auth";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.contacts.title, robots: { index: false, follow: false } };
}

export default async function ContactsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const context = await requireWorkspaceContext(locale);
  const { q } = await searchParams;
  const search = (q ?? "").slice(0, 80);

  const contacts = await listContacts(context.workspace.id, search);
  const canWrite = context.can("contacts:manage");

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-heading">{dict.contacts.title}</h1>
          <p className="mt-1 text-sm text-muted">{dict.contacts.subtitle}</p>
        </div>
        {canWrite ? <NewContactForm /> : null}
      </header>

      <Card className="p-4">
        <form method="get" className="flex gap-2">
          <div className="relative flex-1">
            <label htmlFor="q" className="sr-only">
              {dict.common.search}
            </label>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input id="q" name="q" defaultValue={search} placeholder={dict.common.search} className="pl-9" maxLength={80} />
          </div>
          <Button type="submit" variant="dark">
            {dict.common.search}
          </Button>
        </form>
      </Card>

      {contacts.length === 0 ? (
        <Card className="p-6">
          <EmptyState icon={Users} title={dict.contacts.empty} description={dict.contacts.emptyHint} />
        </Card>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {contacts.map((contact) => (
            <li key={contact.id} className="surface p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-heading">{contact.name}</p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {contact.phone ?? contact.email ?? dict.common.none}
                  </p>
                </div>
                <Badge
                  tone={contact.kind === "customer" ? "jade" : contact.kind === "supplier" ? "mango" : "outline"}
                  className={cn("shrink-0 text-[0.6rem]")}
                >
                  {contact.kind === "customer"
                    ? dict.contacts.customer
                    : contact.kind === "supplier"
                      ? dict.contacts.supplier
                      : dict.contacts.both}
                </Badge>
              </div>

              {contact.address ? <p className="mt-2 line-clamp-2 text-xs text-muted">{contact.address}</p> : null}
              {contact.notes ? <p className="mt-2 line-clamp-2 text-xs text-muted/80">{contact.notes}</p> : null}

              <div className="mt-3 flex items-center justify-between gap-2">
                <a
                  href={contact.phone ? `tel:${contact.phone}` : contact.email ? `mailto:${contact.email}` : "#"}
                  className={
                    contact.phone || contact.email
                      ? "text-xs font-semibold text-accent hover:underline"
                      : "pointer-events-none text-xs text-muted"
                  }
                >
                  {contact.phone ? dict.contacts.phone : contact.email ? dict.contacts.email : ""}
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
