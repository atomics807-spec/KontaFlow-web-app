"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type DropdownItem =
  | { type?: "item"; label: string; href: string; icon?: LucideIcon }
  | { type: "action"; label: string; onSelect: () => void; icon?: LucideIcon; danger?: boolean }
  | { type: "separator" };

/**
 * Keyboard-operable menu (Arrow/Home/End/Escape) with roving focus and
 * click-outside dismissal. Links keep native navigation semantics.
 */
export function DropdownMenu({
  label,
  children,
  items,
  align = "end",
  className,
  menuClassName,
}: {
  label: string;
  children: React.ReactNode;
  items: DropdownItem[];
  align?: "start" | "end";
  className?: string;
  menuClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const focusItem = (index: "first" | "last" | number) => {
    const nodes = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    if (!nodes?.length) return;
    const target =
      index === "first" ? nodes[0] : index === "last" ? nodes[nodes.length - 1] : nodes[index];
    target?.focus();
  };

  return (
    <div ref={wrapperRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => focusItem("first"));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setOpen(true);
            requestAnimationFrame(() => focusItem("last"));
          }
        }}
        className="flex items-center"
      >
        {children}
      </button>

      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          role="menu"
          aria-label={label}
          onKeyDown={(event) => {
            const nodes = Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
            const current = nodes.indexOf(document.activeElement as HTMLElement);
            if (event.key === "ArrowDown") {
              event.preventDefault();
              focusItem(current < 0 ? 0 : (current + 1) % nodes.length);
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              focusItem(current <= 0 ? nodes.length - 1 : current - 1);
            }
            if (event.key === "Home") {
              event.preventDefault();
              focusItem("first");
            }
            if (event.key === "End") {
              event.preventDefault();
              focusItem("last");
            }
          }}
          className={cn(
            "absolute top-[calc(100%+0.5rem)] z-50 min-w-56 overflow-hidden rounded-xl border border-line bg-panel p-1.5 shadow-pop",
            align === "end" ? "right-0" : "left-0",
            menuClassName,
          )}
        >
          {items.map((item, index) => {
            if (item.type === "separator") {
              return <div key={`sep-${index}`} role="separator" className="my-1 h-px bg-line" />;
            }
            const Icon = item.icon;
            const shared =
              "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors duration-150 focus-visible:outline-none";
            if (item.type === "action") {
              return (
                <button
                  key={item.label}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={cn(
                    shared,
                    "hover:bg-page focus-visible:bg-page",
                    item.danger ? "text-danger hover:bg-danger-soft" : "text-ink hover:text-heading",
                  )}
                >
                  {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden /> : null}
                  {item.label}
                </button>
              );
            }
            return (
              <a
                key={item.label}
                href={item.href}
                role="menuitem"
                tabIndex={-1}
                onClick={() => setOpen(false)}
                className={cn(shared, "text-ink hover:bg-page hover:text-heading focus-visible:bg-page")}
              >
                {Icon ? <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden /> : null}
                {item.label}
              </a>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
