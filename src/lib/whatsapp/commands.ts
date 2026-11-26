export type WhatsappIntent =
  | "verify"
  | "help"
  | "stop"
  | "start"
  | "sales_today"
  | "weekly_report"
  | "receivables"
  | "cash"
  | "record"
  | "unknown";

export type ParsedWhatsappCommand = {
  intent: WhatsappIntent;
  code?: string;
};

export const WHATSAPP_LINK_OTP_PURPOSE = "whatsapp_link";
export const WHATSAPP_CONSENT_VERSION = "2026-11";

function normalise(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .replace(/[.!?]+$/, "")
    .trim();
}

/**
 * A deliberately small deterministic router for the commands the product
 * promises on WhatsApp. Anything else goes to the assistant, which can still
 * read and record with the same audited tools as the web app.
 */
export function parseWhatsappIntent(raw: string): ParsedWhatsappCommand {
  const text = normalise(raw);

  const verify = text.match(/^(?:verify|verifier|link|lier|code)\s*[:\-]?\s*(\d{6})$/);
  if (verify?.[1]) return { intent: "verify", code: verify[1] };

  if (/^(stop|unsubscribe|opt out|desabonner|desabonne|arreter|quitter)\b/.test(text)) {
    return { intent: "stop" };
  }
  if (/^(start|resume|reprendre|recommencer|opt in|abonner)\b/.test(text)) {
    return { intent: "start" };
  }
  if (/^(help|aide|menu|commands?|commandes?)$/.test(text) || /\b(what can you do|que peux-tu faire)\b/.test(text)) {
    return { intent: "help" };
  }

  const hasWeek = /\b(week|weekly|semaine|hebdomadaire|hebdo)\b/.test(text);
  const hasReport = /\b(report|reports|rapport|bilan|resume|summary)\b/.test(text);
  if (hasWeek && hasReport) return { intent: "weekly_report" };

  const hasSupplier = /\b(suppliers?|fournisseurs?)\b/.test(text);
  const hasCustomer = /\b(customers?|clients?|debtors?|clientele|creanciers?)\b/.test(text);
  const hasOwe = /\b(owe|owed|owes|doivent|doit|receivable|receivables|creance|creances|debt|debts|dette|dettes)\b/.test(
    text,
  );
  if (hasOwe && hasCustomer && !hasSupplier) return { intent: "receivables" };
  if (/\b(who owes me|combien.*doivent|combien.*doit)\b/.test(text) && !hasSupplier) {
    return { intent: "receivables" };
  }

  const hasSales = /\b(sales?|sold|sell|income|revenue|recettes?|ventes?|vendu|chiffre d'affaires)\b/.test(text);
  const hasToday = /\b(today|todays|aujourd'hui|aujourdhui|du jour|ce jour)\b/.test(text);
  if (hasSales && hasToday) return { intent: "sales_today" };

  if (/\b(cash on hand|cash balance|solde de caisse|solde caisse|argent en caisse)\b/.test(text)) {
    return { intent: "cash" };
  }

  if (
    /^(i|we|j'ai|j ai|jai|moi|mi)\b/.test(text) &&
    /\b(spent|spend|paid|pay|bought|buy|sold|sell|received|receive|depense|depenser|paye|payer|achete|acheter|vendu|vendre|recu|recevoir)\b/.test(
      text,
    )
  ) {
    return { intent: "record" };
  }

  if (/^(record|add|enregistre|ajoute)\b/.test(text) && /\d/.test(text)) {
    return { intent: "record" };
  }

  return { intent: "unknown" };
}
