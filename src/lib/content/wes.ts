import type { SiteContent } from "./types";
import { legalWes } from "./legal-wes";

export const wes: SiteContent = {
  common: {
    breadcrumb: "Breadcrumb",
    readMore: "Read di article",
    backToResources: "Go back to resources",
    related: "Read small more",
    legalStatus: "Status",
    legalNav: "Policies",
    talkToUs: "Talk to us",
    startTrial: "Start free trial",
    illustrative: "Na example photo and sample interface. No be customer testimonial.",
    illustrativePhoto: "Photo for illustration.",
    illustrativePhotoAlt: "Illustrative photo of people dey work inside small business",
    home: "Home",
    resources: "Resources",
    takeaway: "Wetin to remember",
    source: "Source",
    editorial: "KontaFlow editorial",
  },
  home: {
    metaTitle: "KontaFlow — Yu business money. Simple. Anywhere.",
    metaDescription:
      "KontaFlow join bookkeeping, cash-flow insight and AI business assistant for web, WhatsApp, USSD and offline. We make am for African small business.",
    hero: {
      eyebrow: "Bookkeeping wey sabi African business",
      title: "Yu business money.",
      accent: "Simple. Anywhere.",
      subtitle:
        "Record sale and expense for web, WhatsApp, USSD or offline. KontaFlow keep one clean book and turn am into answer wey yu fit use.",
      primary: "Start free trial",
      secondary: "See di features",
      note: "7-day trial · no card · English, French and Pidgin",
      imageAlt: "Business owner dey check her work on laptop and tablet inside bright office",
      overlayTitle: "One book. Every channel.",
      overlayBody: "Sale for WhatsApp and payment for USSD dey land for di same book.",
      channels: ["Web app", "WhatsApp", "USSD", "Offline", "AI assistant"],
      trust: [
        { value: "XAF", label: "Default currency" },
        { value: "3", label: "Interface language" },
        { value: "RLS", label: "Workspace isolation" },
        { value: "Offline", label: "Queue and sync" },
      ],
    },
    position: {
      eyebrow: "We build am for real day",
      title: "Your book suppose fit your business, no be di other way.",
      body:
        "Plenty tool think say person dey desk with strong network and finance team. KontaFlow think about busy shop, phone for hand and money wey dey move for different way.",
      note: "Tenant isolation, permissions and audit records dey enforced inside the database — no be only for the interface.",
      stack: ["Next.js", "Supabase", "PostgreSQL", "Row-level security", "PWA"],
      points: [
        {
          title: "Cash and mobile money together",
          body:
            "Record cash, mobile money, bank and card for one place. Every entry keep di channel, date and currency.",
        },
        {
          title: "Number wey your accountant fit follow",
          body:
            "Every posted transaction make balanced ledger line. Correction get trace instead of changing history quietly.",
        },
        {
          title: "Light for data, useful offline",
          body:
            "Di web app fit install like app and keep queued entry for di device until network come back.",
        },
      ],
    },
    problem: {
      eyebrow: "Di problem",
      title: "If di book dey only for head, business go always dey guess.",
      subtitle:
        "Paper notebook, phone memory and plenty message thread dey make am hard to know wetin true — and wetin to do next.",
      cards: [
        {
          title: "Three different story",
          body:
            "Notebook talk one thing, mobile money talk another, bank balance talk something else. To join dem go take evening wey yu no get.",
        },
        {
          title: "Sale dey for memory, no dey for record",
          body:
            "Small small sale every day feel too common to write. By month-end, di biggest part of business don disappear from di record.",
        },
        {
          title: "Report dey come after decision",
          body:
            "If yu wait for month-end summary, yu go learn about bad month when e don finish.",
        },
      ],
      imageAlt: "Market street for Douala with trader and traffic",
      imageCaption: "Mboppi market, Douala. Photo for illustration, no be customer.",
    },
    solution: {
      eyebrow: "KontaFlow way",
      title: "Capture once. Understand quick. Close well.",
      subtitle:
        "KontaFlow join proper ledger with channel wey follow how money really dey come.",
      cards: [
        {
          title: "Record for seconds",
          body:
            "Use di form, WhatsApp message, USSD menu or offline entry. Every channel write inside di same workspace.",
        },
        {
          title: "Keep di detail",
          body:
            "Date, contact, category, receipt and channel dey attach so di entry still make sense next year.",
        },
        {
          title: "See wetin change",
          body:
            "Income, expense, profit and cash dey move together for dashboard wey make daily check easy.",
        },
        {
          title: "Ask question wey get ground",
          body:
            "Di assistant only read record wey yu get permission to see, explain di answer and fit prepare entry for confirmation.",
        },
      ],
      ledgerNote: "→ one ledger",
    },
    ai: {
      eyebrow: "AI bookkeeping",
      title: "Talk wetin happen. Check wetin dem record.",
      subtitle:
        "Natural-language entry no be magic. KontaFlow turn clear sentence into structured transaction, show category and amount, then make yu confirm.",
      prompt: "I spend 5,000 FCFA on fuel this morning.",
      reply:
        "Fuel expense · 5,000 FCFA · Mobile Money · today. Transport na 18% of your expense this month. Confirm?",
      bullets: [
        "E dey work for English, French and Cameroon Pidgin.",
        "E dey ask before e post amount, category or date wey no clear.",
        "E dey answer from your workspace record, no be another tenant own.",
      ],
      imageAlt: "Market vendor dey check him phone for colourful stall",
      note: "Product picture. AI fit make mistake; check entry before posting.",
      confirm: "Confirm",
      edit: "Change",
    },
    dashboard: {
      eyebrow: "Dashboard preview",
      title: "Morning answer to “how business dey?”",
      subtitle:
        "One focused home screen show wetin come in, wetin go out and wetin remain — no spreadsheet.",
      bullets: [
        "Income, expense and net profit for di period.",
        "Cash on hand with latest movement.",
        "Recent activity with web, WhatsApp, USSD or offline sync label.",
      ],
      note: "Product view with sample data.",
      weekdays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      sampleRows: [{"label":"Sale · 18,000","channel":"WhatsApp"},{"label":"Fuel · 5,000","channel":"Web"},{"label":"Airtime · 1,000","channel":"Offline"}],
    },
    incomeExpense: {
      eyebrow: "Income and expense",
      title: "Every franc get category.",
      subtitle:
        "Simple entry when yu dey move fast. Proper accounting structure when yu wan close month.",
      cards: [
        {
          title: "Income wey keep source",
          body:
            "Record sale, invoice payment or other income against customer and revenue account.",
        },
        {
          title: "Expense wey explain itself",
          body:
            "Capture fuel, stock, rent, airtime, salary and more, with receipt or note attach.",
        },
        {
          title: "Correction without cover-up",
          body:
            "Void posted entry with mirrored reversal. Original dey visible and audit trail dey intact.",
        },
      ],
      imageAlt: "Mobile money agent dey serve customer inside small shop",
      caption: "Cash, mobile money, bank and card — one ledger.",
    },
    analysis: {
      eyebrow: "Financial analysis",
      title: "Turn list of transaction into one clear view.",
      subtitle:
        "KontaFlow group di detail so yu fit see margin, spending pressure and customer or category wey dey carry di business.",
      note: "Profit and loss, cash flow and category reports dey come from the same book.",
      cards: [
        {
          title: "Profit, no be only turnover",
          body: "Compare revenue with di cost behind am. Busy week fit still be thin week.",
        },
        {
          title: "Where money dey leak",
          body: "See biggest expense category and how dem dey move month by month.",
        },
        {
          title: "Who dey pay yu",
          body: "Understand which customer and product dey carry business — and which one dey quietly cost yu.",
        },
      ],
      chart: {
        kicker: "How expense divide",
        title: "Where di money go",
        sample: "Sample",
        period: "This month",
        categories: [
          { label: "Stock purchase", pct: 42 },
          { label: "Transport", pct: 24 },
          { label: "Rent and utility", pct: 18 },
          { label: "Airtime and data", pct: 9 },
          { label: "Other", pct: 7 },
        ],
        note: "Transport na di category wey dey grow pass. Check fuel and delivery cost before dem reduce your margin.",
      },
    },
    offline: {
      eyebrow: "Offline recording",
      title: "Make di queue move when network stop.",
      subtitle:
        "Market day, travel and light cut no dey stop business. KontaFlow make yu capture now and reconcile later.",
      bullets: [
        "Entry dey queue for device with original business date.",
        "App dey retry safe and no dey duplicate record.",
        "Yu fit see sync status, so nobody dey guess wetin send.",
      ],
      queued: "2 entry dey wait for dis device",
      synced: "All change don save",
      imageAlt: "Person dey hold mobile phone",
    },
    whatsapp: {
      eyebrow: "WhatsApp",
      title: "Di app yu dey use pass become bookkeeping channel.",
      subtitle:
        "Send plain message about sale or expense. KontaFlow read am, propose structured entry and reply wetin e understand.",
      chat: [
        { from: "them", text: "I sell 12 carton water for 18,000 FCFA." },
        { from: "us", text: "I record am as income — Sales. Customer save as “Walk-in”. Anything else?" },
        { from: "them", text: "I buy fuel 5,000." },
        { from: "us", text: "I record am as Transport expense. Fuel na 12% of your cost dis month." },
      ],
      bullets: [
        "No new app to install for di person wey dey send message.",
        "Amount, category and business date dey confirm before posting.",
        "E dey link to workspace with sender permission, no shared password.",
      ],
      note: "Example conversation with sample data. Real reply depend on your record and confirmation setting.",
      imageAlt: "Shopkeeper dey stand for small shop",
      businessLabel: "Business account",
      messagePlaceholder: "Message",
    },
    ussd: {
      eyebrow: "USSD",
      title: "Bookkeeping for di phone wey yu don get.",
      subtitle:
        "No smartphone, no data bundle, no problem. Short menu make yu record money and check day position.",
      screenTitle: "*384*12#",
      screenLines: ["1. Record sale", "2. Record expense", "3. Check balance", "4. Today total"],
      screenFooter: "Reply with number",
      bullets: [
        "E dey work for basic and keypad phone.",
        "E dey use same workspace and ledger like di web app.",
        "Session and usage limit dey protect account.",
      ],
      note: "Menu word and short code fit change by deployment and network.",
      imageAlt: "Keypad phone for person hand",
    },
    reports: {
      eyebrow: "Automatic report",
      title: "Month-end without digging old paper.",
      subtitle:
        "Generate report wey yu really use, from di same ledger wey yu dey record inside every day.",
      items: [
        "Profit and loss",
        "Cash flow",
        "Expense category",
        "Sale by customer or product",
        "CSV export for accountant",
        "Receipt and document reference",
      ],
      body:
        "Report dey respect workspace timezone and currency, and yu fit export am for lender, tax preparer or accountant.",
      imageAlt: "Close-up of laptop wey show financial chart beside printed report",
      packTitle: "Month-end pack",
      packLine: "Profit & loss · Cash flow · CSV",
    },
    intelligence: {
      eyebrow: "Business intelligence",
      title: "Di next question, already for view.",
      subtitle:
        "KontaFlow dey look for change wey need your attention and explain am for plain language.",
      insights: [
        { label: "Transport cost", value: "+18%", note: "Compared with last month" },
        { label: "Best margin", value: "Drinks", note: "For last 30 days" },
        { label: "Slow payer", value: "2 invoice", note: "Past due date" },
      ],
      bullets: [
        "Ask follow-up question for everyday language.",
        "See which figure support di answer.",
        "Turn insight into entry, reminder or report.",
      ],
      note: "Insight na decision support, no be audited advice. Check di record under am.",
    },
    subscription: {
      eyebrow: "Subscription",
      title: "Start free. Pay when business need more.",
      subtitle:
        "Every plan get core ledger and every recording channel. Paid plan add capacity for team and heavy use.",
      tiers: [
        {
          name: "Starter",
          price: "0",
          period: "FCFA",
          description: "For solo trader wey wan put book for order.",
          features: [
            "One workspace",
            "Unlimited transaction",
            "Web, WhatsApp, USSD and offline",
            "AI assistant allowance",
          ],
          cta: "Start free",
        },
        {
          name: "Growth",
          price: "9,900",
          period: "FCFA / month",
          description: "For shop or small team with daily volume.",
          features: [
            "More team seat and AI message",
            "Everything for Starter",
            "Accountant export",
            "Priority support",
          ],
          cta: "Talk to us",
          featured: true,
        },
        {
          name: "Scale",
          price: "29,900",
          period: "FCFA / month",
          description: "For bigger team and multi-branch operation.",
          features: [
            "Highest seat and AI allowance",
            "Everything for Growth",
            "Support for complex setup",
            "Priority support",
          ],
          cta: "Talk to us",
        },
      ],
      footnote:
        "Price dey in FCFA and dem dey bill monthly when paid billing dey arranged. Starter remain free. Tax fit apply.",
      includedTitle: "Every plan get",
      included: [
        "Di double-entry ledger",
        "Web, WhatsApp, USSD and offline capture",
        "Report and CSV export",
        "Email and phone verification",
      ],
    },
    faq: {
      eyebrow: "Question",
      title: "Straight answer before yu start.",
      subtitle: "Wetin business owner and dia accountant dey ask us pass.",
      items: [
        {
          question: "I need smartphone to use KontaFlow?",
          answer:
            "No. Web app get the full experience, but USSD make yu record entry and check balance from basic phone. WhatsApp need smartphone or WhatsApp desktop.",
        },
        {
          question: "Starter plan really free?",
          answer:
            "Yes. Starter cost 0 FCFA and get one workspace, unlimited transaction and every recording channel. Paid plan add capacity for team and heavy use.",
        },
        {
          question: "My accountant fit access di book?",
          answer:
            "Yes. Invite am with Accountant role. E go get di access e need without your password, and every action dey tie to e account.",
        },
        {
          question: "Wetin happen when I offline?",
          answer:
            "New entry dey save for your device with original business date. When connection come back, KontaFlow send am once and no duplicate.",
        },
        {
          question: "AI dey post entry without asking?",
          answer:
            "Entry wey no clear or unusual suppose get confirmation. Assistant propose amount, category and date; yu check before e enter ledger.",
        },
        {
          question: "Which currency and timezone dey supported?",
          answer:
            "XAF na default, with other currency and workspace timezone setting. Africa/Douala na default timezone.",
        },
        {
          question: "I fit run more than one business?",
          answer:
            "Architecture support plenty workspace per user. Your plan decide how many yu fit keep active.",
        },
        {
          question: "KontaFlow na bank or lender?",
          answer:
            "No. KontaFlow na bookkeeping and business-intelligence software. E no dey hold deposit, lend money or replace licensed accountant or tax adviser.",
        },
      ],
      viewAll: "Read all question",
    },
    finalCta: {
      title: "Give every decision better number behind am.",
      subtitle:
        "Set up workspace, record one real transaction and see how book feel when everything dey one place.",
      primary: "Start your free trial",
      secondary: "Talk to di team",
    },
  },
  about: {
    metaTitle: "About KontaFlow — bookkeeping for African business",
    metaDescription:
      "KontaFlow na multi-tenant bookkeeping and business-intelligence platform for small business for Cameroon and across Africa.",
    eyebrow: "About we",
    title: "We build am for business wey dey keep economy moving.",
    accent: "And make people understand am.",
    subtitle:
      "KontaFlow na bookkeeping software for owner, shopkeeper, trader and di accountant wey dey support dem. We design am around device, channel and constraint of real African business.",
    image: "/images/marketing/team-meeting.webp",
    imageAlt: "Two colleagues dey work together for table with laptop and speakerphone",
    imageCaption: "Photo for illustration, no be customer or testimonial.",
    introTitle: "Where we start",
    introBody:
      "Business fit dey busy every day and still no know whether e make profit. Di record dey — notebook, mobile money message, bank alert and memory — but dem no dey meet. KontaFlow dey make that meeting simple, trustworthy and useful.",
    sections: [
      {
        title: "Wetin we dey build",
        body:
          "One multi-tenant workspace where business fit record money for web, WhatsApp, USSD and offline. Behind di interface na double-entry ledger, permission system and report layer wey respect di same number.",
      },
      {
        title: "Four principle",
        cards: [
          {
            title: "Book before dashboard",
            body: "Chart good as di record under am. We build ledger first, then explain am.",
          },
          {
            title: "Di device for your pocket",
            body:
              "Basic phone and network wey dey come and go na normal, no be edge case. USSD, offline queue and light web app matter.",
          },
          {
            title: "Explain everything",
            body:
              "Number suppose trace back to di entry wey produce am. AI answer suppose point to real record.",
          },
          {
            title: "Your data na your own",
            body:
              "Tenant isolation dey enforced for database. Your book no be public training set for another product.",
          },
        ],
      },
      {
        title: "Wetin KontaFlow no be",
        body:
          "KontaFlow no be bank, lender, auditor or tax adviser. E no dey hold customer deposit. E dey give business clearer record and better question for professional adviser.",
      },
      {
        title: "Where we work",
        body:
          "We design di product for Douala, Cameroon, for business across di region. Interface dey for English, French and Cameroon Pidgin, with XAF as default and Africa/Douala as default timezone.",
      },
    ],
    cta: {
      title: "See whether di workspace fit your business.",
      body: "Start with free plan and one real transaction. No card needed.",
      primary: "Start free",
      secondary: "See di features",
    },
  },
  features: {
    metaTitle: "Features — KontaFlow bookkeeping and business intelligence",
    metaDescription:
      "Double-entry bookkeeping, multi-channel capture, offline sync, AI help, report and tenant-safe collaboration for one workspace.",
    eyebrow: "Features",
    title: "Everything yu need to keep clean book.",
    accent: "Nothing wey yu go fight.",
    subtitle:
      "One workspace to record, check and understand money. Every feature answer real constraint: small data, shared device, busy day and accountant wey need detail.",
    image: "/images/marketing/finance-reports.webp",
    imageAlt: "Hands dey type for laptop wey show financial chart and printed report",
    imageCaption: "Photo for illustration, no be customer.",
    introTitle: "Complete bookkeeping loop",
    introBody:
      "Capture transaction, keep supporting detail, reconcile balance, produce report and ask wetin change. KontaFlow keep every step inside di same ledger.",
    sections: [
      {
        title: "Core bookkeeping",
        cards: [
          {
            title: "Double-entry ledger",
            body:
              "Every posted transaction make balanced debit and credit line. Amount dey stored as integer minor unit, no floating point.",
          },
          {
            title: "History no dey change",
            body:
              "Posted entry dey freeze. Correction make mirrored reversal, so original and correction dey visible.",
          },
          {
            title: "Chart of accounts",
            body: "Default structure dey created with workspace, then yu fit adjust am for business.",
          },
          {
            title: "Receipt and document",
            body: "Attach supporting file for transaction inside private storage with short-lived link.",
          },
        ],
      },
      {
        title: "Every channel",
        cards: [
          {
            title: "Web and installable app",
            body: "Mobile-first interface with PWA install and offline fallback.",
          },
          {
            title: "WhatsApp message",
            body: "Send sale or expense for ordinary language and check proposed entry.",
          },
          {
            title: "USSD menu",
            body: "Record sale, expense or check balance from basic phone.",
          },
          {
            title: "Offline queue",
            body:
              "Capture now, sync later. Original business date and safe retry dey preserved.",
          },
        ],
      },
      {
        title: "Understand di business",
        cards: [
          {
            title: "Report",
            body: "Profit and loss, cash flow, expense category and CSV export for accountant and lender.",
          },
          {
            title: "AI assistant",
            body: "Ask question for everyday language and get answer from permitted workspace record.",
          },
          {
            title: "Business insight",
            body: "See change for cost, margin and customer activity before month-end.",
          },
          {
            title: "Audit trail",
            body: "Financial action dey record actor, action, entity and workspace.",
          },
        ],
      },
      {
        title: "Team and tenant safety",
        cards: [
          {
            title: "Role and permission",
            body: "Owner, administrator, accountant, manager and staff each get scoped view.",
          },
          {
            title: "Isolation for database",
            body:
              "PostgreSQL row-level security protect every tenant table. Browser no fit choose another workspace by changing ID.",
          },
          {
            title: "Verified access",
            body: "Email and phone verification, session revoke and security settings page.",
          },
          {
            title: "Private storage",
            body: "Workspace document and profile image dey inside private bucket with tenant policy.",
          },
        ],
      },
    ],
    cta: {
      title: "Try di loop with your own number.",
      body: "Free plan get core ledger and every recording channel.",
      primary: "Start free",
      secondary: "See how e dey work",
    },
  },
  services: {
    metaTitle: "Services — KontaFlow setup, channel and accountant collaboration",
    metaDescription:
      "Guided workspace setup, channel onboarding, accountant access and report support for business wey dey use KontaFlow.",
    eyebrow: "Services",
    title: "Software to run di book. Support to make am move.",
    accent: "Without big consultancy bill.",
    subtitle:
      "KontaFlow na product first. Around am, we dey help with setup, channel, team role and di report wey your accountant need.",
    image: "/images/marketing/small-business-owner.webp",
    imageAlt: "Small business owner dey stand for her market stall",
    imageCaption: "Photo for illustration, no be customer.",
    introTitle: "Choose di help wey yu need",
    introBody:
      "Plenty business fit start alone for minutes. If yu need hand with migration, role or report, di team fit help without taking over your book.",
    sections: [
      {
        title: "Wetin we fit help with",
        cards: [
          {
            title: "Workspace setup",
            body: "Business detail, currency, timezone, financial year and starting chart of accounts.",
          },
          {
            title: "Channel onboarding",
            body: "WhatsApp number, USSD menu explanation and offline workflow for daily use.",
          },
          {
            title: "Accountant access",
            body: "Invite your accountant with correct role and explain di export pack.",
          },
          {
            title: "Team role",
            body: "Choose di smallest access each person need for sale, purchase or review.",
          },
          {
            title: "Report review",
            body:
              "Help yu read profit, cash flow and category report before bank, lender or tax talk.",
          },
          {
            title: "Data migration",
            body: "Plan how customer, supplier and opening balance enter di workspace.",
          },
        ],
      },
      {
        title: "Wetin we no dey do",
        body:
          "We no dey do statutory audit, tax filing, legal advice or outsourced accounting. Your accountant remain responsible for professional conclusion; KontaFlow give dem cleaner record.",
      },
      {
        title: "Who e be for",
        cards: [
          {
            title: "Shop and trader",
            body: "Daily sale, stock purchase, mobile money and need to know wetin remain.",
          },
          {
            title: "Small service business",
            body: "Invoice, customer balance, transport and small team dey record from phone.",
          },
          {
            title: "Accountant and bookkeeper",
            body: "Client workspace with scoped access, clean export and ledger wey keep history.",
          },
        ],
      },
    ],
    cta: {
      title: "Tell us where your book dey today.",
      body: "Send short message about business, channel and wetin yu need to clean up.",
      primary: "Talk to us",
      secondary: "See pricing",
    },
  },
  how: {
    metaTitle: "How KontaFlow dey work — from first entry to month-end",
    metaDescription:
      "Set up workspace, record money from any channel, check ledger and turn am into report and decision.",
    eyebrow: "How e dey work",
    title: "From busy day to book wey yu fit trust.",
    accent: "For four clear step.",
    subtitle:
      "No long implementation. Start with one transaction, add channel wey yu really use and let ledger join everything.",
    image: "/images/marketing/working-laptop.webp",
    imageAlt: "Business owner dey enter transaction for laptop",
    imageCaption: "Photo for illustration, no be customer.",
    introTitle: "One loop, every day",
    introBody:
      "KontaFlow dey work for small moment: sale wey yu record between customer, expense wey yu confirm on road and quick check before next order.",
    steps: [
      {
        title: "Create workspace",
        body: "Name business, choose currency and timezone, confirm financial year.",
        detail:
          "KontaFlow set up chart of accounts, owner membership and seven-day trial on Starter.",
      },
      {
        title: "Record wetin move",
        body: "Use web form, WhatsApp, USSD or offline entry.",
        detail:
          "Amount, date, category and contact dey capture. Channel dey stamp on entry so yu see how e arrive.",
      },
      {
        title: "Check and reconcile",
        body: "Check entry, attach receipt and correct mistake properly.",
        detail:
          "Posted entry fit reverse, e no fit change for place. Every correction keep original and reason visible.",
      },
      {
        title: "Read, report and decide",
        body: "Open dashboard, generate report or ask assistant question.",
        detail:
          "Number come from same ledger. Export am for accountant, lender or your next decision.",
      },
    ],
    matrixTitle: "Which channel for which moment?",
    matrixSubtitle:
      "Channel dey complement each other. Use di one wey keep record moving without slowing business.",
    matrix: [
      { channel: "Web app", data: "Data or Wi-Fi", smartphone: "Browser", offline: "Yes, with sync" },
      { channel: "WhatsApp", data: "Data or Wi-Fi", smartphone: "Yes", offline: "No" },
      { channel: "USSD", data: "No data", smartphone: "No", offline: "Any phone" },
      { channel: "Offline PWA", data: "None until sync", smartphone: "Yes", offline: "Yes" },
    ],
    sections: [
      {
        title: "Wetin yu need day one",
        body:
          "Business name, currency, timezone and one real transaction. Yu fit add customer, supplier, team member and receipt as yu dey go.",
      },
      {
        title: "Wetin happen to transaction",
        cards: [
          {
            title: "Check",
            body: "Amount, date and category dey check before anything post.",
          },
          {
            title: "Post",
            body: "Entry become balanced ledger line inside integer minor unit.",
          },
          {
            title: "Show",
            body: "E appear for dashboard, report and audit trail for permitted user.",
          },
        ],
      },
      {
        title: "When yu ready for more",
        body:
          "Invite accountant, add second workspace for plan wey support am, or connect WhatsApp and USSD for rest of team.",
      },
    ],
    cta: {
      title: "Start with one real transaction.",
      body: "Quickest way to understand KontaFlow na to put one real sale inside.",
      primary: "Create your workspace",
      secondary: "Talk to di team",
    },
  },
  faq: {
    metaTitle: "FAQ — KontaFlow",
    metaDescription:
      "Answer about KontaFlow plan, channel, offline, security, AI, data and accountant access.",
    eyebrow: "FAQ",
    title: "Question, answer clear.",
    subtitle:
      "If something no dey here, send am to us. We prefer explain di limit than hide am.",
    image: "/images/marketing/office-focus.webp",
    imageAlt: "Professional dey check figures for phone and laptop",
    groups: [
      {
        title: "How to start",
        items: [
          {
            question: "Setup dey take how long?",
            answer:
              "Small minutes. Register, verify email and phone, then name business, choose currency and timezone. Default chart of accounts dey created.",
          },
          {
            question: "I need card to start?",
            answer:
              "No. Starter free and workspace start with seven-day trial. Paid plan dey arrange with team when yu need more capacity.",
          },
          {
            question: "I fit import old record?",
            answer:
              "Yu fit start with opening balance and add customer and supplier as yu go. For big migration, contact us to plan data and date well.",
          },
          {
            question: "E dey work for French and Pidgin?",
            answer:
              "Yes. Interface dey for English, French and Cameroon Pidgin, and AI assistant understand all three.",
          },
        ],
      },
      {
        title: "Channel and access",
        items: [
          {
            question: "USSD and WhatsApp need smartphone?",
            answer:
              "USSD dey work for basic phone without data. WhatsApp need smartphone or desktop app and internet.",
          },
          {
            question: "Wetin happen if internet fall?",
            answer:
              "Installable web app fit queue entry for device. Dem keep original business date and sync when connection come back.",
          },
          {
            question: "Plenty people fit use same workspace?",
            answer:
              "Yes. Invite owner, administrator, accountant, manager and staff with scoped role. Each person use own account.",
          },
          {
            question: "My accountant fit see everything?",
            answer:
              "Accountant role na for bookkeeping and report access. Check role description before invite and remove access when e no need again.",
          },
        ],
      },
      {
        title: "Money and record",
        items: [
          {
            question: "How amount dey store?",
            answer:
              "As integer minor unit with explicit currency, no floating point. That stop rounding drift wey make report disagree.",
          },
          {
            question: "I fit edit posted transaction?",
            answer:
              "No. Posted entry no dey change. Yu void am with mirrored reversal, so both side of story dey visible.",
          },
          {
            question: "Which report I fit generate?",
            answer:
              "Profit and loss, cash flow, expense category, sale by customer or product, and CSV export. Document reference dey with record.",
          },
          {
            question: "I fit export my data?",
            answer:
              "Yes. Report and transaction fit export. Yu fit ask us for copy of account data, subject to legal retention.",
          },
        ],
      },
      {
        title: "Security, AI and privacy",
        items: [
          {
            question: "My data separate from other business?",
            answer:
              "Yes. Every tenant record get workspace reference, and PostgreSQL row-level security enforce boundary for database, not only interface.",
          },
          {
            question: "AI dey train on my book?",
            answer:
              "Assistant dey answer from your permitted record. We no dey use workspace data as public training set. Check Privacy Policy for processor.",
          },
          {
            question: "AI fit make mistake?",
            answer:
              "Yes. Language model fit misread amount, category or date. KontaFlow show proposed entry; yu remain responsible for wetin post.",
          },
          {
            question: "Where I fit report security problem?",
            answer:
              "Email security@kontaflow.com with enough detail. No access another person data or disturb service while testing.",
          },
        ],
      },
    ],
    cta: {
      title: "Still get question?",
      body: "Send am to human. We dey reply within one business day.",
      primary: "Contact us",
      secondary: "Read security page",
    },
  },
  blog: {
    metaTitle: "Resources — practical bookkeeping for small business",
    metaDescription:
      "Short practical guide on bookkeeping, cash flow, mobile money and financial decision for African small business.",
    eyebrow: "Resources",
    title: "Practical note for better book.",
    subtitle:
      "No jargon, no corporate slide. Short guide for owner and accountant wey dey work with real constraint.",
    imageAlt: "Market traders dey arrange plantain and produce",
    imageCaption: "Photo for illustration, no be customer.",
    featuredLabel: "Featured",
    readArticle: "Read article",
    allArticles: "All article",
    minRead: "min read",
    articles: [
      {
        slug: "separate-business-and-personal-money",
        title: "How to separate business and personal money without finance team",
        description:
          "Practical start for owner wey dey pay business cost from same wallet or mobile money account.",
        category: "Bookkeeping basics",
        publishedAt: "2026-11-12",
        readingMinutes: 5,
        image: "/images/marketing/mobile-money.webp",
        imageAlt: "Mobile money agent inside small shop",
        intro:
          "If business and personal money share one wallet, every report become guess. Yu no need finance department to fix am. Yu need one rule, small separation and habit wey go survive busy week.",
        sections: [
          {
            heading: "Start with one clear boundary",
            paragraphs: [
              "Choose one account, mobile money wallet or cash box for business receipt and payment. E no need be business bank account day one, but e must be di place where business money dey enter and leave.",
              "If customer pay inside your personal wallet, move di amount to business wallet same day and record both step. Di transfer no be income; na movement between your own pocket.",
            ],
          },
          {
            heading: "Record owner money separate",
            paragraphs: [
              "Money wey yu take for personal use no be business expense. Treat am as owner drawing. Money wey yu put inside na owner contribution. Keep di two label clear so personal spending no dey reduce profit quietly.",
            ],
            bullets: [
              "Owner contribution: personal money wey enter business.",
              "Owner drawing: business money wey yu take for personal use.",
              "Business expense: cost wey yu incur to make revenue.",
            ],
          },
          {
            heading: "Make di rule easy",
            paragraphs: [
              "Put business wallet inside different colour case. Name am clear. Tell di people wey dey receive money where to send am. Rule wey need argument for counter no go survive.",
              "Every week, compare wallet balance with recorded transaction. If dem differ, find di missing entry before difference become normal.",
            ],
          },
          {
            heading: "If e don already mix",
            paragraphs: [
              "No try reconstruct every personal purchase. Start from clear opening position today, record business asset and liability wey yu fit identify, and treat mixed history as migration problem, no be daily habit.",
              "Your accountant fit help yu decide opening balance. Important part na to stop adding new noise to old record.",
            ],
          },
        ],
        takeaway:
          "Separation no mean plenty account. E mean yu fit answer, without guess, whether payment belong to business.",
      },
      {
        slug: "weekly-bookkeeping-routine",
        title: "20-minute weekly bookkeeping routine for busy shop",
        description:
          "Repeatable routine to catch missing sale, check expense and close week before month-end panic.",
        category: "Routine",
        publishedAt: "2026-10-29",
        readingMinutes: 6,
        image: "/images/marketing/market-vendors.webp",
        imageAlt: "Market vendor dey arrange produce for stall",
        intro:
          "Month-end panic na usually week-end problem wey dem postpone four time. Short regular routine better pass perfect spreadsheet wey yu open once a quarter.",
        sections: [
          {
            heading: "Pick quiet 20 minutes",
            paragraphs: [
              "Choose same slot every week, better when shop quiet and day cash don count. Put am for calendar as real appointment. Routine only work if e boring enough to repeat.",
            ],
          },
          {
            heading: "1. Match cash and mobile money",
            paragraphs: [
              "Count cash box and check mobile money balance. Compare both with week record. Write every difference, even small one. Missing 2,000 FCFA entry easy to find now pass next month.",
            ],
          },
          {
            heading: "2. Fill di gap",
            paragraphs: [
              "Add sale wey only dey for memory, supplier payment wey still dey pocket receipt, and transfer between account. Use original business date, no be today date.",
            ],
            bullets: [
              "Check phone for mobile money message wey yu no record.",
              "Check cash box for receipt and IOU.",
              "Ask di person wey handle counter about anything wey no explain.",
            ],
          },
          {
            heading: "3. Check three number",
            paragraphs: [
              "Look income, expense and cash on hand for di week. No try analyse everything. Ask one question: dis one match wetin I see for business?",
              "If number look wrong, trace am to entry before yu change report. Report na only view of ledger.",
            ],
          },
          {
            heading: "4. Write next action",
            paragraphs: [
              "Finish with one concrete task for next week: chase customer balance, correct category, attach missing receipt or ask accountant about treatment. One task enough.",
            ],
          },
        ],
        takeaway: "Goal no be perfect week. Na week wey yu fit explain, close and build on.",
      },
      {
        slug: "read-cash-flow-before-profit",
        title: "Why cash flow fit feel worse even when profit look fine",
        description:
          "Plain-language look at difference between profit and cash, and three question to ask when money tight.",
        category: "Financial analysis",
        publishedAt: "2026-10-08",
        readingMinutes: 7,
        image: "/images/marketing/finance-reports.webp",
        imageAlt: "Close-up of laptop wey show financial chart beside printed report",
        intro:
          "Business fit record profit and still miss salary. That no be contradiction; na timing problem. Understanding gap between profit and cash na one of di most useful financial habit owner fit build.",
        sections: [
          {
            heading: "Profit na period. Cash na moment.",
            paragraphs: [
              "Profit compare revenue with cost wey yu incur to make am over period. Cash flow track when money really arrive and leave. Invoice wey dem pay next month fit be profit today and unavailable cash tomorrow.",
            ],
          },
          {
            heading: "Three question for tight week",
            paragraphs: [
              "Before yu borrow or cut cost, separate problem from symptom.",
            ],
            bullets: [
              "Who owe us money, and when dem promise to pay?",
              "Wetin must leave business for next seven days, and wetin fit wait?",
              "Which sale don earn but dem no collect yet?",
            ],
          },
          {
            heading: "Look pattern, no be one day",
            paragraphs: [
              "One slow Friday na noise. Gap wey dey widen between sale and collection over weeks na pattern. Compare same week across month and look age of unpaid customer balance.",
              "If stock dey swallow cash, check whether stock dey sell. If e no dey sell, balance sheet fit look busy while bank account dey thin.",
            ],
          },
          {
            heading: "Make forecast simple",
            paragraphs: [
              "Useful cash forecast no need hundred row. Start with opening balance, expected collection, committed payment and buffer for surprise. Update am every week with real number instead of rebuild from scratch.",
              "When forecast show shortfall, act early: call customer, negotiate supplier date or delay non-urgent purchase. Earlier yu see am, more option yu get.",
            ],
          },
        ],
        takeaway:
          "Profit tell yu whether business dey earn. Cash tell yu whether e fit continue. Yu need both, side by side.",
      },
    ],
  },
  contact: {
    metaTitle: "Contact KontaFlow",
    metaDescription:
      "Ask about price, setup, migration, accountant access or demo. Reach KontaFlow team by email or contact form.",
    eyebrow: "Contact",
    title: "Talk to di team behind KontaFlow.",
    subtitle:
      "Question about price, setup, moving your book or working with accountant? Send message and human go reply.",
    image: "/images/marketing/pricing-entrepreneur.webp",
    imageAlt: "Business owner dey record sales on laptop and phone",
    nextTitle: "Wetin go happen next",
    nextSteps: [
      "We read your message and check whether we fit help direct.",
      "If e need, we ask one or two clarifying question.",
      "Yu get reply within one business day, Monday to Friday.",
    ],
    email: "hello@kontaflow.com",
    privacyEmail: "privacy@kontaflow.com",
    location: "Douala, Cameroon",
    hours: "Monday–Friday · 8:00–18:00 WAT",
  },
  legal: legalWes,
  photoCredits: {
    title: "Photo credits",
    intro:
      "Di site dey use real photo, including CC0 image from Nappy.co, under Creative Commons or similar licence. We crop, resize and convert dem to WebP. People for photo na illustration; dem no be customer, employee or endorser unless we talk am clear.",
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
