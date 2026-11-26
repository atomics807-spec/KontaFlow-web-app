"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/input";
import { useI18n } from "@/components/layout/i18n-provider";
import { initialFormState } from "@/lib/action-utils";
import { CONTACT_TOPICS } from "@/lib/validation/contact";
import { submitContactMessage } from "@/app/[locale]/(marketing)/contact/actions";

export function ContactForm() {
  const { locale, dict } = useI18n();
  const copy = dict.pages.contact;
  const [state, action, pending] = useActionState(submitContactMessage, initialFormState);
  const [dismissed, setDismissed] = useState(false);

  const topics: Record<(typeof CONTACT_TOPICS)[number], string> = {
    sales: copy.topicSales,
    support: copy.topicSupport,
    partnership: copy.topicPartnership,
    press: copy.topicPress,
    other: copy.topicOther,
  };

  if (state.status === "success" && !dismissed) {
    return (
      <div className="surface p-6" role="status">
        <span className="grid h-11 w-11 place-items-center rounded-full bg-accent-soft text-accent-strong">
          <CheckCircle2 className="h-5 w-5" aria-hidden />
        </span>
        <h2 className="mt-4 text-lg font-bold text-heading">{state.message ?? copy.successTitle}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">{copy.successBody}</p>
        <Button type="button" variant="secondary" size="sm" className="mt-5" onClick={() => setDismissed(true)}>
          {copy.formTitle}
        </Button>
      </div>
    );
  }

  return (
    <form action={action} className="surface relative p-5 sm:p-6" noValidate>
      <input type="hidden" name="locale" value={locale} />
      <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label htmlFor="contact-website">{copy.honeypot}</label>
        <input id="contact-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <h2 className="text-lg font-bold text-heading">{copy.formTitle}</h2>
      <p className="mt-1 text-sm text-muted">{copy.formSubtitle}</p>

      {state.status === "error" && state.message ? (
        <Alert tone="error" className="mt-4">
          {state.message}
        </Alert>
      ) : null}

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label={copy.name} htmlFor="contact-name" error={state.fieldErrors?.name?.[0]}>
          <Input id="contact-name" name="name" required autoComplete="name" maxLength={120} />
        </Field>
        <Field label={copy.email} htmlFor="contact-email" error={state.fieldErrors?.email?.[0]}>
          <Input id="contact-email" name="email" type="email" required autoComplete="email" maxLength={160} />
        </Field>
        <Field label={copy.company} htmlFor="contact-company" error={state.fieldErrors?.company?.[0]}>
          <Input id="contact-company" name="company" autoComplete="organization" maxLength={120} />
        </Field>
        <Field label={copy.topic} htmlFor="contact-topic" error={state.fieldErrors?.topic?.[0]}>
          <Select id="contact-topic" name="topic" defaultValue="sales">
            {CONTACT_TOPICS.map((topic) => (
              <option key={topic} value={topic}>
                {topics[topic]}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="mt-4">
        <Field label={copy.message} htmlFor="contact-message" error={state.fieldErrors?.message?.[0]}>
          <Textarea id="contact-message" name="message" rows={6} required maxLength={4000} />
        </Field>
      </div>

      <label className="mt-4 flex items-start gap-2.5 text-sm text-muted">
        <input
          type="checkbox"
          name="consent"
          required
          className="mt-0.5 h-4 w-4 rounded border-line"
        />
        <span>{copy.consent}</span>
      </label>
      {state.fieldErrors?.consent?.[0] ? (
        <p className="mt-1 text-xs font-medium text-danger">{state.fieldErrors.consent[0]}</p>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Button type="submit" disabled={pending}>
          <Send className="h-4 w-4" aria-hidden />
          {pending ? copy.sending : copy.submit}
        </Button>
        <p className="text-xs text-muted">{copy.privacyNote}</p>
      </div>
    </form>
  );
}
