"use client";

import Link from "next/link";
import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableWrap, Td, Th } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { VoidButton } from "@/components/dashboard/void-button";
import { useI18n } from "@/components/layout/i18n-provider";
import { formatMoney, moneyLocale } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { intlLocale } from "@/lib/i18n/config";
import type { TransactionListItem } from "@/components/dashboard/transaction-list";

export function TransactionsTable({
  items,
  allowVoid,
}: {
  items: TransactionListItem[];
  allowVoid: boolean;
}) {
  const { locale, dict } = useI18n();

  if (items.length === 0) {
    return <EmptyState icon={ArrowLeftRight} title={dict.transactions.empty} description={dict.transactions.emptyHint} />;
  }

  return (
    <TableWrap>
      <Table>
        <caption className="sr-only">{dict.transactions.title}</caption>
        <thead>
          <tr>
            <Th scope="col">{dict.common.date}</Th>
            <Th scope="col">{dict.common.description}</Th>
            <Th scope="col">{dict.common.category}</Th>
            <Th scope="col">{dict.transactions.source}</Th>
            <Th scope="col" className="text-right">
              {dict.common.amount}
            </Th>
            {allowVoid ? (
              <Th scope="col" className="text-right">
                {dict.common.actions}
              </Th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const Icon =
              item.kind === "income" ? ArrowDownLeft : item.kind === "transfer" ? ArrowLeftRight : ArrowUpRight;
            const amount = BigInt(item.amountMinor);

            return (
              <tr key={item.id} className="hover:bg-page/50">
                <Td className="whitespace-nowrap text-xs text-muted">{formatDate(item.occurredOn, intlLocale(locale))}</Td>
                <Td>
                  <div className="flex items-center gap-2.5">
                    <span
                      className={
                        item.kind === "income"
                          ? "grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent"
                          : item.kind === "expense"
                            ? "grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-warn-soft text-warn"
                            : "grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-page-soft text-muted"
                      }
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <Link
                        href={`/${locale}/transactions/${item.id}`}
                        className={item.status === "voided" ? "block truncate text-sm text-muted line-through" : "block truncate text-sm font-semibold text-heading hover:text-accent hover:underline"}
                      >
                        {item.description}
                      </Link>
                      <p className="flex items-center gap-1.5 truncate text-xs text-muted">
                        <span className="truncate">
                          {item.contactName ? `${item.contactName} · ` : ""}
                          {item.accountName}
                        </span>
                        {item.attachmentPath ? (
                          <a
                            href={`/api/receipts/${item.id}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex shrink-0 items-center gap-0.5 text-accent hover:underline"
                            title={dict.transactions.receipt}
                          >
                            <Paperclip className="h-3 w-3" aria-hidden />
                            <span className="sr-only">{dict.transactions.receipt}</span>
                          </a>
                        ) : null}
                      </p>
                    </div>
                  </div>
                </Td>
                <Td className="text-xs text-muted">{item.categoryName ?? "—"}</Td>
                <Td>
                  <div className="flex items-center gap-1.5">
                    <Badge tone="outline" className="text-[0.65rem]">
                      {item.channel === "ussd"
                        ? dict.transactions.channelUssd
                        : item.channel === "whatsapp"
                          ? dict.transactions.channelWhatsapp
                          : item.channel === "ai"
                            ? dict.transactions.channelAi
                            : item.channel === "sync"
                              ? dict.transactions.channelSync
                              : dict.transactions.channelWeb}
                    </Badge>
                    {item.status === "voided" ? (
                      <Badge tone="clay" className="text-[0.65rem]">
                        {dict.transactions.voided}
                      </Badge>
                    ) : null}
                  </div>
                </Td>
                <Td className="whitespace-nowrap text-right">
                  <span
                    className={
                      item.status === "voided"
                        ? "kpi-value text-sm text-muted line-through"
                        : item.kind === "income"
                          ? "kpi-value text-sm font-semibold text-accent"
                          : item.kind === "expense"
                            ? "kpi-value text-sm font-semibold text-danger"
                            : "kpi-value text-sm font-semibold text-muted"
                    }
                  >
                    {item.kind === "expense" ? "−" : item.kind === "income" ? "+" : ""}
                    {formatMoney(amount, item.currency, moneyLocale(locale, item.currency))}
                  </span>
                </Td>
                {allowVoid ? (
                  <Td className="text-right">
                    {item.status === "posted" ? <VoidButton transactionId={item.id} /> : <span className="text-xs text-muted">—</span>}
                  </Td>
                ) : null}
              </tr>
            );
          })}
        </tbody>
      </Table>
    </TableWrap>
  );
}
