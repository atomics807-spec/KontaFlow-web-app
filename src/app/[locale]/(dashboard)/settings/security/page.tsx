import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, KeyRound, LifeBuoy, MonitorSmartphone, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordForm, RecoveryForm, SessionActions } from "@/components/forms/security-forms";
import { requireWorkspaceContext } from "@/lib/supabase/auth";
import { resolveLocale, intlLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { formatDateTime } from "@/lib/dates";
import { maskPhone } from "@/lib/validation/phone";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.identity.securityTitle, robots: { index: false, follow: false } };
}

export default async function SecuritySettingsPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const { user, profile } = await requireWorkspaceContext(locale);
  const emailVerified = Boolean(user.email_confirmed_at || profile?.email_verified_at);
  const phoneVerified = Boolean(profile?.phone_verified_at);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href={`/${locale}/settings`}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-heading"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {dict.settings.title}
        </Link>
        <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-heading">{dict.identity.securityTitle}</h1>
        <p className="mt-1 text-sm text-muted">{dict.identity.securitySubtitle}</p>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-accent-strong" aria-hidden />
              {dict.identity.verificationTitle}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-panel px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{dict.identity.emailStatus}</p>
              <p className="truncate text-sm font-semibold text-heading">{user.email}</p>
            </div>
            <Badge tone={emailVerified ? "jade" : "mango"}>
              {emailVerified ? dict.identity.verified : dict.identity.unverified}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-panel px-3.5 py-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{dict.identity.phoneStatus}</p>
              <p className="truncate text-sm font-semibold text-heading">
                {profile?.phone ? maskPhone(profile.phone) : "—"}
              </p>
            </div>
            {phoneVerified ? (
              <Badge tone="jade">{dict.identity.verified}</Badge>
            ) : (
              <Link href={`/${locale}/verify-phone?next=${encodeURIComponent(`/${locale}/settings/security`)}`}>
                <Badge tone="mango">{dict.identity.unverified}</Badge>
              </Link>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-accent-strong" aria-hidden />
              {dict.identity.changePassword}
            </CardTitle>
            <CardDescription>{dict.identity.currentPasswordHint}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <MonitorSmartphone className="h-4 w-4 text-accent-strong" aria-hidden />
              {dict.identity.sessionsTitle}
            </CardTitle>
            <CardDescription>{dict.identity.sessionsSubtitle}</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-xl border border-line bg-panel px-3.5 py-3 text-sm">
            <p className="font-semibold text-heading">{dict.identity.currentSession}</p>
            <p className="mt-0.5 text-xs text-muted">
              {dict.identity.lastSignIn}: {formatDateTime(user.last_sign_in_at ?? user.created_at, intlLocale(locale))}
            </p>
          </div>
          <SessionActions />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <LifeBuoy className="h-4 w-4 text-accent-strong" aria-hidden />
              {dict.identity.recoveryTitle}
            </CardTitle>
            <CardDescription>{dict.identity.recoverySubtitle}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <RecoveryForm />
        </CardContent>
      </Card>
    </div>
  );
}
