"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

export function DebouncedSearch({
  defaultValue,
  placeholder,
  label,
}: {
  defaultValue: string;
  placeholder: string;
  label: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(defaultValue);
  const timer = useRef<number | null>(null);

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current);
  }, []);

  const schedule = (next: string) => {
    setValue(next);
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.trim()) params.set("q", next.trim().slice(0, 80));
      else params.delete("q");
      params.delete("page");
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
    }, 450);
  };

  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <label htmlFor="q" className="sr-only">
        {label}
      </label>
      <Input
        id="q"
        name="q"
        value={value}
        onChange={(event) => schedule(event.target.value)}
        placeholder={placeholder}
        className="pl-9"
        maxLength={80}
      />
    </div>
  );
}
