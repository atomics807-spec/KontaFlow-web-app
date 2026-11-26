import { describe, expect, it } from "vitest";
import { renderReportPdf } from "@/services/report-pdf";
import { en } from "@/lib/i18n/dictionaries/en";
import { fr } from "@/lib/i18n/dictionaries/fr";
import { pcm } from "@/lib/i18n/dictionaries/pcm";
import type { Locale } from "@/lib/i18n/config";
import type { ReportResult } from "@/types/database";

const report: ReportResult = {
  period: { from: "2026-01-01", to: "2026-01-31" },
  revenueMinor: "1250000",
  expenseMinor: "430000",
  netProfitMinor: "820000",
  transactionCount: 14,
  byCategory: [
    { name: "Sales", translations: { fr: "Ventes", pcm: "Sale", wes: "Sale" }, color: "#12B981", kind: "income", total: "1250000" },
    { name: "Fuel", translations: { fr: "Carburant", pcm: "Fuel", wes: "Fuel" }, color: "#DC2626", kind: "expense", total: "430000" },
  ],
  dailySeries: [{ date: "2026-01-05", income: "1250000", expense: "430000" }],
  topCustomers: [{ name: "Mballa SARL", total: "700000" }],
};

const dictionaries = { en, fr, pcm } as const;

describe("report PDF", () => {
  it.each(Object.keys(dictionaries) as Locale[])("renders a readable PDF in %s", async (locale) => {
    const pdf = await renderReportPdf({
      report,
      workspace: { name: "Mballa SARL", currency: "XAF", timezone: "Africa/Douala" },
      locale,
      dict: dictionaries[locale],
      generatedAt: new Date("2026-02-01T10:00:00Z"),
    });

    expect(pdf.byteLength).toBeGreaterThan(1500);
    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
  });
});
