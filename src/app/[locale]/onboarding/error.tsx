"use client";

import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/components/layout/i18n-provider";

export default function OnboardingError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { dict } = useI18n();

  useEffect(() => {
    console.error("onboarding.render_failed", error);
  }, [error]);

  return (
    <main id="main" className="mx-auto flex min-h-dvh w-full max-w-xl items-center px-5 py-10">
      <div className="surface w-full p-6 sm:p-9">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-danger-soft text-danger">
          <AlertTriangle className="h-6 w-6" aria-hidden />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold tracking-tight text-heading">{dict.errors.generic}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{dict.errors.network}</p>
        {error.digest ? <p className="mt-3 text-xs text-muted">Reference: {error.digest}</p> : null}
        <Button type="button" onClick={reset} className="mt-6 w-full" size="lg">
          {dict.common.retry}
        </Button>
      </div>
    </main>
  );
}
