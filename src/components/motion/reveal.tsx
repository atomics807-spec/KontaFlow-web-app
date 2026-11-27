import { cn } from "@/lib/utils";

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <div className={cn("animate-rise", className)} style={delay ? { animationDelay: `${delay}s` } : undefined}>
      {children}
    </div>
  );
}
