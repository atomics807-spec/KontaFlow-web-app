import Link from "next/link";
import { ArrowRight, LockKeyhole } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export function PlanGate({
  title,
  body,
  cta,
  href,
}: {
  title: string;
  body: string;
  cta: string;
  href: string;
}) {
  return (
    <Card className="relative overflow-hidden p-6 sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_0%,rgba(242,182,75,0.18),transparent_50%)]"
      />
      <div className="relative max-w-xl">
        <span className="grid h-11 w-11 place-items-center rounded-2xl bg-accent-soft text-accent">
          <LockKeyhole className="h-5 w-5" aria-hidden />
        </span>
        <h2 className="mt-4 text-xl font-extrabold text-heading">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{body}</p>
        <Link href={href} className={buttonVariants({ size: "md", className: "mt-5" })}>
          {cta}
          <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </Card>
  );
}
