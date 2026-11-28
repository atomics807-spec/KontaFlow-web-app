"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShoppingBasket, TrendingDown, Wallet } from "lucide-react";
import { useI18n } from "@/components/layout/i18n-provider";
import { cn } from "@/lib/utils";

export function EasyBottomNav() {
  const { locale, dict } = useI18n();
  const pathname = usePathname();
  const items = [
    { href: `/${locale}/easy`, label: dict.easy.navMoney, icon: Wallet, active: pathname === `/${locale}/easy` },
    {
      href: `/${locale}/easy/record?kind=income`,
      label: dict.easy.navSold,
      icon: ShoppingBasket,
      active: false,
      tone: "income",
    },
    {
      href: `/${locale}/easy/record?kind=expense`,
      label: dict.easy.navSpent,
      icon: TrendingDown,
      active: false,
      tone: "expense",
    },
  ] as const;

  return (
    <nav
      aria-label={dict.easy.actionsTitle}
      className="fixed inset-x-0 bottom-0 z-30 border-t-2 border-line bg-page/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_-18px_rgba(0,0,0,0.35)] backdrop-blur-md print:hidden"
    >
      <div className="mx-auto grid w-full max-w-4xl grid-cols-3 gap-2 px-3 py-2">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.active ? "page" : undefined}
              className={cn(
                "flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border-2 px-2 text-center text-xs font-black leading-tight transition active:scale-[0.98]",
                item.active
                  ? "border-forest bg-accent-soft text-heading"
                  : "border-transparent bg-panel text-muted hover:border-line",
                !item.active && "tone" in item && item.tone === "income" ? "text-accent" : "",
                !item.active && "tone" in item && item.tone === "expense" ? "text-danger" : "",
              )}
            >
              <Icon className="h-7 w-7" aria-hidden />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
