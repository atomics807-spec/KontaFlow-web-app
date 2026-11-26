"use client";

import { useRef } from "react";
import { CreditCard, LogOut, Settings } from "lucide-react";
import { signOutAction } from "@/app/[locale]/(auth)/actions";
import { useI18n } from "@/components/layout/i18n-provider";
import { Avatar } from "@/components/ui/avatar";
import { DropdownMenu } from "@/components/ui/dropdown";

export function UserMenu({ name, email }: { name: string; email: string }) {
  const { locale, dict } = useI18n();
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <form ref={formRef} action={signOutAction} className="hidden">
        <input type="hidden" name="locale" value={locale} />
      </form>
      <DropdownMenu
        label={dict.common.profile}
        align="end"
        items={[
          { label: dict.common.settings, href: `/${locale}/settings`, icon: Settings },
          { label: dict.nav.billing, href: `/${locale}/billing`, icon: CreditCard },
          { type: "separator" },
          {
            type: "action",
            label: dict.common.signOut,
            icon: LogOut,
            danger: true,
            onSelect: () => formRef.current?.requestSubmit(),
          },
        ]}
      >
        <Avatar name={name || email} tone="jade" />
        <span className="sr-only">{name || email}</span>
      </DropdownMenu>
    </>
  );
}
