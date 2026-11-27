import type { Locale } from "@/lib/i18n/config";
import type { FaqItem } from "./types";

export type AeoLink = { label: string; href: string; description: string };

export type ComparePageCopy = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  image: string;
  imageAlt: string;
  introTitle: string;
  introBody: string;
  lastReviewed: string;
  table: {
    title: string;
    subtitle: string;
    columns: string[];
    rows: { label: string; values: string[] }[];
    note: string;
  };
  faqTitle: string;
  faq: FaqItem[];
  linksTitle: string;
  links: AeoLink[];
  cta: { title: string; body: string; primary: string; secondary: string };
};

export type GlossaryPageCopy = {
  metaTitle: string;
  metaDescription: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  image: string;
  imageAlt: string;
  introTitle: string;
  introBody: string;
  lastReviewed: string;
  terms: { term: string; definition: string }[];
  linksTitle: string;
  links: AeoLink[];
  cta: { title: string; body: string; primary: string; secondary: string };
};

export type AeoContent = { compare: ComparePageCopy; glossary: GlossaryPageCopy };

const en: AeoContent = {
  compare: {
    metaTitle: "KontaFlow compared with notebooks, spreadsheets and basic invoicing apps",
    metaDescription:
      "A practical comparison of paper notebooks, spreadsheets, basic invoicing apps and KontaFlow for small-business bookkeeping, cash flow and offline recording.",
    eyebrow: "Compare",
    title: "KontaFlow compared with notebooks, spreadsheets and basic invoicing apps",
    subtitle:
      "A practical comparison for a business that records sales on a phone, in a shop and sometimes without a connection.",
    image: "/images/marketing/business-notes.webp",
    imageAlt: "Business notes and a laptop on a desk",
    introTitle: "Choose the tool that matches the way money arrives",
    introBody:
      "There is no single right tool for every business. This page compares broad categories, not named competitors, so you can see where a connected bookkeeping system fits and where a simpler method is enough.",
    lastReviewed: "2026-11-26",
    table: {
      title: "What each approach can do",
      subtitle: "The comparison is about typical capabilities, not brand claims.",
      columns: ["Paper notebook", "Spreadsheet", "Basic invoicing app", "KontaFlow"],
      rows: [
        { label: "Records a sale from WhatsApp or USSD", values: ["No", "No", "No", "Yes"] },
        { label: "Keeps working without a connection", values: ["Yes", "Limited", "No", "Yes, with sync"] },
        { label: "Keeps a double-entry ledger", values: ["No", "Manual", "Limited", "Yes"] },
        { label: "Shows an audit trail for corrections", values: ["No", "Manual", "Limited", "Yes"] },
        { label: "Produces profit and cash-flow reports", values: ["No", "Manual", "Limited", "Yes"] },
        { label: "Answers questions from your own records", values: ["No", "No", "No", "Yes, with review"] },
        { label: "Supports team roles and workspace isolation", values: ["No", "Limited", "Limited", "Yes"] },
        { label: "Stores receipts and supporting documents", values: ["No", "Limited", "Limited", "Yes"] },
      ],
      note: "Generic categories only. Features vary by provider. This is not a review, ranking or endorsement of any named product.",
    },
    faqTitle: "Questions about choosing a bookkeeping method",
    faq: [
      {
        question: "Is KontaFlow a replacement for an accountant?",
        answer:
          "No. KontaFlow records transactions, keeps the ledger and produces reports. Your accountant still handles tax filings, professional judgement and advice for your situation.",
      },
      {
        question: "Can I move existing books into KontaFlow?",
        answer:
          "You can start with clear opening balances and use CSV exports for your accountant. For a complex migration, contact the team before importing historical records.",
      },
      {
        question: "Does KontaFlow work when the network is down?",
        answer:
          "Yes. The web app can queue entries on the device and sync them later. Each queued entry keeps its original business date and is retried safely.",
      },
      {
        question: "Do I need a smartphone to use KontaFlow?",
        answer:
          "No. The web app works on a smartphone or computer, and the USSD channel works on a basic phone without a data bundle.",
      },
    ],
    linksTitle: "Continue with the details",
    links: [
      { label: "Features", href: "/features", description: "See the ledger, reports, channels and team controls." },
      { label: "How it works", href: "/how-it-works", description: "Follow a transaction from capture to reconciliation." },
      { label: "Pricing", href: "/pricing", description: "Compare the Starter trial, Growth and Scale plans." },
      { label: "Security", href: "/security", description: "Read how workspace isolation and audit records work." },
    ],
    cta: {
      title: "Start with one clean week of books",
      body: "Record a few real transactions, review the reports and decide whether the workflow fits your business.",
      primary: "Start free trial",
      secondary: "Talk to us",
    },
  },
  glossary: {
    metaTitle: "Bookkeeping and accounting glossary for small business",
    metaDescription:
      "Plain-language definitions of bookkeeping, ledger, double-entry, profit, cash flow, reconciliation and other terms used in small-business finance.",
    eyebrow: "Glossary",
    title: "Bookkeeping terms in plain language",
    subtitle:
      "Short definitions for the words that appear in reports, invoices and conversations with an accountant.",
    image: "/images/marketing/finance-reports.webp",
    imageAlt: "Financial reports and a laptop on a desk",
    introTitle: "Understand the word before you act on the number",
    introBody:
      "Accounting has its own vocabulary. These definitions are written for business owners and staff, not for exam candidates. They explain the everyday meaning and link back to the product pages where the term appears.",
    lastReviewed: "2026-11-26",
    terms: [
      { term: "Bookkeeping", definition: "The routine work of recording money coming in and going out, with the date, amount, account and supporting detail. Bookkeeping creates the record that reporting and tax work depend on." },
      { term: "Ledger", definition: "The complete record of financial transactions for a business. A ledger groups entries by account so you can see movements in cash, bank, sales, expenses and owner equity." },
      { term: "Double-entry bookkeeping", definition: "A method where every transaction affects at least two accounts, and total debits equal total credits. It makes errors and missing entries easier to detect than a single list of income and expenses." },
      { term: "Income", definition: "Money the business earns from sales, services or other business activity. Income is not the same as cash received: an invoice can be income before the customer pays." },
      { term: "Expense", definition: "A cost incurred to earn revenue, such as stock, rent, fuel, airtime or salaries. Personal spending is not a business expense." },
      { term: "Profit", definition: "Income minus the expenses incurred in the same period. Profit measures whether the business is earning, but it does not show whether cash is available to pay bills today." },
      { term: "Cash flow", definition: "The movement of cash into and out of the business. A profitable business can still run short of cash when customers pay late or stock absorbs money." },
      { term: "Reconciliation", definition: "Comparing two records to explain a difference, for example matching the cash box or mobile money balance to the transactions recorded in the books." },
      { term: "Owner drawing", definition: "Business money taken by the owner for personal use. It is not a business expense and should be recorded separately from operating costs." },
      { term: "Accounts receivable", definition: "Money customers owe the business for invoices or credit sales. Watching the age of receivables helps you see cash that has been earned but not collected." },
      { term: "Accounts payable", definition: "Money the business owes suppliers or other creditors. It is a liability, not an expense on the day it is paid." },
      { term: "Chart of accounts", definition: "The organised list of accounts a business uses, such as cash, bank, sales, transport and rent. A clear chart of accounts keeps reports consistent." },
      { term: "Trial balance", definition: "A list of account balances used to check that total debits equal total credits before reports are prepared. It is a check, not a final set of financial statements." },
    ],
    linksTitle: "Use the definitions in context",
    links: [
      { label: "Resources", href: "/resources", description: "Practical guides on cash flow, weekly routines and separating money." },
      { label: "Compare methods", href: "/compare", description: "See how notebooks, spreadsheets and KontaFlow differ." },
      { label: "Features", href: "/features", description: "See where these terms appear in the product." },
    ],
    cta: {
      title: "Put the definitions to work",
      body: "Record a few real transactions and review the reports with the terms in mind.",
      primary: "Start free trial",
      secondary: "Contact us",
    },
  },
};

