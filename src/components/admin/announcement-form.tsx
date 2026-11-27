"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Megaphone } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { saveAnnouncementAction } from "@/app/[locale]/admin/actions";
import type { SystemAnnouncement } from "@/types/platform-admin";

function localInput(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

export function AnnouncementForm({
  announcement,
  canManage,
}: {
  announcement?: SystemAnnouncement;
  canManage: boolean;
}) {
  const { locale, dict } = useI18n();
  const copy = dict.admin;
  const router = useRouter();
  const [state, action, pending] = useActionState(saveAnnouncementAction, initialFormState);

  useEffect(() => {
    if (state.status === "success") router.refresh();
  }, [state, router]);

  if (!canManage) return null;

  return (
    <form action={action} className="rounded-2xl border border-black/8 bg-white p-5" noValidate>
      <input type="hidden" name="locale" value={locale} />
      {announcement ? <input type="hidden" name="id" value={announcement.id} /> : null}

      <div className="flex items-center gap-2">
        <Megaphone className="h-4 w-4 text-[#3f6b52]" aria-hidden />
        <h2 className="text-sm font-extrabold text-[#151c19]">
          {announcement ? `${dict.common.edit}: ${announcement.title}` : copy.newAnnouncement}
        </h2>
      </div>

      {state.status === "error" && state.message ? <Alert tone="error" className="mt-3">{state.message}</Alert> : null}
      {state.status === "success" && state.message ? <Alert tone="success" className="mt-3">{state.message}</Alert> : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Field label={copy.announcementTitle} htmlFor="announcement-title" error={state.fieldErrors?.title?.[0]}>
          <Input id="announcement-title" name="title" defaultValue={announcement?.title ?? ""} maxLength={160} required />
        </Field>
        <Field label={copy.audience} htmlFor="announcement-audience" error={state.fieldErrors?.audience?.[0]}>
          <Select id="announcement-audience" name="audience" defaultValue={announcement?.audience ?? "all"}>
            <option value="all">{copy.allUsers}</option>
            <option value="workspace_admins">{copy.workspaceAdmins}</option>
          </Select>
        </Field>
      </div>

      <div className="mt-3">
        <Field label={copy.announcementBody} htmlFor="announcement-body" error={state.fieldErrors?.body?.[0]}>
          <Textarea id="announcement-body" name="body" defaultValue={announcement?.body ?? ""} maxLength={2000} required />
        </Field>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field label={copy.tone} htmlFor="announcement-tone" error={state.fieldErrors?.tone?.[0]}>
          <Select id="announcement-tone" name="tone" defaultValue={announcement?.tone ?? "info"}>
            <option value="info">{copy.infoTone}</option>
            <option value="success">{copy.successTone}</option>
            <option value="warning">{copy.warningTone}</option>
            <option value="critical">{copy.criticalTone}</option>
          </Select>
        </Field>
        <Field label={copy.startsAt} htmlFor="announcement-start" error={state.fieldErrors?.startsAt?.[0]}>
          <Input id="announcement-start" name="startsAt" type="datetime-local" defaultValue={localInput(announcement?.starts_at ?? null)} />
        </Field>
        <Field label={copy.endsAt} htmlFor="announcement-end" error={state.fieldErrors?.endsAt?.[0]}>
          <Input id="announcement-end" name="endsAt" type="datetime-local" defaultValue={localInput(announcement?.ends_at ?? null)} />
        </Field>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Select name="isActive" defaultValue={announcement?.is_active === false ? "false" : "true"} className="h-10 w-auto">
          <option value="true">{copy.publish}</option>
          <option value="false">{copy.pause}</option>
        </Select>
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? dict.common.saving : announcement ? dict.common.save : copy.publish}
        </Button>
        {announcement ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => router.push(`/${locale}/admin/announcements`)}>
            {dict.common.cancel}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
