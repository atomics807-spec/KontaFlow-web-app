import { describe, expect, it } from "vitest";
import { renderTransactionsPdf } from "@/services/transactions-pdf";
import { en } from "@/lib/i18n/dictionaries/en";
import { fr } from "@/lib/i18n/dictionaries/fr";
import { pcm } from "@/lib/i18n/dictionaries/pcm";
import type { Locale } from "@/lib/i18n/config";
import type { TransactionViewRow } from "@/types/database";

const row = (overrides: Partial<TransactionViewRow>): TransactionViewRow => ({
  id: "00000000-0000-0000-0000-000000000001",
  workspace_id: "00000000-0000-0000-0000-000000000002",
  kind: "income",
  status: "posted",
  occurred_on: "2026-11-12",
  description: "Sale of two cartons of tomatoes",
  reference: null,
  amount_minor: 18000,
  currency: "XAF",
  payment_method: "cash",
  channel: "web",
  category_id: null,
  category_name: "Sales",
  category_translations: { fr: "Ventes", pcm: "Sale" },
  contact_id: null,
  contact_name: "Mballa SARL",
  account_id: "00000000-0000-0000-0000-000000000003",
  account_name: "Cash",
  created_by: null,
  created_at: "2026-11-12T09:00:00Z",
  attachment_path: null,
  ...overrides,
});

const rows = [
  row({}),
  row({ id: "00000000-0000-0000-0000-000000000004", kind: "expense", description: "Fuel", amount_minor: 5000, contact_name: null }),
];

const dictionaries = { en, fr, pcm } as const;

describe("transactions PDF", () => {
  it.each(Object.keys(dictionaries) as Locale[])("renders an itemized ledger in %s", async (locale) => {
    const pdf = await renderTransactionsPdf({
      workspace: { name: "Nkeng Fresh Foods", currency: "XAF", timezone: "Africa/Douala" },
      rows,
      locale,
      dict: dictionaries[locale],
      generatedAt: new Date("2026-11-26T10:00:00Z"),
    });

    expect(pdf.byteLength).toBeGreaterThan(1500);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  });

  it("renders an empty ledger without a valid workspace name", async () => {
    const pdf = await renderTransactionsPdf({
      workspace: { name: "Empty Workspace", currency: "XAF", timezone: "Africa/Douala" },
      rows: [],
      locale: "en",
      dict: en,
    });
    expect(pdf.byteLength).toBeGreaterThan(500);
  });
});
