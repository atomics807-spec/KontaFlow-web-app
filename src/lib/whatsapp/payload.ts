export type WhatsappMetadata = {
  display_phone_number?: string;
  phone_number_id?: string;
};

export type WhatsappContact = {
  profile?: { name?: string };
  wa_id?: string;
};

export type WhatsappInboundMessage = {
  from?: string;
  id?: string;
  timestamp?: string;
  type?: string;
  text?: { body?: string };
  button?: { text?: string; payload?: string };
  interactive?: {
    type?: string;
    button_reply?: { id?: string; title?: string };
    list_reply?: { id?: string; title?: string };
  };
  image?: { id?: string; mime_type?: string; caption?: string };
  audio?: { id?: string; mime_type?: string; voice?: boolean };
  document?: { id?: string; mime_type?: string; filename?: string; caption?: string };
  location?: { latitude?: number; longitude?: number; name?: string; address?: string };
  reaction?: { message_id?: string; emoji?: string };
  context?: { id?: string };
  errors?: { code?: number; title?: string; message?: string }[];
};

export type WhatsappStatus = {
  id?: string;
  status?: string;
  timestamp?: string;
  recipient_id?: string;
  conversation?: { id?: string; expiration_timestamp?: string; origin?: { type?: string } };
  pricing?: { billable?: boolean; pricing_model?: string; category?: string };
  errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[];
};

export type WhatsappChangeValue = {
  messaging_product?: string;
  metadata?: WhatsappMetadata;
  contacts?: WhatsappContact[];
  messages?: WhatsappInboundMessage[];
  statuses?: WhatsappStatus[];
  errors?: { code?: number; title?: string; message?: string }[];
};

export type WhatsappWebhookPayload = {
  object?: string;
  entry?: {
    id?: string;
    changes?: { field?: string; value?: WhatsappChangeValue }[];
  }[];
};

export type WhatsappMessageEvent = {
  message: WhatsappInboundMessage;
  metadata: WhatsappMetadata;
  contact?: WhatsappContact;
};

export type WhatsappStatusEvent = {
  status: WhatsappStatus;
  metadata: WhatsappMetadata;
  contact?: WhatsappContact;
};

export function messageEvents(payload: WhatsappWebhookPayload): WhatsappMessageEvent[] {
  const events: WhatsappMessageEvent[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field && change.field !== "messages") continue;
      const value = change.value;
      if (!value?.messages?.length) continue;
      for (const message of value.messages) {
        events.push({
          message,
          metadata: value.metadata ?? {},
          contact: value.contacts?.[0],
        });
      }
    }
  }
  return events;
}

export function statusEvents(payload: WhatsappWebhookPayload): WhatsappStatusEvent[] {
  const events: WhatsappStatusEvent[] = [];
  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field && change.field !== "messages") continue;
      const value = change.value;
      if (!value?.statuses?.length) continue;
      for (const status of value.statuses) {
        events.push({
          status,
          metadata: value.metadata ?? {},
          contact: value.contacts?.[0],
        });
      }
    }
  }
  return events;
}

export function messageText(message: WhatsappInboundMessage): string | null {
  const candidates = [
    message.text?.body,
    message.button?.text,
    message.interactive?.button_reply?.title,
    message.interactive?.list_reply?.title,
  ];
  const text = candidates.find((value) => typeof value === "string" && value.trim().length > 0);
  return text ? text.trim() : null;
}

/** Meta sends epoch seconds as a string. Accept milliseconds defensively. */
export function messageDate(message: WhatsappInboundMessage): Date {
  const raw = Number(message.timestamp);
  if (!Number.isFinite(raw) || raw <= 0) return new Date();
  const millis = raw > 10_000_000_000 ? raw : raw * 1000;
  const date = new Date(millis);
  return date.getTime() > Date.now() + 5 * 60_000 ? new Date() : date;
}

export function statusDate(status: WhatsappStatus): Date {
  const raw = Number(status.timestamp);
  if (!Number.isFinite(raw) || raw <= 0) return new Date();
  const millis = raw > 10_000_000_000 ? raw : raw * 1000;
  return new Date(millis);
}

export function statusRank(status: string | null | undefined): number {
  switch (status) {
    case "failed":
      return 50;
    case "read":
      return 40;
    case "delivered":
      return 30;
    case "sent":
      return 20;
    case "received":
    case "processed":
      return 10;
    default:
      return 0;
  }
}

export function statusError(status: WhatsappStatus): { code: string | null; title: string | null } {
  const error = status.errors?.[0];
  if (!error) return { code: null, title: null };
  return {
    code: error.code ? String(error.code) : null,
    title: (error.title || error.message || error.error_data?.details || "").slice(0, 300) || null,
  };
}
