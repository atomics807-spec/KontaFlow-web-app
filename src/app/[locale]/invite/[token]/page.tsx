import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TriangleAlert, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";
import { getSessionUser } from "@/lib/supabase/auth";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { acceptInvitationAction } from "./actions";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function AcceptInvitationPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { locale: rawLocale, token } = await params;
  const { error } = await searchParams;
  const locale = resolveLocale(rawLocale);
  const dict = await getDictionary(locale);

  const user = await getSessionUser();
  if (!user) {
    redirect(`/${locale}/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  return (
    <main id="main" className="grid min-h-dvh place-items-center bg-sand px-5 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo />
        </div>
        <Card className="p-6 text-center sm:p-8">
          {error ? (
            <>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-clay-soft text-clay">
                <TriangleAlert className="h-6 w-6" aria-hidden />
              </span>
              <h1 className="mt-4 text-xl font-extrabold text-forest">{dict.settings.acceptInviteError}</h1>
              <p className="mt-2 text-sm text-muted">{dict.settings.acceptInviteError}</p>
              <Link
                href={`/${locale}/dashboard`}
                className={buttonVariants({ variant: "secondary", className: "mt-6 w-full justify-center" })}
              >
                {dict.nav.overview}
              </Link>
            </>
          ) : (
            <>
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-jade-50 text-jade-700">
                <UserPlus className="h-6 w-6" aria-hidden />
              </span>
              <h1 className="mt-4 text-xl font-extrabold text-forest">{dict.settings.acceptInviteTitle}</h1>
              <p className="mt-2 text-sm text-muted">
                {user.email} · {dict.settings.acceptInviteSubtitle}
              </p>
              <form action={acceptInvitationAction} className="mt-6">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="token" value={token} />
                <Button type="submit" className="w-full justify-center">
                  {dict.settings.acceptInvite}
                </Button>
              </form>
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
