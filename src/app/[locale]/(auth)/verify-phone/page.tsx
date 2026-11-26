import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Smartphone } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { PhoneVerificationForm } from "@/components/forms/verification-forms";
import { SignOutButton } from "@/components/forms/sign-out-button";
import { getProfile, getSessionUser } from "@/lib/supabase/auth";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { safeNextPath } from "@/lib/action-utils";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.identity.verifyPhoneTitle, robots: { index: false, follow: false } };
}

export default async function VerifyPhonePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const query = await searchParams;
  const user = await getSessionUser();
  if (!user) {
    redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/verify-phone`)}`);
  }

  const profile = await getProfile();
  const target = safeNextPath(query.next ?? null, `/${locale}/onboarding`);

  if (profile?.phone_verified_at) {
    redirect(target);
  }
  if (profile?.verification_required && !user.email_confirmed_at && !profile.email_verified_at) {
    redirect(`/${locale}/verify-email?email=${encodeURIComponent(user.email ?? "")}`);
  }

  return (
    <div>
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-mango-100 text-mango-600">
        <Smartphone className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-heading">
        {dict.identity.verifyPhoneTitle}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">{dict.identity.verifyPhoneSubtitle}</p>

      <div className="mt-6">
        {profile?.phone ? (
          <PhoneVerificationForm phone={profile.phone} next={target} />
        ) : (
          <Alert tone="error">{dict.identity.phoneRequired}</Alert>
        )}
      </div>

      <div className="mt-6 flex items-center justify-between text-sm">
        <Link href={`/${locale}/login`} className="font-semibold text-accent hover:underline">
          {dict.auth.backToSignIn}
        </Link>
        <SignOutButton label={dict.common.signOut} />
      </div>
    </div>
  );
}
