import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MailCheck } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { ResendEmailForm } from "@/components/forms/verification-forms";
import { getProfile, getSessionUser } from "@/lib/supabase/auth";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { safeNextPath } from "@/lib/action-utils";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.identity.verifyEmailTitle, robots: { index: false, follow: false } };
}

export default async function VerifyEmailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ email?: string; next?: string; sent?: string; error?: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const query = await searchParams;
  const user = await getSessionUser();
  const profile = user ? await getProfile() : null;
  const target = safeNextPath(query.next ?? null, `/${locale}/onboarding`);

  if (user && (user.email_confirmed_at || profile?.email_verified_at)) {
    if (profile?.verification_required && !profile.phone_verified_at) {
      redirect(`/${locale}/verify-phone?next=${encodeURIComponent(target)}`);
    }
    redirect(target);
  }

  const email = (query.email ?? user?.email ?? "").trim();

  return (
    <div>
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-jade-50 text-accent-strong">
        <MailCheck className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-heading">
        {dict.identity.verifyEmailTitle}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">{dict.identity.verifyEmailSubtitle}</p>

      <div className="mt-6 space-y-4">
        {query.error ? <Alert tone="error">{dict.identity.verifyEmailError}</Alert> : null}
        {query.sent ? <Alert tone="success">{dict.identity.verifyEmailSent}</Alert> : null}

        {email ? (
          <>
            <p className="rounded-xl border border-line bg-panel px-3 py-2 text-sm font-semibold text-heading">
              {email}
            </p>
            <ResendEmailForm email={email} />
            <p className="text-xs leading-relaxed text-muted">{dict.identity.verifyEmailSpam}</p>
          </>
        ) : (
          <Alert tone="error">{dict.identity.verifyEmailMissing}</Alert>
        )}

        <p className="text-center text-sm text-muted">
          {dict.auth.haveAccount}{" "}
          <Link href={`/${locale}/login`} className="font-semibold text-accent hover:underline">
            {dict.auth.signIn}
          </Link>
        </p>
      </div>
    </div>
  );
}
