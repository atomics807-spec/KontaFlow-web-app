import type { LegalDoc } from "./types";

export const legalPcm: LegalDoc[] = [
  {
    slug: "terms",
    title: "Rules wey yu dey follow",
    description: "How yu fit use KontaFlow, wetin na your work and wetin di service fit do.",
    updated: "E start 1 January 2026",
    updatedAt: "2026-01-01",
    intro:
      "Dis rules dey control how yu use KontaFlow. If yu open account or use di service, yu agree wit dem. If yu no agree, no use di service.",
    sections: [
      {
        heading: "1. Wetin KontaFlow be",
        paragraphs: [
          "KontaFlow na bookkeeping and business-intelligence software. E no be bank, lender, auditor, tax adviser or licensed accountant. E no dey hold deposit and e no dey give financial advice.",
          "Some part dey depend on email, SMS, WhatsApp, USSD, hosting and AI providers. Availability fit change by country, network and deployment.",
        ],
      },
      {
        heading: "2. Account and permission",
        paragraphs: [
          "Yu must be 18 or older and fit enter contract. Give correct registration details and keep your contact information current.",
          "Yu dey responsible for wetin happen under your account and for keeping your password safe. Tell us quick if yu think say somebody enter your account. No share one login with plenty people; invite dem with their own role.",
        ],
      },
      {
        heading: "3. Your workspace and data",
        paragraphs: [
          "Na yu own di business records wey yu put inside KontaFlow. Yu give us permission to host, process and show dem only to run di service, secure am and follow law.",
          "Yu dey responsible for di correctness and legality of your records, for having right to upload dem, and for checking entries before posting. Keep your own copy of documents wey law require.",
        ],
      },
      {
        heading: "4. Plans and payment",
        paragraphs: [
          "Starter na 14-day trial wey cost nothing. When e end, di workspace go read-only until yu choose paid plan. Paid plans get di price wey dey di pricing page and we arrange dem with yu.",
          "Price dey in FCFA and tax fit apply. We go explain di amount and billing period before we turn on paid plan. Cancellation and refund dey inside di Refund and Cancellation Policy.",
        ],
      },
      {
        heading: "5. AI",
        paragraphs: [
          "Di AI fit misunderstand language, amount, date or category. E fit give answer wey look correct but e no correct. Yu must check proposed entries and important figures before yu trust dem.",
          "AI na decision support, no be professional advice. E no replace your accountant, tax adviser, auditor or lender.",
        ],
      },
      {
        heading: "6. Availability and responsibility",
        paragraphs: [
          "We dey work to keep di service up and safe, but we no promise say e go work every time without error. Maintenance, network problem and third-party outage fit block access.",
          "As law allow, we no dey responsible for indirect loss, lost profit or lost data if yu no keep backup. Nothing here remove rights wey law no allow us to remove.",
        ],
      },
      {
        heading: "7. Stop access and contact",
        paragraphs: [
          "We fit suspend or stop access if yu break di rules, use di service for illegal thing, no pay or cause security risk. If e make sense, we go give notice and chance to export data.",
          "Yu fit stop using di service anytime. Contact info@kontaflow.com for general questions, privacy@kontaflow.com for privacy and security@kontaflow.com for security.",
        ],
      },
    ],
  },
  {
    slug: "privacy",
    title: "How we handle your data",
    description: "Wetin personal data KontaFlow dey collect, why, how long we keep am and wetin yu fit choose.",
    updated: "E start 1 January 2026 · version 2026-01-01",
    updatedAt: "2026-01-01",
    intro:
      "Dis policy explain how KontaFlow dey handle personal data for web app, USSD, WhatsApp and AI assistant. E cover account holders, workspace members and people wey contact us.",
    sections: [
      {
        heading: "1. Who dey responsible",
        paragraphs: [
          "For account, billing and website data, KontaFlow na di controller. For business records wey workspace upload, di business na controller and KontaFlow na processor wey dey follow dia instruction.",
          "Contact privacy@kontaflow.com for privacy request.",
        ],
      },
      {
        heading: "2. Data wey we collect",
        paragraphs: [
          "We collect name, email, phone, country, language, login data, business profile, transactions, customers, suppliers, documents, messages to di assistant, channel IDs, security logs and consent records.",
          "Phone verification code dey stored only as keyed hash, not plain text. Payment details, if paid plan dey arranged, dey handled by di payment provider.",
        ],
      },
      {
        heading: "3. Why we use am",
        paragraphs: [
          "We use data to run and secure di service, keep books, make reports, run di AI assistant, talk to yu about account, stop abuse, follow law and improve di product.",
          "Depending on di situation, we rely on contract, law, vital or public interest, or our legitimate interest to run safe service. Marketing consent dey separate and optional.",
        ],
      },
      {
        heading: "4. Who we share with",
        paragraphs: [
          "We no dey sell personal data. We share only wetin necessary with providers for hosting, database, email, SMS and USSD, WhatsApp, AI, security and support.",
          "Processors must keep data confidential and protect am. We fit disclose data if law require, to protect rights or safety, or in real business transfer with safeguard.",
        ],
      },
      {
        heading: "5. Transfer outside Cameroon",
        paragraphs: [
          "Some provider fit process data outside Cameroon. Where law require, we use contractual and organisational safeguard. Yu fit ask us about di safeguard for your data.",
        ],
      },
      {
        heading: "6. How long we keep am",
        paragraphs: [
          "We keep account data while account dey active and reasonable time after. Financial records fit stay for di time wey accounting, tax, anti-fraud and dispute rules require.",
          "Verification code expire after ten minutes. Security logs stay only as long as needed. When we no need data again, we delete or anonymise am.",
        ],
      },
      {
        heading: "7. Your rights",
        paragraphs: [
          "Yu fit access, correct, export or delete personal data, remove marketing consent, object to some processing and ask for restriction. Law or other people rights fit limit some request.",
          "Send request to privacy@kontaflow.com. We fit need to verify your identity. If yu be workspace member, contact di business first; we go assist dem as processor.",
        ],
      },
      {
        heading: "8. Security and children",
        paragraphs: [
          "We use tenant isolation, roles, encryption in transit, hashed codes, audit logs and least privilege. No system perfect, so use strong unique password and report problem to security@kontaflow.com.",
          "Di service na for business and no be for children. No open account for child. We go tell yu before material change to dis policy.",
        ],
      },
    ],
  },
  {
    slug: "cookies",
    title: "Cookie Policy",
    description: "Cookies and local storage wey KontaFlow dey use, why and how yu fit control dem.",
    updated: "E start 1 January 2026",
    updatedAt: "2026-01-01",
    intro:
      "Cookie and similar storage dey help di service remember your session, language and preference. Dis policy show wetin we use today.",
    sections: [
      {
        heading: "1. Wetin cookie be",
        paragraphs: [
          "Cookie na small file wey your browser dey keep. Local storage na similar browser feature wey keep preference for your device. Dem no be program wey dey run by itself.",
        ],
      },
      {
        heading: "2. Essential cookies",
        paragraphs: [
          "KontaFlow dey use essential cookie for login and security. Supabase session cookie dey keep yu signed in and protect request. If yu block am, dashboard no go work.",
          "We still dey use locale cookie for language and workspace cookie for selected business. Block dem fit break login, language or workspace switching.",
        ],
      },
      {
        heading: "3. Preference and offline files",
        paragraphs: [
          "Your light, dark or system theme dey stored inside your browser. Di installable app fit cache file so e fit open offline.",
        ],
      },
      {
        heading: "4. Analytics and advertising",
        paragraphs: [
          "Di product today no dey use advertising cookie or third-party behavioural tracking. If we add analytics wey need consent, we go update dis policy and ask before we set non-essential cookie.",
        ],
      },
      {
        heading: "5. How to control am",
        paragraphs: [
          "Yu fit delete or block cookie inside browser settings. If yu block essential cookie, yu fit be signed out or no fit use dashboard. Questions: privacy@kontaflow.com.",
        ],
      },
    ],
  },
  {
    slug: "data-processing",
    title: "How we process business data",
    description: "How KontaFlow dey process workspace data, security, subprocessors and incident response.",
    updated: "E start 1 January 2026",
    updatedAt: "2026-01-01",
    intro:
      "Dis page summarise di processing relationship when business use KontaFlow to keep books. E dey for workspace owners, accountants and procurement teams.",
    sections: [
      {
        heading: "1. Roles",
        paragraphs: [
          "Di business wey own workspace dey decide wetin data go inside and why. Na dem be controller. KontaFlow na processor and dey act on documented instruction to run di service.",
          "For account, website and billing data, KontaFlow na controller as di Privacy Policy talk.",
        ],
      },
      {
        heading: "2. Wetin we process",
        paragraphs: [
          "We process business records, contact details, transactions, uploaded documents, channel messages and usage logs to run bookkeeping, reports, AI, security and support. We no dey use workspace records for public model training.",
        ],
      },
      {
        heading: "3. Security",
        paragraphs: [
          "We use PostgreSQL row-level security for tenant isolation, scoped roles, server-side authorisation, private storage, encryption in transit, hashed codes, audit logs, rate limits and least-privilege access.",
          "No security programme fit remove every risk. Owners must use strong unique login, review team access and keep own copy of important documents.",
        ],
      },
      {
        heading: "4. Subprocessors",
        paragraphs: [
          "We rely on Supabase for hosting and database, Vercel and Cloudflare for deployment and edge delivery, Resend for email, Africa's Talking for SMS and USSD, Meta and approved providers for WhatsApp, and OpenAI for AI.",
          "Di provider wey dey active fit change by deployment. We require confidentiality and data-protection commitment and go communicate material change.",
        ],
      },
      {
        heading: "5. Incident and data request",
        paragraphs: [
          "If we know about personal-data breach wey affect workspace, we go tell di owner without undue delay and give information wey dem need. We go investigate, contain and document am.",
          "We get feature and support to help workspace answer access, correction, export and deletion request. Owner fit export records before access end, subject to lawful retention. Signed data-processing agreement: privacy@kontaflow.com.",
        ],
      },
    ],
  },
  {
    slug: "refunds",
    title: "Refund and cancellation",
    description: "How trial, paid plan, cancellation and refund dey work for KontaFlow.",
    updated: "E start 1 January 2026",
    updatedAt: "2026-01-01",
    intro:
      "Dis policy explain wetin happen when yu stop plan, change plan or think say charge no correct. E no reduce your consumer rights under law.",
    sections: [
      {
        heading: "1. Starter trial",
        paragraphs: [
          "Starter na 14-day trial for 0 FCFA. Yu no need pay to start and trial no go automatically charge card. When di trial end, di workspace go read-only until we turn on paid plan.",
        ],
      },
      {
        heading: "2. Paid plans",
        paragraphs: [
          "Growth and Scale na monthly plan in FCFA. Before we turn on paid plan, we confirm di plan, price, currency, billing period and tax with yu.",
          "Paid plan dey arranged with di team while online billing dey roll out. We no go charge yu through di product without that confirmation.",
        ],
      },
      {
        heading: "3. Cancellation",
        paragraphs: [
          "Yu fit ask to cancel paid plan anytime by email to info@kontaflow.com. Unless we agree otherwise, cancellation stop di next billing period and yu keep access until di period wey yu don pay finish.",
          "Cancellation no delete workspace automatic. Yu fit export records and ask for deletion under di Privacy Policy.",
        ],
      },
      {
        heading: "4. Refund",
        paragraphs: [
          "If we charge yu twice, charge wrong amount, or charge after confirmed cancellation, contact us and we go check and correct real error.",
          "Change-of-mind refund for period wey yu don use go dey case by case and no be guarantee. If consumer law give yu stronger right, that right apply.",
        ],
      },
      {
        heading: "5. How to ask for help",
        paragraphs: [
          "Email info@kontaflow.com with workspace name, charge date, amount and reason. No send full card number or password. We go confirm next step and timeline after we check.",
        ],
      },
    ],
  },
  {
    slug: "acceptable-use",
    title: "Acceptable use",
    description: "Rules wey keep KontaFlow safe for business, team and data.",
    updated: "E start 1 January 2026",
    updatedAt: "2026-01-01",
    intro:
      "KontaFlow dey handle financial records and personal data. Dis policy set di minimum standard. E apply to every workspace member and anybody wey dey act for dem.",
    sections: [
      {
        heading: "1. Use am legal",
        paragraphs: [
          "No use KontaFlow for fraud, theft, money laundering, terrorist financing, sanctions evasion, bribery or any illegal activity. No use am to hide where money come from or who own am.",
        ],
      },
      {
        heading: "2. Protect di record",
        paragraphs: [
          "No create false transaction, change date to deceive, delete audit evidence or use another person identity. Correction must follow di reversal process, no be rewrite history.",
          "No upload malware, bypass access control, probe another workspace, scrape di service, overload am or interfere with security.",
        ],
      },
      {
        heading: "3. Respect people and data",
        paragraphs: [
          "Only upload personal data wey yu get right to use. Respect privacy, confidentiality and intellectual property. No use contact details for spam or illegal marketing.",
        ],
      },
      {
        heading: "4. Channel and AI rules",
        paragraphs: [
          "For WhatsApp, SMS, USSD or email, follow provider policy and local law. No send illegal, harassing or deceptive message and no impersonate person or business.",
          "No use di AI to make illegal content, attempt prompt injection, extract another tenant data or bypass permission. Check AI output before yu post am.",
        ],
      },
      {
        heading: "5. Enforcement and reporting",
        paragraphs: [
          "We fit investigate abuse, limit access or suspend workspace to protect users, service or public. Serious case fit go to authority.",
          "Report abuse or security problem to security@kontaflow.com. No access data wey no be your own.",
        ],
      },
    ],
  },
];
