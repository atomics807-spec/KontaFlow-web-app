"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/**
 * CSS-only tooltip: shows on hover and on keyboard focus, so it stays usable
 * without JavaScript timers and does not trap pointer events.
 */
export function Tooltip({
  label,
  children,
  side = "top",
  className,
}: {
  label: string;
  children: React.ReactNode;
  side?: "top" | "bottom";
  className?: string;
}) {
  const id = useId();
  return (
    <span className={cn("group relative inline-flex", className)}>
      <span aria-describedby={id} className="inline-flex">
        {children}
      </span>
      <span
        role="tooltip"
        id={id}
        className={cn(
          "pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-lg bg-forest px-2.5 py-1.5 text-[0.7rem] font-semibold text-white opacity-0 shadow-lg transition duration-150",
          side === "top" ? "bottom-full mb-2 translate-y-1" : "top-full mt-2 -translate-y-1",
          "group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100",
        )}
      >
        {label}
      </span>
    </span>
  );
}
