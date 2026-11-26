"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, CloudOff, MessageCircle, Smartphone, Sparkles, Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useI18n } from "@/components/layout/i18n-provider";
import { formatMoney, moneyLocale } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { intlLocale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";
import type { EntryChannel, TransactionKind, TransactionStatus } from "@/types/database";

export type TransactionListItem = {
  id: string;
  kind: TransactionKind;
  status: TransactionStatus;
  amountMinor: string;
  currency: string;
  occurredOn: string;
  description: string;
  categoryName?: string | null;
  contactName?: string | null;
  channel: EntryChannel;
  accountName?: string | null;
};

const CHANNEL_ICONS = {
  web: Globe,
  ussd: Smartphone,
  whatsapp: MessageCircle,
  ai: Sparkles,
  sync: CloudOff,
  api: ArrowLeftRight,
  system: ArrowLeftRight,
} as const;

export function TransactionList({
  items,
  emptyAction,
  showChannel = true,
}: {
  items: TransactionListItem[];
  emptyAction?: React.ReactNode;
  showChannel?: boolean;
}) {
  const { locale, dict } = useI18n();

  if (items.length === 0) {
    return (
      <EmptyState
        icon={ArrowLeftRight}
        title={dict.dashboard.noTransactions}
        description={dict.dashboard.noTransactionsHint}
        action={emptyAction}
      />
    );
  }

  const channelLabel = (channel: EntryChannel) => {
    const labels: Record<EntryChannel, string> = {
      web: dict.transactions.channelWeb,
      ussd: dict.transactions.channelUssd,
      whatsapp: dict.transactions.channelWhatsapp,
      ai: dict.transactions.channelAi,
      sync: dict.transactions.channelSync,
      api: dict.transactions.source,
      system: dict.transactions.source,
    };
    return labels[channel] ?? channel;
  };

  return (
    <ul className="divide-y divide-line/70">
      {items.map((item) => {
        const Icon = item.kind === "income" ? ArrowDownLeft : item.kind === "transfer" ? ArrowLeftRight : ArrowUpRight;
        const ChannelIcon = CHANNEL_ICONS[item.channel] ?? Globe;
        const amount = BigInt(item.amountMinor);

        return (
          <li key={item.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
            <span
              className={cn(
                "grid h-9 w-9 shrink-0 place-items-center rounded-xl",
                item.kind === "income" && "bg-jade-50 text-jade-700",
                item.kind === "expense" && "bg-mango-100 text-mango-600",
                item.kind === "transfer" && "bg-sand-200 text-muted",
                item.status === "voided" && "bg-sand-200 text-muted/60",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </span>

            <div className="min-w-0 flex-1">
              <p
                className={cn(
                  "truncate text-sm font-semibold text-forest",
                  item.status === "voided" && "text-muted line-through",
                )}
              >
                {item.description}
              </p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted">
                <span>{formatDate(item.occurredOn, intlLocale(locale))}</span>
                {item.categoryName ? <span>· {item.categoryName}</span> : null}
                {item.contactName ? <span>· {item.contactName}</span> : null}
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              <p
                className={cn(
                  "kpi-value text-sm font-semibold",
                  item.kind === "income" && "text-jade-700",
                  item.kind === "expense" && "text-clay",
                  item.kind === "transfer" && "text-muted",
                  item.status === "voided" && "text-muted/60 line-through",
                )}
              >
                {item.kind === "expense" ? "−" : item.kind === "income" ? "+" : ""}
                {formatMoney(amount, item.currency, moneyLocale(locale, item.currency))}
              </p>
              <div className="flex items-center gap-1.5">
                {showChannel ? (
                  <span className="inline-flex items-center gap-1 text-[0.65rem] font-medium text-muted">
                    <ChannelIcon className="h-3 w-3" aria-hidden />
                    {channelLabel(item.channel)}
                  </span>
                ) : null}
                {item.status === "voided" ? (
                  <Badge tone="clay" className="px-1.5 py-0.5 text-[0.6rem]">
                    {dict.transactions.voided}
                  </Badge>
                ) : null}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function TransactionListCard({
  items,
  viewAllHref,
  emptyAction,
  title,
}: {
  items: TransactionListItem[];
  viewAllHref: string;
  emptyAction?: React.ReactNode;
  title: string;
}) {
  const { dict } = useI18n();

  return (
    <section className="surface overflow-hidden" aria-labelledby="recent-transactions">
      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-5">
        <h2 id="recent-transactions" className="text-base font-bold text-forest">
          {title}
        </h2>
        <Link href={viewAllHref} className="text-xs font-semibold text-jade-700 hover:underline">
          {dict.common.viewAll}
        </Link>
      </div>
      <TransactionList items={items} emptyAction={emptyAction} />
    </section>
  );
}
