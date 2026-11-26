import type { Metadata } from "next";
import { ForgotForm } from "@/components/forms/auth-forms";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.auth.resetPassword, robots: { index: false, follow: false } };
}

export default function ForgotPasswordPage() {
  return <ForgotForm />;
}
