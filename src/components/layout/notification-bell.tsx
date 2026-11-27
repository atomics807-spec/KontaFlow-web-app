"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { Bell, CheckCheck } from "lucide-react";
import { useI18n } from "@/components/layout/i18n-provider";
import { formatDateTime } from "@/lib/dates";
import { intlLocale, type Locale } from "@/lib/i18n/config";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/app/[locale]/(dashboard)/notification-actions";
import type { NotificationRow } from "@/types/database";

function notificationHref(notification: NotificationRow, locale: Locale): string {
  const data = notification.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const href = data.href;
    if (typeof href === "string" && href.startsWith("/") && !href.startsWith("//")) return href;
  }
  return `/${locale}/reports`;
}

export function NotificationBell({
  notifications,
  unread,
  locale,
  timezone,
}: {
  notifications: NotificationRow[];
  unread: number;
  locale: Locale;
  timezone: string;
}) {
  const { dict } = useI18n();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const markRead = (id: string) => {
    startTransition(() => {
      void markNotificationReadAction(id, locale);
    });
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={dict.notifications.title}
        className="relative grid h-10 w-10 place-items-center rounded-full border border-line bg-panel text-heading transition hover:border-accent-line"
      >
        <Bell className="h-[1.1rem] w-[1.1rem]" aria-hidden />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 grid min-h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[0.6rem] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label={dict.notifications.title}
          className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-line bg-panel shadow-pop"
        >
          <div className="flex items-center justify-between gap-2 border-b border-line/70 px-4 py-3">
            <p className="text-sm font-bold text-heading">{dict.notifications.title}</p>
            {unread > 0 ? (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(() => {
                    void markAllNotificationsReadAction(locale);
                  })
                }
                className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline disabled:opacity-60"
              >
                <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                {dict.notifications.markAll}
              </button>
            ) : null}
          </div>

          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted">{dict.notifications.empty}</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line/70 overflow-y-auto">
              {notifications.map((notification) => (
                <li key={notification.id}>
                  <Link
                    href={notificationHref(notification, locale)}
                    onClick={() => {
                      if (!notification.read_at) markRead(notification.id);
                      setOpen(false);
                    }}
                    className="block px-4 py-3 transition hover:bg-page"
                  >
                    <span className="flex items-start gap-2">
                      {!notification.read_at ? (
                        <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent-strong" aria-hidden />
                      ) : null}
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-heading">{notification.title}</span>
                        <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted">
                          {notification.body}
                        </span>
                        <span className="mt-1 block text-[0.65rem] text-muted">
                          {formatDateTime(notification.created_at, intlLocale(locale), timezone)}
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
