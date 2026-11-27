/* eslint-disable @next/next/no-img-element */
import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

export function Avatar({
  name,
  src,
  className,
  tone = "jade",
}: {
  name: string;
  src?: string | null;
  className?: string;
  tone?: "jade" | "forest" | "mango";
}) {
  const tones = {
    jade: "bg-jade-100 text-accent",
    forest: "bg-forest text-white",
    mango: "bg-warn-soft text-warn",
  } as const;

  if (src) {
    return (
      <img
        src={src}
        alt=""
        aria-hidden
        loading="lazy"
        className={cn("h-9 w-9 shrink-0 rounded-full object-cover", className)}
      />
    );
  }

  return (
    <span
      aria-hidden
      className={cn(
        "grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold uppercase",
        tones[tone],
        className,
      )}
    >
      {initials(name) || "K"}
    </span>
  );
}