const fr: AeoContent = {
  compare: {
    metaTitle: "KontaFlow comparé aux cahiers, tableurs et applications de facturation simples",
    metaDescription:
      "Une comparaison pratique des cahiers papier, tableurs, applications de facturation simples et KontaFlow pour la comptabilité, la trésorerie et la saisie hors ligne.",
    eyebrow: "Comparer",
    title: "KontaFlow comparé aux cahiers, tableurs et applications de facturation simples",
    subtitle:
      "Une comparaison pratique pour une entreprise qui enregistre ses ventes sur un téléphone, dans une boutique et parfois sans connexion.",
    image: "/images/marketing/business-notes.webp",
    imageAlt: "Notes professionnelles et ordinateur portable sur un bureau",
    introTitle: "Choisir l'outil adapté à la façon dont l'argent arrive",
    introBody:
      "Il n'existe pas un outil unique pour toutes les entreprises. Cette page compare de grandes catégories, pas des concurrents nommés, pour voir où un système comptable connecté est utile et où une méthode plus simple suffit.",
    lastReviewed: "2026-11-26",
    table: {
      title: "Ce que chaque approche permet",
      subtitle: "La comparaison porte sur des capacités typiques, pas sur des promesses de marque.",
      columns: ["Cahier papier", "Tableur", "Application de facturation simple", "KontaFlow"],
      rows: [
        { label: "Enregistre une vente depuis WhatsApp ou l'USSD", values: ["Non", "Non", "Non", "Oui"] },
        { label: "Continue à fonctionner sans connexion", values: ["Oui", "Limité", "Non", "Oui, avec synchronisation"] },
        { label: "Tient un livre en partie double", values: ["Non", "Manuel", "Limité", "Oui"] },
        { label: "Montre une piste d'audit pour les corrections", values: ["Non", "Manuel", "Limité", "Oui"] },
        { label: "Produit des rapports de bénéfice et de trésorerie", values: ["Non", "Manuel", "Limité", "Oui"] },
        { label: "Répond aux questions à partir de vos propres écritures", values: ["Non", "Non", "Non", "Oui, avec validation"] },
        { label: "Gère les rôles d'équipe et l'isolation des espaces", values: ["Non", "Limité", "Limité", "Oui"] },
        { label: "Stocke les reçus et pièces justificatives", values: ["Non", "Limité", "Limité", "Oui"] },
      ],
      note: "Catégories génériques uniquement. Les fonctions varient selon le fournisseur. Ceci n'est ni un avis, ni un classement, ni une recommandation d'un produit nommé.",
    },
    faqTitle: "Questions pour choisir une méthode comptable",
    faq: [
      { question: "KontaFlow remplace-t-il un comptable ?", answer: "Non. KontaFlow enregistre les transactions, tient le livre et produit des rapports. Votre comptable reste responsable des déclarations fiscales, du jugement professionnel et des conseils adaptés à votre situation." },
      { question: "Puis-je reprendre mes anciens comptes dans KontaFlow ?", answer: "Vous pouvez commencer par des soldes d'ouverture clairs et utiliser les exports CSV pour votre comptable. Pour une migration complexe, contactez l'équipe avant d'importer l'historique." },
      { question: "KontaFlow fonctionne-t-il sans réseau ?", answer: "Oui. L'application web peut mettre les écritures en file sur l'appareil et les synchroniser plus tard. Chaque écriture garde sa date métier d'origine et les tentatives sont sécurisées." },
      { question: "Faut-il un smartphone pour utiliser KontaFlow ?", answer: "Non. L'application web fonctionne sur smartphone ou ordinateur, et le canal USSD fonctionne sur un téléphone simple sans forfait data." },
    ],
    linksTitle: "Continuer avec les détails",
    links: [
      { label: "Fonctionnalités", href: "/features", description: "Voir le livre, les rapports, les canaux et les contrôles d'équipe." },
      { label: "Comment ça marche", href: "/how-it-works", description: "Suivre une transaction de la saisie au rapprochement." },
      { label: "Tarifs", href: "/pricing", description: "Comparer l'essai Starter, Growth et Scale." },
      { label: "Sécurité", href: "/security", description: "Comprendre l'isolation des espaces et la piste d'audit." },
    ],
    cta: { title: "Commencez par une semaine de comptes propres", body: "Enregistrez quelques transactions réelles, consultez les rapports et décidez si le flux de travail convient à votre entreprise.", primary: "Commencer l'essai gratuit", secondary: "Parlez-nous" },
  },
  glossary: {
    metaTitle: "Glossaire de comptabilité pour les petites entreprises",
    metaDescription:
      "Définitions simples de la comptabilité, du livre, de la partie double, du bénéfice, de la trésorerie, du rapprochement et d'autres termes utiles.",
    eyebrow: "Glossaire",
    title: "Les termes comptables en langage simple",
    subtitle: "Des définitions courtes pour les mots qui apparaissent dans les rapports, les factures et les conversations avec un comptable.",
    image: "/images/marketing/finance-reports.webp",
    imageAlt: "Rapports financiers et ordinateur portable sur un bureau",
    introTitle: "Comprendre le mot avant d'agir sur le chiffre",
    introBody:
      "La comptabilité a son vocabulaire. Ces définitions sont écrites pour les propriétaires et les équipes, pas pour les examens. Elles expliquent le sens courant et renvoient aux pages produit où le terme apparaît.",
    lastReviewed: "2026-11-26",
    terms: [
      { term: "Comptabilité", definition: "Le travail régulier d'enregistrement de l'argent qui entre et sort, avec la date, le montant, le compte et les pièces justificatives. La comptabilité crée la base des rapports et des obligations fiscales." },
      { term: "Livre", definition: "L'ensemble des transactions financières d'une entreprise. Le livre regroupe les écritures par compte pour voir les mouvements de caisse, banque, ventes, dépenses et capital du propriétaire." },
      { term: "Partie double", definition: "Une méthode où chaque transaction touche au moins deux comptes et où le total des débits égale le total des crédits. Elle rend les erreurs et les écritures manquantes plus faciles à détecter." },
      { term: "Recette", definition: "L'argent gagné par l'entreprise grâce aux ventes, services ou autres activités. Une recette n'est pas toujours un encaissement : une facture peut être une recette avant le paiement du client." },
      { term: "Dépense", definition: "Un coût engagé pour produire des recettes, comme le stock, le loyer, le carburant, la communication ou les salaires. Une dépense personnelle n'est pas une dépense de l'entreprise." },
      { term: "Bénéfice", definition: "Les recettes moins les dépenses engagées sur la même période. Le bénéfice mesure si l'entreprise gagne de l'argent, mais pas si elle a de la trésorerie disponible aujourd'hui." },
      { term: "Trésorerie", definition: "Les mouvements d'argent réel qui entrent et sortent de l'entreprise. Une entreprise rentable peut manquer de trésorerie quand les clients paient en retard ou quand le stock absorbe l'argent." },
      { term: "Rapprochement", definition: "La comparaison de deux enregistrements pour expliquer un écart, par exemple entre la caisse ou le solde mobile money et les transactions du livre." },
      { term: "Prélèvement du propriétaire", definition: "L'argent de l'entreprise pris par le propriétaire pour un usage personnel. Ce n'est pas une dépense et cela doit être enregistré séparément des coûts d'exploitation." },
      { term: "Créances clients", definition: "L'argent que les clients doivent à l'entreprise pour des factures ou des ventes à crédit. Suivre leur ancienneté aide à voir la trésorerie gagnée mais non encaissée." },
      { term: "Dettes fournisseurs", definition: "L'argent que l'entreprise doit à ses fournisseurs ou autres créanciers. C'est un passif, pas une dépense le jour du paiement." },
      { term: "Plan comptable", definition: "La liste organisée des comptes utilisés par l'entreprise, comme la caisse, la banque, les ventes, le transport et le loyer. Un plan clair garde les rapports cohérents." },
      { term: "Balance générale", definition: "Une liste des soldes de comptes pour vérifier que le total des débits égale le total des crédits avant les rapports. C'est un contrôle, pas des états financiers définitifs." },
    ],
    linksTitle: "Utiliser les définitions en contexte",
    links: [
      { label: "Ressources", href: "/resources", description: "Guides pratiques sur la trésorerie, la routine hebdomadaire et la séparation de l'argent." },
      { label: "Comparer les méthodes", href: "/compare", description: "Voir les différences entre cahiers, tableurs et KontaFlow." },
      { label: "Fonctionnalités", href: "/features", description: "Voir où ces termes apparaissent dans le produit." },
    ],
    cta: { title: "Mettez les définitions en pratique", body: "Enregistrez quelques transactions réelles et relisez les rapports avec ces termes en tête.", primary: "Commencer l'essai gratuit", secondary: "Nous contacter" },
  },
};

