import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Plus_Jakarta_Sans } from "next/font/google";
import { notFound } from "next/navigation";
import { I18nProvider } from "@/components/layout/i18n-provider";
import { ServiceWorkerRegistrar } from "@/components/layout/sw-registrar";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { MotionProvider } from "@/components/motion/motion-provider";
import { ToastProvider } from "@/components/ui/toast";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import { LOCALES, LOCALE_META, isLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { getPublicEnv } from "@/lib/env";
import "../globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-jetbrains",
  display: "swap",
});

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale: rawLocale } = await params;
  const locale = isLocale(rawLocale) ? rawLocale : "en";
  const dict = await getDictionary(locale);
  const meta = LOCALE_META[locale];
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return {
    metadataBase: new URL(appUrl),
    title: {
      default: `${dict.common.appName} — ${dict.common.tagline}`,
      template: `%s · ${dict.common.appName}`,
    },
    description: dict.marketing.heroSubtitle,
    applicationName: dict.common.appName,
    manifest: "/manifest.webmanifest",
    icons: {
      icon: [
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
    },
    openGraph: {
      type: "website",
      siteName: dict.common.appName,
      title: `${dict.common.appName} — ${dict.common.tagline}`,
      description: dict.marketing.heroSubtitle,
      locale: meta.ogLocale,
      url: `${appUrl}/${locale}`,
      images: [{ url: `${appUrl}/images/marketing/og-default.webp`, alt: dict.common.tagline }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${dict.common.appName} — ${dict.common.tagline}`,
      description: dict.marketing.heroSubtitle,
      images: [`${appUrl}/images/marketing/og-default.webp`],
    },
    alternates: {
      canonical: `${appUrl}/${locale}`,
      languages: Object.fromEntries(LOCALES.map((code) => [LOCALE_META[code as Locale].htmlLang, `${appUrl}/${code}`])),
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f5ee" },
    { media: "(prefers-color-scheme: dark)", color: "#0a3327" },
  ],
  colorScheme: "light dark",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  if (!isLocale(rawLocale)) notFound();

  const locale = rawLocale;
  const dict = await getDictionary(locale);
  const meta = LOCALE_META[locale];

  // Fail fast in development when the Supabase keys are missing.
  if (process.env.NODE_ENV === "development") {
    try {
      getPublicEnv();
    } catch {
      // Rendered pages still work; auth entry points surface a setup notice.
    }
  }

  return (
    <html
      lang={meta.htmlLang}
      dir={meta.dir}
      suppressHydrationWarning
      className={`${jakarta.variable} ${jetbrains.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-page text-ink antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-forest focus:px-4 focus:py-2 focus:text-white"
        >
          {dict.common.continue}
        </a>
        <ThemeProvider>
          <I18nProvider locale={locale} dict={dict}>
            <MotionProvider>
              <ToastProvider>
                {children}
                <ServiceWorkerRegistrar />
              </ToastProvider>
            </MotionProvider>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
