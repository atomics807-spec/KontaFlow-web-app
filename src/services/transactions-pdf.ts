import { PDFDocument, StandardFonts, rgb, type PDFPage } from "pdf-lib";
import { formatDate } from "@/lib/dates";
import { intlLocale, type Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";
import { formatMoney, moneyLocale, toMinorUnits } from "@/lib/money";
import type { TransactionViewRow } from "@/types/database";

const PAGE = { width: 841.89, height: 595.28 };
const MARGIN = 36;
const INK = rgb(0.043, 0.122, 0.102);
const MUTED = rgb(0.357, 0.435, 0.408);
const FOREST = rgb(0.043, 0.239, 0.18);
const ACCENT = rgb(0.071, 0.725, 0.506);
const LINE = rgb(0.867, 0.902, 0.886);

export type TransactionsPdfInput = {
  workspace: { name: string; currency: string; timezone: string };
  rows: TransactionViewRow[];
  locale: Locale;
  dict: Dictionary;
  generatedAt?: Date;
};

export async function renderTransactionsPdf(input: TransactionsPdfInput): Promise<Uint8Array> {
  const { workspace, rows, locale, dict } = input;
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const money = (value: bigint | string | number) =>
    sanitize(formatMoney(toMinorUnits(value), workspace.currency, moneyLocale(locale, workspace.currency)));
  const date = (value: string) =>
    sanitize(formatDate(value, intlLocale(locale), workspace.timezone, { day: "2-digit", month: "short", year: "numeric" }));
  const kindLabel = (kind: TransactionViewRow["kind"]) =>
    kind === "income" ? dict.transactions.income : kind === "expense" ? dict.transactions.expense : dict.transactions.transfer;

  doc.setTitle(`${dict.transactions.title} — ${workspace.name}`);
  doc.setAuthor("KontaFlow");
  doc.setCreator("KontaFlow");

  let page = doc.addPage([PAGE.width, PAGE.height]);
  let y = PAGE.height - 48;

  const header = (target: PDFPage) => {
    target.drawText("KontaFlow", { x: MARGIN, y: PAGE.height - 48, size: 18, font: bold, color: FOREST });
    target.drawText(sanitize(workspace.name), { x: MARGIN, y: PAGE.height - 64, size: 9, font: regular, color: MUTED });
    const title = sanitize(dict.transactions.title);
    target.drawText(title, {
      x: PAGE.width - MARGIN - bold.widthOfTextAtSize(title, 14),
      y: PAGE.height - 48,
      size: 14,
      font: bold,
      color: INK,
    });
    const count = String(rows.length);
    target.drawText(count, {
      x: PAGE.width - MARGIN - regular.widthOfTextAtSize(count, 9),
      y: PAGE.height - 64,
      size: 9,
      font: regular,
      color: MUTED,
    });
    return PAGE.height - 92;
  };

  const tableHeader = (target: PDFPage, top: number) => {
    target.drawText(sanitize(dict.reports.csv.date ?? "Date"), { x: MARGIN, y: top, size: 8, font: bold, color: MUTED });
    target.drawText(sanitize(dict.transactions.type), { x: 116, y: top, size: 8, font: bold, color: MUTED });
    target.drawText(sanitize(dict.reports.csv.description ?? "Description"), { x: 176, y: top, size: 8, font: bold, color: MUTED });
    target.drawText(sanitize(dict.reports.csv.contact ?? "Contact"), { x: 386, y: top, size: 8, font: bold, color: MUTED });
    target.drawText(sanitize(dict.transactions.accountLabel), { x: 496, y: top, size: 8, font: bold, color: MUTED });
    const amount = sanitize(dict.reports.csv.amount ?? "Amount");
    target.drawText(amount, {
      x: PAGE.width - MARGIN - bold.widthOfTextAtSize(amount, 8),
      y: top,
      size: 8,
      font: bold,
      color: MUTED,
    });
    target.drawRectangle({ x: MARGIN, y: top - 6, width: PAGE.width - MARGIN * 2, height: 0.6, color: LINE });
  };

  y = header(page);
  tableHeader(page, y);
  y -= 20;

  for (const row of rows) {
    if (y < 68) {
      page = doc.addPage([PAGE.width, PAGE.height]);
      y = header(page);
      tableHeader(page, y);
      y -= 20;
    }

    const amount = money(row.amount_minor);
    page.drawText(date(row.occurred_on), { x: MARGIN, y, size: 8.5, font: regular, color: INK });
    page.drawText(kindLabel(row.kind), { x: 116, y, size: 8.5, font: regular, color: MUTED });
    page.drawText(truncate(sanitize(row.description), 34), { x: 176, y, size: 8.5, font: regular, color: INK });
    page.drawText(truncate(sanitize(row.contact_name ?? ""), 18), { x: 386, y, size: 8.5, font: regular, color: MUTED });
    page.drawText(truncate(sanitize(row.account_name), 20), { x: 496, y, size: 8.5, font: regular, color: MUTED });
    page.drawText(amount, {
      x: PAGE.width - MARGIN - regular.widthOfTextAtSize(amount, 8.5),
      y,
      size: 8.5,
      font: regular,
      color: row.kind === "income" ? FOREST : INK,
    });

    y -= 8;
    page.drawRectangle({ x: MARGIN, y, width: PAGE.width - MARGIN * 2, height: 0.4, color: LINE });
    y -= 12;
  }

  if (rows.length === 0) {
    page.drawText(sanitize(dict.reports.noData), { x: MARGIN, y, size: 10, font: regular, color: MUTED });
  }

  const income = rows.filter((row) => row.kind === "income").reduce((sum, row) => sum + toMinorUnits(row.amount_minor), 0n);
  const expenses = rows.filter((row) => row.kind === "expense").reduce((sum, row) => sum + toMinorUnits(row.amount_minor), 0n);
  const net = income - expenses;
  const summaryY = 52;
  page.drawRectangle({ x: MARGIN, y: summaryY + 16, width: PAGE.width - MARGIN * 2, height: 0.6, color: LINE });
  page.drawText(`${sanitize(dict.reports.revenue)}: ${money(income)}`, { x: MARGIN, y: summaryY, size: 8, font: bold, color: FOREST });
  page.drawText(`${sanitize(dict.reports.expenses)}: ${money(expenses)}`, {
    x: MARGIN + 210,
    y: summaryY,
    size: 8,
    font: bold,
    color: INK,
  });
  page.drawText(`${sanitize(dict.reports.netProfit)}: ${money(net)}`, {
    x: MARGIN + 420,
    y: summaryY,
    size: 8,
    font: bold,
    color: ACCENT,
  });
  const generated = sanitize(
    dict.reports.generated.replace("{date}", date((input.generatedAt ?? new Date()).toISOString().slice(0, 10))),
  );
  page.drawText(generated, {
    x: PAGE.width - MARGIN - regular.widthOfTextAtSize(generated, 7.5),
    y: 28,
    size: 7.5,
    font: regular,
    color: MUTED,
  });

  return doc.save();
}

function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, Math.max(0, max - 1))}...` : value;
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