const pcm: AeoContent = {
  compare: {
    metaTitle: "KontaFlow compared with notebook, spreadsheet and simple invoicing app",
    metaDescription:
      "Practical comparison of paper notebook, spreadsheet, simple invoicing app and KontaFlow for small-business bookkeeping, cash flow and offline recording.",
    eyebrow: "Compare",
    title: "KontaFlow compared with notebook, spreadsheet and simple invoicing app",
    subtitle: "Practical comparison for business wey dey record sale for phone, inside shop and sometimes without network.",
    image: "/images/marketing/business-notes.webp",
    imageAlt: "Business note and laptop for desk",
    introTitle: "Choose di tool wey match how money dey come",
    introBody:
      "No be one tool dey work for every business. Dis page compare broad category, no be named competitor, so yu fit see where connected bookkeeping system fit and where simple method enough.",
    lastReviewed: "2026-11-26",
    table: {
      title: "Wetin each approach fit do",
      subtitle: "Di comparison na about normal capability, no be brand promise.",
      columns: ["Paper notebook", "Spreadsheet", "Simple invoicing app", "KontaFlow"],
      rows: [
        { label: "Record sale from WhatsApp or USSD", values: ["No", "No", "No", "Yes"] },
        { label: "Continue work without network", values: ["Yes", "Limited", "No", "Yes, with sync"] },
        { label: "Keep double-entry ledger", values: ["No", "Manual", "Limited", "Yes"] },
        { label: "Show audit trail for correction", values: ["No", "Manual", "Limited", "Yes"] },
        { label: "Produce profit and cash-flow report", values: ["No", "Manual", "Limited", "Yes"] },
        { label: "Answer question from your own record", values: ["No", "No", "No", "Yes, with review"] },
        { label: "Support team role and workspace isolation", values: ["No", "Limited", "Limited", "Yes"] },
        { label: "Store receipt and supporting document", values: ["No", "Limited", "Limited", "Yes"] },
      ],
      note: "Generic category only. Feature dey differ by provider. Dis no be review, ranking or endorsement of any named product.",
    },
    faqTitle: "Question about choosing bookkeeping method",
    faq: [
      { question: "KontaFlow dey replace accountant?", answer: "No. KontaFlow dey record transaction, keep ledger and produce report. Your accountant still dey handle tax filing, professional judgement and advice for your situation." },
      { question: "I fit move old book inside KontaFlow?", answer: "Yu fit start with clear opening balance and use CSV export for your accountant. If migration complex, contact di team before yu import old record." },
      { question: "KontaFlow dey work when network no dey?", answer: "Yes. Di web app fit queue entry for device and sync later. Every queued entry keep original business date and dem dey retry am safe." },
      { question: "I need smartphone to use KontaFlow?", answer: "No. Di web app dey work for smartphone or computer, and USSD channel dey work for basic phone without data bundle." },
    ],
    linksTitle: "Continue with di detail",
    links: [
      { label: "Features", href: "/features", description: "See di ledger, report, channel and team control." },
      { label: "How e dey work", href: "/how-it-works", description: "Follow transaction from capture to reconciliation." },
      { label: "Pricing", href: "/pricing", description: "Compare Starter trial, Growth and Scale plan." },
      { label: "Security", href: "/security", description: "Read how workspace isolation and audit record dey work." },
    ],
    cta: { title: "Start with one clean week of book", body: "Record few real transaction, check di report and decide whether di workflow fit your business.", primary: "Start free trial", secondary: "Talk to us" },
  },
  glossary: {
    metaTitle: "Bookkeeping and accounting glossary for small business",
    metaDescription:
      "Simple definition of bookkeeping, ledger, double-entry, profit, cash flow, reconciliation and other term wey small business dey use.",
    eyebrow: "Glossary",
    title: "Bookkeeping term for plain language",
    subtitle: "Short definition for di word wey dey appear for report, invoice and talk with accountant.",
    image: "/images/marketing/finance-reports.webp",
    imageAlt: "Financial report and laptop for desk",
    introTitle: "Understand di word before yu act on di number",
    introBody:
      "Accounting get im own vocabulary. Dis definition dem write for business owner and staff, no be exam candidate. Dem explain everyday meaning and link back to product page where di term dey appear.",
    lastReviewed: "2026-11-26",
    terms: [
      { term: "Bookkeeping", definition: "Di routine work of recording money wey enter and comot, with date, amount, account and supporting detail. Bookkeeping na di record wey reporting and tax work depend on." },
      { term: "Ledger", definition: "Di complete record of financial transaction for business. Ledger group entry by account so yu fit see movement for cash, bank, sale, expense and owner equity." },
      { term: "Double-entry bookkeeping", definition: "Method where every transaction touch at least two account, and total debit equal total credit. E make error and missing entry easier to find pass one list of income and expense." },
      { term: "Income", definition: "Money wey business earn from sale, service or other business activity. Income no be same as cash wey yu receive: invoice fit be income before customer pay." },
      { term: "Expense", definition: "Cost wey business incur to make revenue, like stock, rent, fuel, airtime or salary. Personal spending no be business expense." },
      { term: "Profit", definition: "Income minus expense wey business incur for same period. Profit show whether business dey earn, but e no show whether cash dey available to pay bill today." },
      { term: "Cash flow", definition: "Movement of cash inside and outside business. Profitable business fit still short of cash when customer pay late or stock hold money." },
      { term: "Reconciliation", definition: "Compare two record to explain difference, for example match cash box or mobile money balance with transaction wey dey for book." },
      { term: "Owner drawing", definition: "Business money wey owner take for personal use. E no be business expense and dem suppose record am separate from operating cost." },
      { term: "Accounts receivable", definition: "Money wey customer owe business for invoice or credit sale. Check how long dem don owe fit show cash wey don earn but dem never collect." },
      { term: "Accounts payable", definition: "Money wey business owe supplier or other creditor. Na liability, no be expense for di day wey dem pay am." },
      { term: "Chart of accounts", definition: "Di organised list of account wey business use, like cash, bank, sale, transport and rent. Clear chart of accounts keep report consistent." },
      { term: "Trial balance", definition: "List of account balance to check say total debit equal total credit before report. Na check, no be final financial statement." },
    ],
    linksTitle: "Use di definition with context",
    links: [
      { label: "Resources", href: "/resources", description: "Practical guide on cash flow, weekly routine and separating money." },
      { label: "Compare method", href: "/compare", description: "See how notebook, spreadsheet and KontaFlow differ." },
      { label: "Features", href: "/features", description: "See where dis term dem appear for product." },
    ],
    cta: { title: "Put di definition to work", body: "Record few real transaction and check di report with dis term dem for mind.", primary: "Start free trial", secondary: "Contact us" },
  },
};

const content: Record<Locale, AeoContent> = { en, fr, pcm };

export function getAeoContent(locale: Locale): AeoContent {
  return content[locale] ?? content.en;
}
