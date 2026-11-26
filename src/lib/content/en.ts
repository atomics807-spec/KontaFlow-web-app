import type { SiteContent } from "./types";
import { legalEn } from "./legal-en";

export const en: SiteContent = {
  common: {
    breadcrumb: "Breadcrumb",
    readMore: "Read the article",
    backToResources: "Back to resources",
    related: "Keep reading",
    legalStatus: "Status",
    legalNav: "Policies",
    talkToUs: "Talk to us",
    startTrial: "Start free trial",
    illustrative: "Illustrative photography and sample interface. Not a customer testimonial.",
    illustrativePhoto: "Illustrative photography.",
    illustrativePhotoAlt: "Illustrative photo of people working in a small business",
    home: "Home",
    resources: "Resources",
    takeaway: "Takeaway",
    source: "Source",
    editorial: "KontaFlow editorial",
  },
  home: {
    metaTitle: "KontaFlow — Your business finances. Simplified. Anywhere.",
    metaDescription:
      "KontaFlow brings bookkeeping, cash-flow insight and a business AI assistant to web, WhatsApp, USSD and offline. Built for African small businesses.",
    hero: {
      eyebrow: "Bookkeeping built for African business",
      title: "Your business finances.",
      accent: "Simplified. Anywhere.",
      subtitle:
        "Record sales and expenses on the web, by WhatsApp, over USSD or offline. KontaFlow keeps one clean ledger and turns it into answers you can act on.",
      primary: "Start free trial",
      secondary: "Explore features",
      note: "7-day trial · no card required · English, French and Pidgin",
      imageAlt: "Business owner reviewing her work on a laptop and tablet in a bright office",
      overlayTitle: "One ledger. Every channel.",
      overlayBody: "A sale on WhatsApp and a payment on USSD land in the same books.",
      channels: ["Web app", "WhatsApp", "USSD", "Offline", "AI assistant"],
      trust: [
        { value: "XAF", label: "Default currency" },
        { value: "3", label: "Interface languages" },
        { value: "RLS", label: "Workspace isolation" },
        { value: "Offline", label: "Queue and sync" },
      ],
    },
    position: {
      eyebrow: "Built for the real day",
      title: "Your books should fit your business, not the other way round.",
      body:
        "Most tools assume a desk, reliable broadband and a finance team. KontaFlow assumes a busy shop, a phone in your hand and money moving in more than one way.",
      note: "Tenant isolation, permissions and audit records are enforced in the database — not only in the interface.",
      stack: ["Next.js", "Supabase", "PostgreSQL", "Row-level security", "PWA"],
      points: [
        {
          title: "Cash and mobile money together",
          body:
            "Record cash, mobile money, bank and card activity in one place. Each entry keeps its channel, date and currency.",
        },
        {
          title: "Numbers your accountant can follow",
          body:
            "Every posted transaction creates balanced ledger lines. Corrections are traceable instead of silently changing history.",
        },
        {
          title: "Light on data, useful offline",
          body:
            "The web app installs like an app and keeps queued entries on the device until the network returns.",
        },
      ],
    },
    problem: {
      eyebrow: "The problem",
      title: "When the books live in your head, the business stays uncertain.",
      subtitle:
        "Paper notebooks, phone memory and several messaging threads make it hard to know what is true — or what to do next.",
      cards: [
        {
          title: "Three versions of the truth",
          body:
            "A notebook says one thing, mobile money another, and the bank balance something else. Reconciling them takes an evening you do not have.",
        },
        {
          title: "Sales are remembered, not recorded",
          body:
            "Small daily sales feel too routine to write down. By month-end, the biggest part of the business has disappeared from the record.",
        },
        {
          title: "Reports arrive after the decision",
          body:
            "Waiting for a month-end summary means you learn about a bad month when it is already over.",
        },
      ],
      imageAlt: "Market street in Douala with traders and traffic",
      imageCaption: "Mboppi market, Douala. Illustrative photography, not a customer.",
    },
    solution: {
      eyebrow: "The KontaFlow way",
      title: "Capture once. Understand immediately. Close properly.",
      subtitle:
        "KontaFlow combines a proper ledger with channels that fit the way money actually arrives.",
      cards: [
        {
          title: "Record in seconds",
          body:
            "Use the form, a WhatsApp message, a USSD menu or an offline entry. Each channel writes to the same workspace.",
        },
        {
          title: "Keep the detail",
          body:
            "Dates, contacts, categories, receipts and channel provenance stay attached, so the entry still makes sense next year.",
        },
        {
          title: "See what changed",
          body:
            "Income, expenses, profit and cash move together on a dashboard built for a quick daily check.",
        },
        {
          title: "Ask a grounded question",
          body:
            "The assistant reads only the records you are permitted to see, explains its answer and can prepare an entry for confirmation.",
        },
      ],
      ledgerNote: "→ one ledger",
    },
    ai: {
      eyebrow: "AI bookkeeping",
      title: "Say what happened. Review what was recorded.",
      subtitle:
        "Natural-language entry is not a magic trick. KontaFlow turns a clear sentence into a structured transaction, shows the category and amount, and lets you confirm.",
      prompt: "Spent 5,000 FCFA on fuel this morning.",
      reply:
        "Fuel expense · 5,000 FCFA · Mobile Money · today. Transport is 18% of your expenses this month. Confirm?",
      bullets: [
        "Works in English, French and Cameroon Pidgin.",
        "Asks before posting an unclear amount, category or date.",
        "Answers from your permitted workspace records, never another tenant's.",
      ],
      imageAlt: "Market vendor checking his phone in a colourful stall",
      note: "Product illustration. AI output can be wrong; review entries before posting.",
      confirm: "Confirm",
      edit: "Edit",
    },
    dashboard: {
      eyebrow: "Dashboard preview",
      title: "The morning answer to “how is business?”",
      subtitle:
        "A focused home screen shows what came in, what went out and what is left — without a spreadsheet in sight.",
      bullets: [
        "Income, expenses and net profit for the selected period.",
        "Cash on hand with the latest recorded movements.",
        "Recent activity labelled by web, WhatsApp, USSD or offline sync.",
      ],
      note: "Illustrative product view with sample data.",
      weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      sampleRows: [{"label":"Sale · 18,000","channel":"WhatsApp"},{"label":"Fuel · 5,000","channel":"Web"},{"label":"Airtime · 1,000","channel":"Offline"}],
    },
    incomeExpense: {
      eyebrow: "Income and expenses",
      title: "Every franc gets a category.",
      subtitle:
        "Simple entry when you are moving fast. Proper accounting structure when you need to close the month.",
      cards: [
        {
          title: "Income that keeps its source",
          body:
            "Record a sale, invoice payment or other income against a customer and a revenue account.",
        },
        {
          title: "Expenses that explain themselves",
          body:
            "Capture fuel, stock, rent, airtime, salaries and more, with receipts or notes attached.",
        },
        {
          title: "Corrections without cover-ups",
          body:
            "Void a posted entry with a mirrored reversal. The original stays visible and the audit trail stays intact.",
        },
      ],
      imageAlt: "Mobile money agent serving a customer in a small shop",
      caption: "Cash, mobile money, bank and card — one ledger.",
    },
    analysis: {
      eyebrow: "Financial analysis",
      title: "Turn a list of transactions into a point of view.",
      subtitle:
        "KontaFlow groups the detail so you can see margin, spending pressure and the customers or categories doing the heavy lifting.",
      note: "Profit and loss, cash flow and category reports come from the same ledger.",
      cards: [
        {
          title: "Profit, not just turnover",
          body:
            "Compare revenue with the costs behind it. A busy week can still be a thin week.",
        },
        {
          title: "Where the money leaks",
          body:
            "See the largest expense categories and how they move month by month.",
        },
        {
          title: "Who pays you",
          body:
            "Understand which customers and products carry the business — and which ones quietly cost you.",
        },
      ],
      chart: {
        kicker: "Expense mix",
        title: "Where the money went",
        sample: "Sample",
        period: "This month",
        categories: [
          { label: "Stock purchases", pct: 42 },
          { label: "Transport", pct: 24 },
          { label: "Rent and utilities", pct: 18 },
          { label: "Airtime and data", pct: 9 },
          { label: "Other", pct: 7 },
        ],
        note: "Transport is the fastest-growing category. Review fuel and delivery costs before they eat into margin.",
      },
    },
    offline: {
      eyebrow: "Offline recording",
      title: "Keep the queue moving when the network stops.",
      subtitle:
        "Market days, travel and power cuts do not pause the business. KontaFlow lets you capture the entry now and reconcile it later.",
      bullets: [
        "Entries queue on the device with their original business date.",
        "The app retries safely and avoids duplicate records.",
        "Sync status is visible, so nobody has to guess what was sent.",
      ],
      queued: "2 entries waiting on this device",
      synced: "All changes saved",
      imageAlt: "Person holding a mobile phone",
    },
    whatsapp: {
      eyebrow: "WhatsApp",
      title: "Your most-used app becomes a bookkeeping channel.",
      subtitle:
        "Send a plain message about a sale or expense. KontaFlow reads it, proposes a structured entry and replies with what it understood.",
      chat: [
        { from: "them", text: "Sold 12 cartons of water for 18,000 FCFA." },
        { from: "us", text: "Recorded as income — Sales. Customer saved as “Walk-in”. Anything else?" },
        { from: "them", text: "Bought fuel 5,000." },
        { from: "us", text: "Recorded as Transport expense. Fuel is 12% of your costs this month." },
      ],
      bullets: [
        "No new app to install for the person sending the message.",
        "Amount, category and business date are confirmed before posting.",
        "Linked to the workspace with the sender's permissions, not a shared password.",
      ],
      note: "Example conversation with sample data. Actual replies depend on your records and confirmation settings.",
      imageAlt: "Shopkeeper standing in a small shop",
      businessLabel: "Business account",
      messagePlaceholder: "Message",
    },
    ussd: {
      eyebrow: "USSD",
      title: "Bookkeeping on the phone you already have.",
      subtitle:
        "No smartphone, no data bundle, no problem. A short menu lets you record money and check the day's position.",
      screenTitle: "*384*12#",
      screenLines: ["1. Record a sale", "2. Record an expense", "3. Check balance", "4. Today's total"],
      screenFooter: "Reply with a number",
      bullets: [
        "Works on basic handsets and feature phones.",
        "Uses the same workspace and ledger as the web app.",
        "Session and usage limits protect the account.",
      ],
      note: "Menu wording and the short code may vary by deployment and mobile network.",
      imageAlt: "Feature phone held in a person's hand",
    },
    reports: {
      eyebrow: "Automated reporting",
      title: "Month-end without the archaeology.",
      subtitle:
        "Generate the reports you actually use, from the same ledger you record into every day.",
      items: [
        "Profit and loss",
        "Cash flow",
        "Expense categories",
        "Sales by customer or product",
        "Accountant-ready CSV exports",
        "Receipt and document references",
      ],
      body:
        "Reports respect the workspace timezone and currency, and can be exported for a lender, tax preparer or accountant.",
      imageAlt: "Close-up of a laptop showing financial charts beside a printed report",
      packTitle: "Month-end pack",
      packLine: "Profit & loss · Cash flow · CSV",
    },
    intelligence: {
      eyebrow: "Business intelligence",
      title: "The next question, already in view.",
      subtitle:
        "KontaFlow looks for changes worth your attention and explains them in plain language.",
      insights: [
        { label: "Transport costs", value: "+18%", note: "Compared with last month" },
        { label: "Best margin", value: "Drinks", note: "Across the last 30 days" },
        { label: "Slow payer", value: "2 invoices", note: "Past their due date" },
      ],
      bullets: [
        "Ask follow-up questions in everyday language.",
        "See which figures support the answer.",
        "Turn an insight into an entry, a reminder or a report.",
      ],
      note: "Insights are decision support, not audited advice. Check the underlying records.",
    },
    subscription: {
      eyebrow: "Subscriptions",
      title: "Start free. Pay when the business needs more.",
      subtitle:
        "Every plan includes the core ledger and every recording channel. Paid plans add capacity for teams and heavier use.",
      tiers: [
        {
          name: "Starter",
          price: "0",
          period: "FCFA",
          description: "For a solo trader getting the books in order.",
          features: [
            "One workspace",
            "Unlimited transactions",
            "Web, WhatsApp, USSD and offline",
            "AI assistant allowance",
          ],
          cta: "Start free",
        },
        {
          name: "Growth",
          price: "9,900",
          period: "FCFA / month",
          description: "For a shop or small team with daily volume.",
          features: [
            "More team seats and AI messages",
            "Everything in Starter",
            "Accountant exports",
            "Priority support",
          ],
          cta: "Talk to us",
          featured: true,
        },
        {
          name: "Scale",
          price: "29,900",
          period: "FCFA / month",
          description: "For larger teams and multi-branch operations.",
          features: [
            "Highest seat and AI allowance",
            "Everything in Growth",
            "Support for more complex setups",
            "Priority support",
          ],
          cta: "Talk to us",
        },
      ],
      footnote:
        "Prices are in FCFA and billed monthly when paid billing is arranged. The Starter plan remains free. Taxes may apply.",
      includedTitle: "Every plan includes",
      included: [
        "The double-entry ledger",
        "Web, WhatsApp, USSD and offline capture",
        "Reports and CSV exports",
        "Email and phone verification",
      ],
    },
    faq: {
      eyebrow: "Questions",
      title: "Straight answers before you start.",
      subtitle: "The things business owners and their accountants ask us most.",
      items: [
        {
          question: "Do I need a smartphone to use KontaFlow?",
          answer:
            "No. The web app is the richest experience, but USSD lets you record entries and check balances from a basic phone. WhatsApp needs a smartphone or the WhatsApp desktop app.",
        },
        {
          question: "Is the Starter plan really free?",
          answer:
            "Yes. Starter costs 0 FCFA and includes one workspace, unlimited transactions and every recording channel. Paid plans add capacity for teams and heavier use.",
        },
        {
          question: "Can my accountant access the books?",
          answer:
            "Yes. Invite them with the Accountant role. They get the access they need without your password, and every action is tied to their account.",
        },
        {
          question: "What happens when I am offline?",
          answer:
            "New entries are saved on your device with their original business date. When the connection returns, KontaFlow sends them once and avoids duplicates.",
        },
        {
          question: "Does the AI post entries without asking?",
          answer:
            "Ambiguous or unusual entries should be confirmed. The assistant proposes an amount, category and date; you review before it becomes part of the ledger.",
        },
        {
          question: "Which currencies and timezones are supported?",
          answer:
            "XAF is the default, with support for other currencies and per-workspace timezone settings. Africa/Douala is the default timezone.",
        },
        {
          question: "Can I run more than one business?",
          answer:
            "The architecture supports multiple workspaces per user. Your plan determines how many you can keep active.",
        },
        {
          question: "Is KontaFlow a bank or a lender?",
          answer:
            "No. KontaFlow is bookkeeping and business-intelligence software. It does not hold deposits, lend money or replace a licensed accountant or tax adviser.",
        },
      ],
      viewAll: "Read all frequently asked questions",
    },
    finalCta: {
      title: "Give every decision a better number behind it.",
      subtitle:
        "Set up your workspace, record one real transaction and see how the books feel when they are finally in one place.",
      primary: "Start your free trial",
      secondary: "Talk to the team",
    },
  },
  about: {
    metaTitle: "About KontaFlow — bookkeeping for African business",
    metaDescription:
      "KontaFlow is a multi-tenant bookkeeping and business-intelligence platform designed for small businesses in Cameroon and across Africa.",
    eyebrow: "About us",
    title: "Built for businesses that keep the economy moving.",
    accent: "Designed to be understood.",
    subtitle:
      "KontaFlow is bookkeeping software for owners, shopkeepers, traders and the accountants who support them. It is designed around the devices, channels and constraints of real African businesses.",
    image: "/images/marketing/team-meeting.webp",
    imageAlt: "Two colleagues working together at a table with a laptop and speakerphone",
    imageCaption: "Illustrative photography, not a customer or testimonial.",
    introTitle: "Our starting point",
    introBody:
      "A business can be busy every day and still not know whether it made a profit. The records exist — in notebooks, mobile money messages, bank alerts and memory — but they never meet. KontaFlow exists to make that meeting simple, trustworthy and useful.",
    sections: [
      {
        title: "What we are building",
        body:
          "A multi-tenant workspace where a business can record money across web, WhatsApp, USSD and offline. Behind the interface is a double-entry ledger, a permission system and a reporting layer that respects the same numbers.",
      },
      {
        title: "Four principles",
        cards: [
          {
            title: "Books before dashboards",
            body:
              "A chart is only as good as the record underneath it. We build the ledger first, then explain it.",
          },
          {
            title: "The device in your pocket",
            body:
              "A basic phone and an intermittent connection are normal, not edge cases. USSD, offline queues and a light web app matter.",
          },
          {
            title: "Explainable by default",
            body:
              "A number should be traceable to the entries that produced it. AI answers should point back to real records.",
          },
          {
            title: "Your data belongs to you",
            body:
              "Tenant isolation is enforced in the database. Your books are not a public training set for someone else's product.",
          },
        ],
      },
      {
        title: "What KontaFlow is not",
        body:
          "KontaFlow is not a bank, a lender, an auditor or a tax adviser. It does not hold customer deposits. It gives a business a clearer record and better questions to bring to its professional advisers.",
      },
      {
        title: "Where we work",
        body:
          "The product is designed in Douala, Cameroon, for businesses across the region. The interface is available in English, French and Cameroon Pidgin, with XAF as the default currency and Africa/Douala as the default timezone.",
      },
    ],
    cta: {
      title: "See whether the workspace fits your business.",
      body: "Start with the free plan and one real transaction. No card is required.",
      primary: "Start free",
      secondary: "Explore the features",
    },
  },
  features: {
    metaTitle: "Features — KontaFlow bookkeeping and business intelligence",
    metaDescription:
      "Double-entry bookkeeping, multi-channel capture, offline sync, AI assistance, reports and tenant-safe collaboration in one workspace.",
    eyebrow: "Features",
    title: "Everything you need to keep a clean set of books.",
    accent: "Nothing you have to fight.",
    subtitle:
      "One workspace for recording, checking and understanding the money. Each feature is built around a real constraint: low data, shared devices, busy days and an accountant who needs the detail.",
    image: "/images/marketing/finance-reports.webp",
    imageAlt: "Hands typing on a laptop showing financial charts and a printed report",
    imageCaption: "Illustrative photography, not a customer.",
    introTitle: "A complete bookkeeping loop",
    introBody:
      "Capture the transaction, keep the supporting detail, reconcile the balance, produce the report and ask what changed. KontaFlow keeps every step connected to the same ledger.",
    sections: [
      {
        title: "Core bookkeeping",
        cards: [
          {
            title: "Double-entry ledger",
            body:
              "Every posted transaction creates balanced debit and credit lines. Amounts are stored in integer minor units, not floating point.",
          },
          {
            title: "Immutable history",
            body:
              "Posted entries are frozen. A correction creates a mirrored reversal, so the original and the correction are both visible.",
          },
          {
            title: "Chart of accounts",
            body:
              "A usable default structure is created with the workspace, then tailored to the business.",
          },
          {
            title: "Receipts and documents",
            body:
              "Attach supporting files to transactions in private storage, reachable through short-lived links.",
          },
        ],
      },
      {
        title: "Every channel",
        cards: [
          {
            title: "Web and installable app",
            body:
              "A mobile-first interface with a PWA install prompt and an offline fallback.",
          },
          {
            title: "WhatsApp messages",
            body:
              "Send a sale or expense in ordinary language and review the proposed entry.",
          },
          {
            title: "USSD menus",
            body:
              "Record a sale, log an expense or check a balance from a basic phone.",
          },
          {
            title: "Offline queue",
            body:
              "Capture now, sync later. Original business dates and idempotent retries are preserved.",
          },
        ],
      },
      {
        title: "Understanding the business",
        cards: [
          {
            title: "Reports",
            body:
              "Profit and loss, cash flow, expense categories and CSV exports for accountants and lenders.",
          },
          {
            title: "AI assistant",
            body:
              "Ask questions in everyday language and get answers grounded in permitted workspace records.",
          },
          {
            title: "Business insights",
            body:
              "See changes in costs, margin and customer activity before month-end.",
          },
          {
            title: "Audit trail",
            body:
              "Financial actions record the actor, action, entity and workspace.",
          },
        ],
      },
      {
        title: "Team and tenant safety",
        cards: [
          {
            title: "Roles and permissions",
            body:
              "Owners, administrators, accountants, managers and staff each get a scoped view.",
          },
          {
            title: "Database-level isolation",
            body:
              "PostgreSQL row-level security protects every tenant table. The browser cannot choose another workspace by changing an ID.",
          },
          {
            title: "Verified access",
            body:
              "Email and phone verification, session revocation and a security settings page.",
          },
          {
            title: "Private storage",
            body:
              "Workspace documents and profile images live in private buckets with tenant-scoped policies.",
          },
        ],
      },
    ],
    cta: {
      title: "Try the loop with your own numbers.",
      body: "The free plan includes the core ledger and every recording channel.",
      primary: "Start free",
      secondary: "See how it works",
    },
  },
  services: {
    metaTitle: "Services — KontaFlow setup, channels and accountant collaboration",
    metaDescription:
      "Guided workspace setup, channel onboarding, accountant access and reporting support for businesses using KontaFlow.",
    eyebrow: "Services",
    title: "Software to run the books. Support to get them moving.",
    accent: "Without the consultancy invoice.",
    subtitle:
      "KontaFlow is a product first. Around it, we offer practical help with setup, channels, team roles and the reports your accountant needs.",
    image: "/images/marketing/small-business-owner.webp",
    imageAlt: "Small business owner standing in her market stall",
    imageCaption: "Illustrative photography, not a customer.",
    introTitle: "Choose the help you need",
    introBody:
      "Most businesses can start alone in minutes. If you need a hand with migration, roles or reporting, the team can help without taking ownership of your books.",
    sections: [
      {
        title: "What we can help with",
        cards: [
          {
            title: "Workspace setup",
            body:
              "Business details, currency, timezone, financial year and a sensible starting chart of accounts.",
          },
          {
            title: "Channel onboarding",
            body:
              "Connecting WhatsApp numbers, explaining USSD menus and getting the offline workflow into daily use.",
          },
          {
            title: "Accountant access",
            body:
              "Inviting your accountant with the right role and walking through the export pack.",
          },
          {
            title: "Team roles",
            body:
              "Choosing the smallest access each person needs for sales, purchases or review.",
          },
          {
            title: "Report review",
            body:
              "Helping you read profit, cash flow and category reports before a bank, lender or tax conversation.",
          },
          {
            title: "Data migration",
            body:
              "Planning how existing customers, suppliers and opening balances move into the workspace.",
          },
        ],
      },
      {
        title: "What we do not do",
        body:
          "We do not provide statutory audits, tax filing, legal advice or an outsourced accounting service. Your accountant remains responsible for professional conclusions; KontaFlow gives them a cleaner record to work from.",
      },
      {
        title: "Who it is for",
        cards: [
          {
            title: "Shops and traders",
            body:
              "Daily sales, stock purchases, mobile money and a need to know what is actually left.",
          },
          {
            title: "Small service businesses",
            body:
              "Invoices, customer balances, transport and a small team recording from their phones.",
          },
          {
            title: "Accountants and bookkeepers",
            body:
              "Client workspaces with scoped access, clean exports and a ledger that keeps its history.",
          },
        ],
      },
    ],
    cta: {
      title: "Tell us where the books are today.",
      body:
        "Send a short message about your business, your channels and what you need to clean up.",
      primary: "Talk to us",
      secondary: "See pricing",
    },
  },
  how: {
    metaTitle: "How KontaFlow works — from first entry to month-end",
    metaDescription:
      "Set up a workspace, record money through any channel, review the ledger and turn it into reports and decisions.",
    eyebrow: "How it works",
    title: "From a busy day to books you can trust.",
    accent: "In four clear steps.",
    subtitle:
      "No long implementation. Start with one transaction, add the channels you actually use, and let the ledger do the joining up.",
    image: "/images/marketing/working-laptop.webp",
    imageAlt: "Business owner entering transactions on a laptop",
    imageCaption: "Illustrative photography, not a customer.",
    introTitle: "One loop, every day",
    introBody:
      "KontaFlow is designed to be used in small moments: a sale recorded between customers, an expense confirmed on the way home, a quick check before the next order.",
    steps: [
      {
        title: "Create the workspace",
        body: "Name the business, choose currency and timezone, and confirm the financial year.",
        detail:
          "KontaFlow provisions the chart of accounts, the owner membership and a seven-day trial on the Starter plan.",
      },
      {
        title: "Record what moves",
        body: "Use the web form, WhatsApp, USSD or an offline entry.",
        detail:
          "Amount, date, category and contact are captured. The channel is stamped on the entry so you can see how it arrived.",
      },
      {
        title: "Review and reconcile",
        body: "Check the entry, attach a receipt and correct mistakes properly.",
        detail:
          "Posted entries are reversible, not editable in place. Every correction keeps the original and the reason visible.",
      },
      {
        title: "Read, report and decide",
        body: "Open the dashboard, generate a report or ask the assistant a question.",
        detail:
          "The numbers come from the same ledger. Export them for an accountant, lender or your own next decision.",
      },
    ],
    matrixTitle: "Which channel fits which moment?",
    matrixSubtitle:
      "Channels are complementary. Use the one that keeps the record moving without slowing the business down.",
    matrix: [
      { channel: "Web app", data: "Data or Wi-Fi", smartphone: "Browser", offline: "Yes, with sync" },
      { channel: "WhatsApp", data: "Data or Wi-Fi", smartphone: "Yes", offline: "No" },
      { channel: "USSD", data: "No data", smartphone: "No", offline: "Works on any phone" },
      { channel: "Offline PWA", data: "None until sync", smartphone: "Yes", offline: "Yes" },
    ],
    sections: [
      {
        title: "What you need on day one",
        body:
          "A business name, a currency, a timezone and one real transaction. You can add customers, suppliers, team members and receipts as you go.",
      },
      {
        title: "What happens to a transaction",
        cards: [
          {
            title: "Validated",
            body: "The amount, date and category are checked before anything is posted.",
          },
          {
            title: "Posted",
            body: "The entry becomes balanced ledger lines in integer minor units.",
          },
          {
            title: "Visible",
            body: "It appears in the dashboard, reports and audit trail for permitted users.",
          },
        ],
      },
      {
        title: "When you are ready for more",
        body:
          "Invite an accountant, add a second workspace on a plan that supports it, or connect WhatsApp and USSD for the rest of the team.",
      },
    ],
    cta: {
      title: "Start with one real transaction.",
      body: "The fastest way to understand KontaFlow is to put a real sale into it.",
      primary: "Create your workspace",
      secondary: "Talk to the team",
    },
  },
  faq: {
    metaTitle: "Frequently asked questions — KontaFlow",
    metaDescription:
      "Answers about KontaFlow plans, channels, offline recording, security, AI, data and accountant access.",
    eyebrow: "FAQ",
    title: "Questions, answered plainly.",
    subtitle:
      "If something is not here, send it to us. We would rather explain the limit than hide it.",
    image: "/images/marketing/office-focus.webp",
    imageAlt: "Focused professional reviewing figures on a phone and laptop",
    groups: [
      {
        title: "Getting started",
        items: [
          {
            question: "How long does setup take?",
            answer:
              "A few minutes. Register, verify your email and phone, then name the business, choose its currency and timezone. A default chart of accounts is created for you.",
          },
          {
            question: "Do I need a card to start?",
            answer:
              "No. The Starter plan is free and the workspace begins with a seven-day trial. Paid plans are arranged with the team when you need more capacity.",
          },
          {
            question: "Can I import existing records?",
            answer:
              "You can start with opening balances and add customers and suppliers as you go. For a larger migration, contact us so we can plan the data and dates properly.",
          },
          {
            question: "Does it work in French and Pidgin?",
            answer:
              "Yes. The interface is available in English, French and Cameroon Pidgin, and the AI assistant can understand all three.",
          },
        ],
      },
      {
        title: "Channels and access",
        items: [
          {
            question: "Do USSD and WhatsApp need a smartphone?",
            answer:
              "USSD works on a basic phone with no data. WhatsApp needs a smartphone or the desktop app and an internet connection.",
          },
          {
            question: "What happens if the internet goes down?",
            answer:
              "The installable web app can queue entries on the device. They keep their original business date and sync when the connection returns.",
          },
          {
            question: "Can several people use the same workspace?",
            answer:
              "Yes. Invite owners, administrators, accountants, managers and staff with scoped roles. Each person uses their own account.",
          },
          {
            question: "Can my accountant see everything?",
            answer:
              "The Accountant role is designed for bookkeeping and reporting access. Review the role description before inviting someone and remove access when it is no longer needed.",
          },
        ],
      },
      {
        title: "Money and records",
        items: [
          {
            question: "How are amounts stored?",
            answer:
              "As integer minor units with an explicit currency, not floating point. That avoids the rounding drift that makes reports disagree.",
          },
          {
            question: "Can I edit a posted transaction?",
            answer:
              "No. Posted entries are immutable. You void one with a mirrored reversal, which keeps both sides of the story visible.",
          },
          {
            question: "Which reports can I generate?",
            answer:
              "Profit and loss, cash flow, expense categories, sales by customer or product, and CSV exports. Document and receipt references stay with the records.",
          },
          {
            question: "Can I export my data?",
            answer:
              "Yes. Reports and transaction data can be exported. You can also ask us for a copy of your account data, subject to legal retention requirements.",
          },
        ],
      },
      {
        title: "Security, AI and privacy",
        items: [
          {
            question: "Is my data separated from other businesses?",
            answer:
              "Yes. Every tenant-owned record carries a workspace reference, and PostgreSQL row-level security enforces the boundary in the database, not only in the interface.",
          },
          {
            question: "Does the AI train on my books?",
            answer:
              "The assistant is designed to answer from your permitted records. Your workspace data is not used as a public training set. Review the Privacy Policy for the processors involved.",
          },
          {
            question: "Can AI make mistakes?",
            answer:
              "Yes. Language models can misread an amount, category or date. KontaFlow shows the proposed entry for review; you remain responsible for what is posted.",
          },
          {
            question: "Where can I report a security issue?",
            answer:
              "Email security@kontaflow.com with enough detail to reproduce the issue. Do not access another person's data or disrupt the service while testing.",
          },
        ],
      },
    ],
    cta: {
      title: "Still have a question?",
      body: "Send it to a human. We reply within one business day.",
      primary: "Contact us",
      secondary: "Read the security page",
    },
  },
  blog: {
    metaTitle: "Resources — practical bookkeeping for small business",
    metaDescription:
      "Short, practical guides on bookkeeping, cash flow, mobile money and financial decisions for African small businesses.",
    eyebrow: "Resources",
    title: "Practical notes for better books.",
    subtitle:
      "No jargon, no recycled corporate slides. Short guides for owners and accountants working with real constraints.",
    imageAlt: "Market vendors arranging plantain and produce",
    imageCaption: "Illustrative photography, not a customer.",
    featuredLabel: "Featured",
    readArticle: "Read article",
    allArticles: "All articles",
    minRead: "min read",
    articles: [
      {
        slug: "separate-business-and-personal-money",
        title: "How to separate business and personal money without a finance team",
        description:
          "A practical starting point for owners who pay business costs from the same wallet or mobile money account.",
        category: "Bookkeeping basics",
        publishedAt: "2026-11-12",
        readingMinutes: 5,
        image: "/images/marketing/mobile-money.webp",
        imageAlt: "Mobile money agent inside a small shop",
        intro:
          "When business and personal money share one wallet, every report becomes a guess. You do not need a finance department to fix that. You need a rule, a small amount of separation and a habit that survives a busy week.",
        sections: [
          {
            heading: "Start with one clear boundary",
            paragraphs: [
              "Choose one account, mobile money wallet or cash box for business receipts and payments. It does not have to be a business bank account on day one. It does have to be the place where business money lands and leaves.",
              "If a customer pays into your personal wallet, move the amount to the business wallet the same day and record both steps. The transfer is not income; it is a movement between your own pockets.",
            ],
          },
          {
            heading: "Record owner money separately",
            paragraphs: [
              "Money you take out for personal use is not a business expense. Treat it as an owner drawing. Money you put in is an owner contribution. Keeping those two labels clear prevents personal spending from quietly reducing your profit.",
            ],
            bullets: [
              "Owner contribution: personal money added to the business.",
              "Owner drawing: business money taken for personal use.",
              "Business expense: a cost incurred to earn revenue.",
            ],
          },
          {
            heading: "Make the rule easy to follow",
            paragraphs: [
              "Put the business wallet in a different colour case. Name it clearly. Tell the people who receive money where to send it. A rule that requires an argument at the counter will not survive.",
              "At the end of each week, compare the wallet balance with the recorded transactions. If they differ, find the missing entry before the difference becomes normal.",
            ],
          },
          {
            heading: "What to do when it is already mixed",
            paragraphs: [
              "Do not try to reconstruct every personal purchase. Start from a clear opening position today, record the business assets and liabilities you can identify, and treat the mixed history as a migration problem rather than a daily habit.",
              "Your accountant can help you decide how to present the opening balance. The important part is to stop adding new noise to the old records.",
            ],
          },
        ],
        takeaway:
          "Separation is not about having more accounts. It is about being able to answer, without guessing, whether a payment belonged to the business.",
      },
      {
        slug: "weekly-bookkeeping-routine",
        title: "A 20-minute weekly bookkeeping routine for a busy shop",
        description:
          "A repeatable routine for catching missing sales, checking expenses and closing the week before it becomes month-end panic.",
        category: "Routine",
        publishedAt: "2026-10-29",
        readingMinutes: 6,
        image: "/images/marketing/market-vendors.webp",
        imageAlt: "Market vendor arranging produce at her stall",
        intro:
          "Month-end panic is usually a week-end problem that was postponed four times. A short, regular routine is more useful than a perfect spreadsheet you open once a quarter.",
        sections: [
          {
            heading: "Pick a quiet 20 minutes",
            paragraphs: [
              "Choose the same slot every week, ideally when the shop is quiet and the day's cash has been counted. Put it in the calendar as a real appointment. The routine only works if it is boring enough to repeat.",
            ],
          },
          {
            heading: "1. Match cash and mobile money",
            paragraphs: [
              "Count the cash box and check the mobile money balance. Compare both with the week's recorded entries. Write down every difference, even the small ones. A missing 2,000 FCFA entry is easier to find now than in a month.",
            ],
          },
          {
            heading: "2. Fill the gaps",
            paragraphs: [
              "Add sales that only exist in memory, supplier payments that are still in a pocket receipt, and transfers between accounts. Use the original business date, not today's date.",
            ],
            bullets: [
              "Check the phone for mobile money messages you have not recorded.",
              "Check the cash box for receipts and IOUs.",
              "Ask the person who handled the counter about anything unexplained.",
            ],
          },
          {
            heading: "3. Review three numbers",
            paragraphs: [
              "Look at income, expenses and cash on hand for the week. Do not try to analyse everything. Ask one question: does this match what I saw in the business?",
              "If a number looks wrong, trace it to the entries before you change a report. The report is only a view of the ledger.",
            ],
          },
          {
            heading: "4. Write the next action",
            paragraphs: [
              "Finish with one concrete task for next week: chase a customer balance, correct a category, attach a missing receipt or ask an accountant about a treatment. One task is enough.",
            ],
          },
        ],
        takeaway: "The goal is not a perfect week. It is a week you can explain, close and build on.",
      },
      {
        slug: "read-cash-flow-before-profit",
        title: "Why cash flow can feel worse even when profit looks fine",
        description:
          "A plain-language look at the difference between profit and cash, and the three questions to ask when money feels tight.",
        category: "Financial analysis",
        publishedAt: "2026-10-08",
        readingMinutes: 7,
        image: "/images/marketing/finance-reports.webp",
        imageAlt: "Close-up of a laptop showing financial charts beside a printed report",
        intro:
          "A business can record a profit and still miss payroll. That is not a contradiction; it is a timing problem. Understanding the gap between profit and cash is one of the most useful financial habits an owner can build.",
        sections: [
          {
            heading: "Profit is a period. Cash is a moment.",
            paragraphs: [
              "Profit compares revenue with the costs incurred to earn it over a period. Cash flow tracks when money actually arrives and leaves. An invoice paid next month can be profit today and unavailable cash tomorrow.",
            ],
          },
          {
            heading: "Three questions for a tight week",
            paragraphs: [
              "Before borrowing or cutting costs, separate the problem from the symptom.",
            ],
            bullets: [
              "Who owes us money, and when did they promise to pay?",
              "What must leave the business in the next seven days, and what can wait?",
              "Which sales are already earned but not yet collected?",
            ],
          },
          {
            heading: "Look at the pattern, not one day",
            paragraphs: [
              "A single slow Friday is noise. A widening gap between sales and collections over several weeks is a pattern. Compare the same week across months and look at the age of unpaid customer balances.",
              "If stock is absorbing cash, check whether the stock is selling. If it is not, the balance sheet may look busy while the bank account gets thinner.",
            ],
          },
          {
            heading: "Make the forecast simple enough to use",
            paragraphs: [
              "A useful cash forecast does not need a hundred rows. Start with the opening balance, expected collections, committed payments and a buffer for surprises. Update it weekly with real numbers instead of rebuilding it from scratch.",
              "When the forecast shows a shortfall, act early: call the customer, negotiate a supplier date, or delay a non-urgent purchase. The earlier you see it, the more options you have.",
            ],
          },
        ],
        takeaway:
          "Profit tells you whether the business is earning. Cash tells you whether it can keep going. You need both, side by side.",
      },
    ],
  },
  contact: {
    metaTitle: "Contact KontaFlow",
    metaDescription:
      "Ask about pricing, setup, migrations, accountant access or a demo. Reach the KontaFlow team by email or the contact form.",
    eyebrow: "Contact",
    title: "Talk to the team behind KontaFlow.",
    subtitle:
      "Questions about pricing, setup, moving your books or working with your accountant? Send a message and a human will reply.",
    image: "/images/marketing/pricing-entrepreneur.webp",
    imageAlt: "Business owner recording sales on a laptop and phone",
    nextTitle: "What happens next",
    nextSteps: [
      "We read your message and check whether we can help directly.",
      "If needed, we ask one or two clarifying questions.",
      "You get a reply within one business day, Monday to Friday.",
    ],
    email: "hello@kontaflow.com",
    privacyEmail: "privacy@kontaflow.com",
    location: "Douala, Cameroon",
    hours: "Monday–Friday · 8:00–18:00 WAT",
  },
  legal: legalEn,
  photoCredits: {
    title: "Photo credits",
    intro:
      "The marketing site uses real photography, including CC0 images from Nappy.co, under Creative Commons or equivalent licences. Images are cropped, resized and converted to WebP for delivery. People shown are illustrative and are not customers, employees or endorsers unless explicitly stated.",
    items: [
      {
        file: "home-hero.webp",
        title: "Corporate lifestyle: Woman in the office",
        creator: "Nappy.co",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        sourceUrl: "https://nappy.co/photo/corporate-lifestyle-woman-in-the-office%2B9eJ64SoiJH4AFSVDYRmhJ",
        note: "Cropped, resized and converted.",
      },
      {
        file: "team-meeting.webp",
        title: "Team meeting session",
        creator: "Nappy.co",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        sourceUrl: "https://nappy.co/photo/office-meeting-session%2BJJXFPZ-TAjJI6JlE3qNZM",
        note: "Cropped, resized and converted.",
      },
      {
        file: "finance-reports.webp",
        title: "Finance reports",
        creator: "Nappy.co",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        sourceUrl: "https://nappy.co/photo/finance-reports%2BKXs3pwXD2zxRgfJEUa0bQ",
        note: "Cropped, resized and converted.",
      },
      {
        file: "small-business-owner.webp",
        title: "Woman in market",
        creator: "Nappy.co",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        sourceUrl: "https://nappy.co/photo/woman-in-market%2BrR4-0UdzyPsYo-p1o2JiY",
        note: "Cropped, resized and converted.",
      },
      {
        file: "working-laptop.webp",
        title: "Woman engaged in laptop work in an office",
        creator: "Nappy.co",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        sourceUrl: "https://nappy.co/photo/woman-engaged-in-laptop-work-in-an-office%2BBnw9ZcaVXWXfCG9_vxE5l",
        note: "Cropped, resized and converted.",
      },
      {
        file: "office-focus.webp",
        title: "Focused female professional at the office",
        creator: "Nappy.co",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        sourceUrl: "https://nappy.co/photo/focused-female-professional-at-the-office%2ByJocZYawPj0UjsLWedjAF",
        note: "Cropped, resized and converted.",
      },
      {
        file: "office-gadgets.webp",
        title: "Professional woman surrounded by office gadgets",
        creator: "Nappy.co",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        sourceUrl: "https://nappy.co/photo/professional-woman-surrounded-by-office-gadgets%2BKndWXt0ceyVNo3VriKxlE",
        note: "Cropped, resized and converted.",
      },
      {
        file: "pricing-entrepreneur.webp",
        title: "Female entrepreneur using laptop",
        creator: "Nappy.co",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        sourceUrl: "https://nappy.co/photo/female-entrepreneur-using-laptop%2BHNuSZewwSTsVZw50X2UOH",
        note: "Cropped, resized and converted.",
      },
      {
        file: "security-home-office.webp",
        title: "Woman in home office",
        creator: "Nappy.co",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        sourceUrl: "https://nappy.co/photo/woman-in-home-office%2BoL881xHmvxb1niG-nO6ie",
        note: "Cropped, resized and converted.",
      },
      {
        file: "market-vendor-phone.webp",
        title: "Nigeria art market",
        creator: "Nappy.co",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        sourceUrl: "https://nappy.co/photo/nigeria-art-market%2BJkiGp3iKQybmb5rQucbVN",
        note: "Cropped, resized and converted.",
      },
      {
        file: "business-notes.webp",
        title: "Business composition",
        creator: "Nappy.co",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        sourceUrl: "https://nappy.co/photo/business-composition%2BTUnoaQicaiZ9-PAk0JNon",
        note: "Cropped, resized and converted.",
      },
      {
        file: "analysis-report.webp",
        title: "Analysis report",
        creator: "Nappy.co",
        license: "CC0 1.0",
        licenseUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
        sourceUrl: "https://nappy.co/photo/analysis-report%2B9_Q-F6pqP3Ge_wkmtA-7n",
        note: "Cropped, resized and converted.",
      },
      {
        file: "market-douala.webp",
        title: "Rue du marché Mboppi à Douala",
        creator: "Johnkekam",
        license: "CC BY-SA 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Rue_du_march%C3%A9_Mboppi_%C3%A0_Douala.jpg",
        note: "Resized and converted.",
      },
      {
        file: "mobile-money.webp",
        title: "Mobile money outlet",
        creator: "Ndiwulira",
        license: "CC BY-SA 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Mobile_money_outlet.jpg",
        note: "Resized and converted.",
      },
      {
        file: "market-vendors.webp",
        title: "Bayam Sellam woman selling green banana and ripe plantain",
        creator: "Minette Lontsie",
        license: "CC BY-SA 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0/",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Bayam_Sellam_woman_selling_green_banana_and_ripe_plantain.jpg",
        note: "Resized and converted.",
      },
      {
        file: "phone-feature.webp",
        title: "Rachel Holding a Mobile Phone",
        creator: "whiteafrican (Erik Hersman)",
        license: "CC BY 2.0",
        licenseUrl: "https://creativecommons.org/licenses/by/2.0/",
        sourceUrl: "https://www.flickr.com/photos/18288598@N00/2735720397",
        note: "Cropped and resized.",
      },
    ],
  },
};
