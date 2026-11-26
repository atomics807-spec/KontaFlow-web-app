import { cn } from "@/lib/utils";
import { initials } from "@/lib/utils";

export function Avatar({
  name,
  className,
  tone = "jade",
}: {
  name: string;
  className?: string;
  tone?: "jade" | "forest" | "mango";
}) {
  const tones = {
    jade: "bg-jade-100 text-accent",
    forest: "bg-forest text-white",
    mango: "bg-warn-soft text-warn",
  } as const;

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
