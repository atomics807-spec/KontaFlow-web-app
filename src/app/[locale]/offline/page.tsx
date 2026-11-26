import type { Metadata } from "next";
import Link from "next/link";
import { CloudOff, ShieldCheck } from "lucide-react";
import { LogoMark } from "@/components/layout/logo";
import { OfflineCapture } from "@/components/offline/offline-capture";
import { Card } from "@/components/ui/card";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";

export const dynamic = "force-static";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return {
    title: dict.pwa.offlinePageTitle,
    description: dict.pwa.offlinePageHint,
    robots: { index: false, follow: false, nocache: true },
  };
}

export default async function OfflinePage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);

  return (
    <main className="mx-auto min-h-dvh w-full max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
      <header className="flex items-center justify-between gap-3">
        <Link href={`/${locale}`} className="inline-flex items-center gap-2.5" aria-label={dict.common.appName}>
          <LogoMark className="h-9 w-9" />
          <span className="text-[1.05rem] font-extrabold tracking-tight text-heading">
            Konta<span className="text-accent-strong">Flow</span>
          </span>
        </Link>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-warn-soft px-2.5 py-1 text-[0.7rem] font-semibold text-warn">
          <CloudOff className="h-3.5 w-3.5" aria-hidden />
          {dict.pwa.offlineCapture}
        </span>
      </header>

      <div className="mt-6">
        <h1 className="text-2xl font-extrabold tracking-tight text-heading">{dict.pwa.offlinePageTitle}</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted">{dict.pwa.offlinePageHint}</p>
      </div>

      <div className="mt-5">
        <OfflineCapture />
      </div>

      <Card className="mt-5 flex items-start gap-2.5 p-4">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
        <p className="text-xs leading-relaxed text-muted">{dict.pwa.offlinePrivacy}</p>
      </Card>
    </main>
  );
}
