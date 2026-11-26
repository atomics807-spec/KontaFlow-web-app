import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { LogoMark } from "@/components/layout/logo";
import { SignOutButton } from "@/components/forms/sign-out-button";
import { Alert } from "@/components/ui/alert";
import { intlLocale, resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { formatDate } from "@/lib/dates";
import { getActiveRestriction, getSessionUser } from "@/lib/supabase/auth";

export const metadata: Metadata = {
  title: "Account restricted · KontaFlow",
  robots: { index: false, follow: false },
};

export default async function AccountRestrictedPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const copy = dict.restricted;
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login`);

  const restriction = await getActiveRestriction();
  if (!restriction) redirect(`/${locale}/dashboard`);

  return (
    <main className="grid min-h-dvh place-items-center bg-page px-4 py-10">
      <section className="w-full max-w-lg rounded-3xl border border-line bg-panel p-6 shadow-xl shadow-black/5 sm:p-8">
        <div className="flex items-center gap-2.5">
          <LogoMark className="h-9 w-9" />
          <span className="text-lg font-extrabold tracking-tight text-heading">
            Konta<span className="text-accent">Flow</span>
          </span>
        </div>

        <div className="mt-6 grid h-12 w-12 place-items-center rounded-2xl bg-danger-soft text-danger">
          <ShieldAlert className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-heading">{copy.title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{copy.lead}</p>

        <div className="mt-5 space-y-3">
          <Alert tone="warning">
            <p className="text-xs font-semibold uppercase tracking-[0.1em]">{copy.reason}</p>
            <p className="mt-1 text-sm">{restriction.reason}</p>
          </Alert>
          <div className="rounded-xl bg-page-soft px-4 py-3 text-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-muted">{copy.until}</p>
            <p className="mt-1 font-semibold text-heading">
              {restriction.expires_at ? formatDate(restriction.expires_at, intlLocale(locale)) : copy.indefinite}
            </p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-line px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">{copy.whatNow}</p>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{copy.contact}</p>
        </div>

        <p className="mt-5 text-xs text-muted">
          {copy.signedInAs}: <span className="font-semibold text-heading">{user.email}</span>
        </p>
        <div className="mt-4">
          <SignOutButton label={copy.signOut} />
        </div>
      </section>
    </main>
  );
}
