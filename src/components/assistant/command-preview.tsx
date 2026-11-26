"use client";

import { Check, RotateCcw, Sparkles, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useI18n } from "@/components/layout/i18n-provider";
import { formatDate } from "@/lib/dates";
import { formatMoney, moneyLocale } from "@/lib/money";
import { intlLocale } from "@/lib/i18n/config";
import type { AiCommandAction, AiCommandView } from "@/lib/ai/types";

type BusyAction = "confirm" | "dismiss" | "undo" | null;

export function CommandPreview({
  command,
  busy,
  onConfirm,
  onDismiss,
  onUndo,
}: {
  command: AiCommandView;
  busy: BusyAction;
  onConfirm: () => void;
  onDismiss: () => void;
  onUndo: () => void;
}) {
  const { locale, dict } = useI18n();
  const copy = dict.assistant;
  const intl = intlLocale(locale);

  if (command.status === "dismissed") return null;

  return (
    <Card className="mt-3 overflow-hidden border-accent-line/60 bg-panel p-0">
      <div className="border-b border-line bg-accent-soft/40 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="flex items-center gap-2 text-sm font-bold text-heading">
            <Sparkles className="h-4 w-4 text-accent-strong" aria-hidden />
            {copy.previewTitle}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {command.autoPosted ? <Badge tone="jade">{copy.autoPostedBadge}</Badge> : null}
            <Badge tone={command.status === "pending" ? "mango" : command.status === "reversed" ? "clay" : "jade"}>
              {command.status === "pending"
                ? copy.pending
                : command.status === "confirmed"
                  ? copy.posted
                  : command.status === "reversed"
                    ? copy.reversed
                    : copy.dismissed}
            </Badge>
          </div>
        </div>
        <p className="mt-1 text-xs text-muted">
          {command.status === "pending"
            ? copy.previewHint
            : command.status === "confirmed" && command.canUndo
              ? copy.undoWindow
              : ""}
        </p>
      </div>

      <ul className="divide-y divide-line/70">
        {command.actions.map((action, index) => (
          <li key={`${action.type}-${index}`} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <ActionBadge action={action} />
                  <p className="truncate text-sm font-semibold text-heading">
                    {action.type === "transaction" ? action.description : action.type === "debt" ? action.description : action.debtDescription}
                  </p>
                </div>
                <div className="mt-2 grid gap-x-4 gap-y-1 text-xs text-muted sm:grid-cols-2">
                  {action.type === "transaction" ? (
                    <>
                      <Detail label={copy.categoryLabel}>{action.categoryName ?? copy.kindTransfer}</Detail>
                      <Detail label={copy.accountLabel}>{action.accountName}</Detail>
                      <Detail label={copy.dateLabel}>{formatDate(action.occurredOn, intl)}</Detail>
                      {action.contactName ? <Detail label={copy.contactLabel}>{action.contactName}</Detail> : null}
                      {action.counterAccountName ? (
                        <Detail label={copy.accountLabel}>{action.counterAccountName}</Detail>
                      ) : null}
                    </>
                  ) : action.type === "debt" ? (
                    <>
                      <Detail label={copy.contactLabel}>{action.contactName}</Detail>
                      <Detail label={copy.typeLabel}>
                        {action.direction === "receivable" ? copy.directionReceivable : copy.directionPayable}
                      </Detail>
                      <Detail label={copy.dateLabel}>{formatDate(action.openedOn, intl)}</Detail>
                      {action.dueOn ? <Detail label={copy.dateLabel}>{formatDate(action.dueOn, intl)}</Detail> : null}
                    </>
                  ) : (
                    <>
                      <Detail label={copy.contactLabel}>{action.contactName}</Detail>
                      <Detail label={copy.accountLabel}>{action.accountName ?? copy.amountLabel}</Detail>
                      <Detail label={copy.dateLabel}>{formatDate(action.paidOn, intl)}</Detail>
                    </>
                  )}
                </div>
              </div>
              <p className="shrink-0 text-sm font-extrabold tabular-nums text-heading">
                {formatMoney(BigInt(action.amountMinor), action.currency, moneyLocale(locale, action.currency))}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {command.warnings.length > 0 ? (
        <div className="border-t border-line bg-warn-soft/40 px-4 py-2 text-xs text-warn">
          {command.warnings.join(" ")}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-page/60 px-4 py-3">
        {command.status === "pending" ? (
          <>
            <Button type="button" size="sm" onClick={onConfirm} disabled={busy !== null}>
              <Check className="h-4 w-4" aria-hidden />
              {busy === "confirm" ? copy.confirming : copy.confirm}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onDismiss}
              disabled={busy !== null}
              className="text-muted"
            >
              <X className="h-4 w-4" aria-hidden />
              {busy === "dismiss" ? copy.dismissing : copy.dismiss}
            </Button>
          </>
        ) : null}

        {command.status === "confirmed" && command.canUndo ? (
          <Button type="button" size="sm" variant="secondary" onClick={onUndo} disabled={busy !== null}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            {busy === "undo" ? copy.undoing : copy.undo}
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

function ActionBadge({ action }: { action: AiCommandAction }) {
  const { dict } = useI18n();
  const copy = dict.assistant;
  if (action.type === "transaction") {
    const tone = action.kind === "income" ? "jade" : action.kind === "expense" ? "clay" : "outline";
    return <Badge tone={tone}>{action.kind === "income" ? copy.kindIncome : action.kind === "expense" ? copy.kindExpense : copy.kindTransfer}</Badge>;
  }
  if (action.type === "debt") {
    return <Badge tone="mango">{copy.kindDebt}</Badge>;
  }
  return <Badge tone="forest">{copy.kindDebtPayment}</Badge>;
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <p>
      <span className="font-semibold text-heading">{label}: </span>
      {children}
    </p>
  );
}
