import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/layout/logo";
import { LocaleSwitcher } from "@/components/layout/locale-switcher";
import { OnboardingForm } from "@/components/forms/onboarding-form";
import { SignOutButton } from "@/components/forms/sign-out-button";
import { getSessionUser, getWorkspaceContext } from "@/lib/supabase/auth";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.onboarding.title, robots: { index: false, follow: false } };
}

export default async function OnboardingPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent("/onboarding")}`);

  const context = await getWorkspaceContext();
  if (context) redirect(`/${locale}/dashboard`);

  return (
    <div className="min-h-dvh bg-sand">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 grid-lines opacity-60 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]"
      />
      <header className="relative mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-6 sm:px-8">
        <Logo />
        <div className="flex items-center gap-4">
          <LocaleSwitcher />
          <SignOutButton label={dict.common.signOut} />
        </div>
      </header>

      <main id="main" className="relative mx-auto flex w-full max-w-5xl justify-center px-5 pb-16 pt-6 sm:px-8 sm:pt-10">
        <div className="surface w-full max-w-xl p-6 sm:p-9">
          <OnboardingForm email={user.email ?? ""} />
        </div>
      </main>
    </div>
  );
}
