import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function TableWrap({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("w-full overflow-x-auto", className)} {...props} />;
}

export function Table({ className, ...props }: ComponentProps<"table">) {
  return <table className={cn("w-full min-w-[640px] border-collapse text-sm", className)} {...props} />;
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cn(
        "border-b border-line bg-panel-muted/40 px-4 py-3 text-left text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-muted",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cn("border-b border-line/70 px-4 py-3.5 align-middle transition-colors", className)} {...props} />;
}
