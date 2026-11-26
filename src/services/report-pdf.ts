import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatDate } from "@/lib/dates";
import { intlLocale, pickTranslation, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { formatMoney, moneyLocale, toMinorUnits } from "@/lib/money";
import type { ReportResult } from "@/types/database";

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 48;
const INK = rgb(0.043, 0.122, 0.102);
const MUTED = rgb(0.357, 0.435, 0.408);
const FOREST = rgb(0.043, 0.239, 0.18);
const ACCENT = rgb(0.071, 0.725, 0.506);
const LINE = rgb(0.867, 0.902, 0.886);
const PANEL = rgb(0.957, 0.973, 0.965);

export type ReportPdfInput = {
  report: ReportResult;
  workspace: { name: string; currency: string; timezone: string };
  locale: Locale;
  dict: Dictionary;
  generatedAt?: Date;
};

export async function renderReportPdf(input: ReportPdfInput): Promise<Uint8Array> {
  const { report, workspace, locale, dict } = input;
  const copy = dict.reports;
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE.width, PAGE.height]);
  const money = (value: bigint | string) =>
    sanitize(formatMoney(toMinorUnits(value), workspace.currency, moneyLocale(locale, workspace.currency)));
  const date = (value: string | Date) =>
    sanitize(formatDate(value, intlLocale(locale), workspace.timezone, { day: "2-digit", month: "long", year: "numeric" }));

  doc.setTitle(`${copy.title} — ${workspace.name}`);
  doc.setAuthor("KontaFlow");
  doc.setCreator("KontaFlow");

  let y = PAGE.height - 52;
  page.drawText("KontaFlow", { x: MARGIN, y, size: 20, font: bold, color: FOREST });
  page.drawText(sanitize(workspace.name), { x: MARGIN, y: y - 17, size: 10, font: regular, color: MUTED });

  const titleWidth = bold.widthOfTextAtSize(sanitize(copy.title), 16);
  page.drawText(sanitize(copy.title), {
    x: PAGE.width - MARGIN - titleWidth,
    y,
    size: 16,
    font: bold,
    color: INK,
  });
  const periodText = `${date(report.period.from)} — ${date(report.period.to)}`;
  page.drawText(periodText, {
    x: PAGE.width - MARGIN - regular.widthOfTextAtSize(periodText, 9),
    y: y - 17,
    size: 9,
    font: regular,
    color: MUTED,
  });

  y -= 42;
  page.drawRectangle({ x: MARGIN, y, width: PAGE.width - MARGIN * 2, height: 1, color: LINE });
  y -= 28;

  page.drawText(sanitize(copy.pdfSummary), { x: MARGIN, y, size: 13, font: bold, color: INK });
  y -= 18;

  const revenue = toMinorUnits(report.revenueMinor);
  const expenses = toMinorUnits(report.expenseMinor);
  const net = toMinorUnits(report.netProfitMinor);
  const margin = revenue > 0n ? `${Number((net * 100n) / revenue)}%` : "—";
  const boxes = [
    { label: copy.revenue, value: money(revenue), tint: ACCENT },
    { label: copy.expenses, value: money(expenses), tint: rgb(0.937, 0.267, 0.267) },
    { label: copy.netProfit, value: money(net), tint: FOREST },
    { label: copy.margin, value: margin, tint: rgb(0.357, 0.435, 0.408) },
  ];
  const boxWidth = (PAGE.width - MARGIN * 2 - 12) / 2;
  const boxHeight = 58;

  for (const [index, box] of boxes.entries()) {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = MARGIN + column * (boxWidth + 12);
    const top = y - row * (boxHeight + 10);
    page.drawRectangle({ x, y: top - boxHeight, width: boxWidth, height: boxHeight, color: PANEL });
    page.drawRectangle({ x, y: top - boxHeight, width: 3, height: boxHeight, color: box.tint });
    page.drawText(sanitize(box.label), { x: x + 14, y: top - 20, size: 8, font: regular, color: MUTED });
    page.drawText(box.value, { x: x + 14, y: top - 42, size: 14, font: bold, color: INK });
  }

  y -= boxHeight * 2 + 28;
  page.drawText(sanitize(copy.pdfTransactionCount), { x: MARGIN, y, size: 10, font: regular, color: MUTED });
  const countText = String(report.transactionCount);
  page.drawText(countText, {
    x: PAGE.width - MARGIN - bold.widthOfTextAtSize(countText, 10),
    y,
    size: 10,
    font: bold,
    color: INK,
  });

  y -= 30;
  page.drawText(sanitize(copy.pdfSpending), { x: MARGIN, y, size: 13, font: bold, color: INK });
  y -= 20;
  drawTableHeader(page, regular, bold, [copy.csv.category, copy.csv.amount], y);
  y -= 16;

  const categories = [...report.byCategory].sort((a, b) => Number(toMinorUnits(b.total) - toMinorUnits(a.total)));
  if (categories.length === 0) {
    page.drawText(sanitize(copy.noData), { x: MARGIN, y, size: 10, font: regular, color: MUTED });
    y -= 20;
  } else {
    for (const row of categories.slice(0, 14)) {
      if (y < 170) break;
      const name = sanitize(pickTranslation(row.translations, locale) ?? row.name);
      const amount = money(row.total);
      page.drawText(name, { x: MARGIN, y, size: 9.5, font: regular, color: INK, maxWidth: 320 });
      page.drawText(amount, {
        x: PAGE.width - MARGIN - regular.widthOfTextAtSize(amount, 9.5),
        y,
        size: 9.5,
        font: regular,
        color: INK,
      });
      y -= 7;
      page.drawRectangle({ x: MARGIN, y, width: PAGE.width - MARGIN * 2, height: 0.5, color: LINE });
      y -= 14;
    }
  }

  if (report.topCustomers.length > 0 && y > 150) {
    y -= 8;
    page.drawText(sanitize(copy.pdfCustomers), { x: MARGIN, y, size: 13, font: bold, color: INK });
    y -= 20;
    drawTableHeader(page, regular, bold, [copy.csv.contact, copy.csv.amount], y);
    y -= 16;
    for (const customer of report.topCustomers.slice(0, 5)) {
      if (y < 110) break;
      const amount = money(customer.total);
      page.drawText(sanitize(customer.name), { x: MARGIN, y, size: 9.5, font: regular, color: INK, maxWidth: 320 });
      page.drawText(amount, {
        x: PAGE.width - MARGIN - regular.widthOfTextAtSize(amount, 9.5),
        y,
        size: 9.5,
        font: regular,
        color: INK,
      });
      y -= 18;
    }
  }

  const generated = sanitize(
    copy.generated.replace("{date}", date(input.generatedAt ?? new Date())),
  );
  page.drawRectangle({ x: MARGIN, y: 64, width: PAGE.width - MARGIN * 2, height: 0.7, color: LINE });
  page.drawText(generated, { x: MARGIN, y: 48, size: 8, font: regular, color: MUTED });
  const footer = sanitize(copy.pdfFooter);
  page.drawText(footer, {
    x: PAGE.width - MARGIN - regular.widthOfTextAtSize(footer, 8),
    y: 48,
    size: 8,
    font: regular,
    color: MUTED,
  });

  return doc.save();
}

function drawTableHeader(
  page: PDFPage,
  regular: PDFFont,
  bold: PDFFont,
  labels: [string, string],
  y: number,
) {
  page.drawText(sanitize(labels[0]), { x: MARGIN, y, size: 8, font: bold, color: MUTED });
  const second = sanitize(labels[1]);
  page.drawText(second, {
    x: PAGE.width - MARGIN - regular.widthOfTextAtSize(second, 8),
    y,
    size: 8,
    font: bold,
    color: MUTED,
  });
  page.drawRectangle({ x: MARGIN, y: y - 5, width: PAGE.width - MARGIN * 2, height: 0.7, color: LINE });
}

function sanitize(value: string): string {
  return value
    .replace(/\u202f|\u00a0/g, " ")
    .replace(/[—–]/g, "-")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/…/g, "...")
    .replace(/·/g, "-")
    .replace(/[^\x00-\xFF]/g, "?");
}
