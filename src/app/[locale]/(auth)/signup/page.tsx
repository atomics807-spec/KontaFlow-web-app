import type { Metadata } from "next";
import { SignupForm } from "@/components/forms/auth-forms";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { safeNextPath } from "@/lib/action-utils";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.auth.signUpTitle, robots: { index: true, follow: true } };
}

export default async function SignupPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const locale = resolveLocale((await params).locale);
  const { next } = await searchParams;
  return <SignupForm next={safeNextPath(next ?? null, `/${locale}/onboarding`)} />;
}
