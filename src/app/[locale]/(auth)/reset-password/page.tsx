import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ResetForm } from "@/components/forms/auth-forms";
import { getSessionUser } from "@/lib/supabase/auth";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.auth.newPassword, robots: { index: false, follow: false } };
}

export default async function ResetPasswordPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/forgot-password`);
  return <ResetForm />;
}
