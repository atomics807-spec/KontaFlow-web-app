import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseWhatsappIntent } from "@/lib/whatsapp/commands";
import {
  messageDate,
  messageEvents,
  messageText,
  statusEvents,
  statusRank,
} from "@/lib/whatsapp/payload";
import { verifyHmacSignature } from "@/lib/whatsapp/signature";

const signature = (body: string, secret: string) =>
  `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;

describe("WhatsApp command router", () => {
  it("recognises the promised English commands", () => {
    expect(parseWhatsappIntent("I spent 500 on transport.")).toEqual({ intent: "record" });
    expect(parseWhatsappIntent("Show my sales today.")).toEqual({ intent: "sales_today" });
    expect(parseWhatsappIntent("Generate my weekly report.")).toEqual({ intent: "weekly_report" });
    expect(parseWhatsappIntent("How much do customers owe me?")).toEqual({ intent: "receivables" });
    expect(parseWhatsappIntent("Cash on hand")).toEqual({ intent: "cash" });
    expect(parseWhatsappIntent("help")).toEqual({ intent: "help" });
  });

  it("recognises French and Pidgin variants", () => {
    expect(parseWhatsappIntent("J'ai dépensé 500 pour le transport.")).toEqual({ intent: "record" });
    expect(parseWhatsappIntent("Montre mes ventes aujourd'hui")).toEqual({ intent: "sales_today" });
    expect(parseWhatsappIntent("Génère mon rapport hebdomadaire")).toEqual({ intent: "weekly_report" });
    expect(parseWhatsappIntent("Combien les clients me doivent ?")).toEqual({ intent: "receivables" });
    expect(parseWhatsappIntent("I spend 500 on transport")).toEqual({ intent: "record" });
  });

  it("extracts a six-digit link code only in the verify form", () => {
    expect(parseWhatsappIntent("VERIFY 123456")).toEqual({ intent: "verify", code: "123456" });
    expect(parseWhatsappIntent("VERIFY 123456.")).toEqual({ intent: "verify", code: "123456" });
    expect(parseWhatsappIntent("verify: 654321")).toEqual({ intent: "verify", code: "654321" });
    expect(parseWhatsappIntent("VERIFY 12345")).toEqual({ intent: "unknown" });
  });

  it("does not treat questions as new records or supplier debts as receivables", () => {
    expect(parseWhatsappIntent("How much did I spend on transport?")).toEqual({ intent: "unknown" });
    expect(parseWhatsappIntent("How much do I owe suppliers?")).toEqual({ intent: "unknown" });
  });

  it("handles consent keywords even with punctuation or a suffix", () => {
    expect(parseWhatsappIntent("STOP")).toEqual({ intent: "stop" });
    expect(parseWhatsappIntent("Stop.")).toEqual({ intent: "stop" });
    expect(parseWhatsappIntent("stop sending messages")).toEqual({ intent: "stop" });
    expect(parseWhatsappIntent("START")).toEqual({ intent: "start" });
    expect(parseWhatsappIntent("start again")).toEqual({ intent: "start" });
  });
});

describe("WhatsApp webhook payload", () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-1",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "237600000000", phone_number_id: "phone-1" },
              contacts: [{ profile: { name: "Awa" }, wa_id: "237677777777" }],
              messages: [
                {
                  from: "237677777777",
                  id: "wamid.1",
                  timestamp: "1764160000",
                  type: "text",
                  text: { body: "Show my sales today" },
                },
                {
                  from: "237677777777",
                  id: "wamid.2",
                  timestamp: "1764160001",
                  type: "interactive",
                  interactive: { type: "button_reply", button_reply: { id: "help", title: "Help" } },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  it("flattens messages and keeps metadata plus contact", () => {
    const events = messageEvents(payload);
    expect(events).toHaveLength(2);
    expect(events[0]?.message.id).toBe("wamid.1");
    expect(events[0]?.metadata.phone_number_id).toBe("phone-1");
    expect(events[0]?.contact?.profile?.name).toBe("Awa");
    expect(messageText(events[0]!.message)).toBe("Show my sales today");
    expect(messageText(events[1]!.message)).toBe("Help");
  });

  it("converts Meta epoch seconds into a date", () => {
    const date = messageDate({ timestamp: "1764160000" });
    expect(date.toISOString()).toBe("2025-11-26T12:26:40.000Z");
  });

  it("extracts delivery statuses and orders them", () => {
    const statusPayload = {
      object: "whatsapp_business_account",
      entry: [
        {
          changes: [
            {
              field: "messages",
              value: {
                metadata: { phone_number_id: "phone-1" },
                statuses: [
                  { id: "wamid.1", status: "delivered", timestamp: "1764160002", recipient_id: "2376" },
                ],
              },
            },
          ],
        },
      ],
    };
    const events = statusEvents(statusPayload);
    expect(events).toHaveLength(1);
    expect(events[0]?.status.status).toBe("delivered");
    expect(statusRank("read")).toBeGreaterThan(statusRank("delivered"));
    expect(statusRank("failed")).toBeGreaterThan(statusRank("read"));
  });
});

describe("WhatsApp signature verification", () => {
  const secret = "app-secret";
  const body = '{"object":"whatsapp_business_account"}';

  it("accepts Meta's HMAC over the exact raw body", () => {
    expect(verifyHmacSignature(body, signature(body, secret), secret)).toBe(true);
  });

  it("rejects a changed body, a wrong secret and missing headers", () => {
    expect(verifyHmacSignature(`${body} `, signature(body, secret), secret)).toBe(false);
    expect(verifyHmacSignature(body, signature(body, "other"), secret)).toBe(false);
    expect(verifyHmacSignature(body, null, secret)).toBe(false);
    expect(verifyHmacSignature(body, signature(body, secret), null)).toBe(false);
    expect(verifyHmacSignature(body, "sha1=abc", secret)).toBe(false);
  });
});
