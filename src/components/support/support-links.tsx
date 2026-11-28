import { MessageCircle, Phone } from "lucide-react";
import { CONTACT_DETAILS } from "@/lib/contact-details";
import { cn } from "@/lib/utils";

export function SupportLinks({
  title,
  call,
  whatsapp,
  className,
  variant = "light",
}: {
  title: string;
  call: string;
  whatsapp: string;
  className?: string;
  variant?: "light" | "dark";
}) {
  const dark = variant === "dark";
  return (
    <div
      className={cn(
        "rounded-2xl border-2 p-3 text-center",
        dark ? "border-white/15 bg-white/5" : "border-line bg-panel",
        className,
      )}
    >
      <p className={cn("text-sm font-bold", dark ? "text-jade-100" : "text-heading")}>{title}</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <a
          href={CONTACT_DETAILS.telCalls}
          className={cn(
            "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black transition active:scale-[0.98]",
            dark ? "bg-mango-400 text-forest" : "bg-forest text-white",
          )}
        >
          <Phone className="h-5 w-5" aria-hidden />
          {call}
        </a>
        <a
          href={CONTACT_DETAILS.whatsappUrl}
          target="_blank"
          rel="noreferrer noopener"
          className={cn(
            "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black text-white transition active:scale-[0.98]",
            dark ? "bg-jade-500" : "bg-jade-600",
          )}
        >
          <MessageCircle className="h-5 w-5" aria-hidden />
          {whatsapp}
        </a>
      </div>
    </div>
  );
}
