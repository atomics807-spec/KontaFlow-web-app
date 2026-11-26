import type { LegalDoc } from "./types";

export const legalEn: LegalDoc[] = [
  {
    slug: "terms",
    title: "Terms of Service",
    description: "The rules for using KontaFlow, your responsibilities and the limits of the service.",
    updated: "Effective 1 January 2026",
    intro:
      "These terms govern your use of KontaFlow. By creating an account or using the service, you agree to them. If you do not agree, do not use the service.",
    sections: [
      {
        heading: "1. The service",
        paragraphs: [
          "KontaFlow is bookkeeping and business-intelligence software for businesses. It is not a bank, lender, auditor, tax adviser or licensed accounting firm. It does not hold deposits or provide financial advice.",
          "Some features depend on third-party channels and providers, including email, SMS, WhatsApp, USSD, hosting and AI. Availability can vary by country, network and deployment.",
        ],
      },
      {
        heading: "2. Accounts and authority",
        paragraphs: [
          "You must be at least 18 years old and able to enter a binding contract. Provide accurate registration details and keep your contact information current.",
          "You are responsible for activity under your account and for keeping your credentials secure. Tell us promptly if you believe your account has been compromised. Do not share a single login between several people; invite them with their own roles.",
        ],
      },
      {
        heading: "3. Your workspace and data",
        paragraphs: [
          "You own the business records you put into KontaFlow. You give us permission to host, process and display them only as needed to provide the service, secure it and comply with the law.",
          "You are responsible for the accuracy and legality of your records, for having the right to upload them, and for reviewing entries before they are posted. Keep your own copies of documents that are legally required.",
        ],
      },
      {
        heading: "4. Acceptable use",
        paragraphs: [
          "You must use KontaFlow lawfully and respect other people's data and the integrity of the service. The Acceptable Use Policy forms part of these terms.",
        ],
      },
      {
        heading: "5. Plans, trials and payment",
        paragraphs: [
          "The Starter plan is free. New workspaces begin with a seven-day trial. Paid plans have the prices shown on the pricing page and are arranged with the team.",
          "Prices are stated in FCFA and may be subject to taxes. We will explain the amount and billing period before a paid plan is activated. Cancellation and refunds are described in the Refund and Cancellation Policy.",
        ],
      },
      {
        heading: "6. AI assistance",
        paragraphs: [
          "The AI assistant can misunderstand language, amounts, dates or categories. It can produce an answer that is plausible but wrong. You must review proposed entries and verify important figures before relying on them.",
          "AI output is decision support, not professional advice. It does not replace your accountant, tax adviser, auditor or lender.",
        ],
      },
      {
        heading: "7. Availability and liability",
        paragraphs: [
          "We work to keep the service available and secure, but we do not promise uninterrupted or error-free operation. Maintenance, network failures and third-party outages can affect access.",
          "To the extent permitted by law, we are not liable for indirect or consequential loss, lost profit or lost data caused by your failure to keep backups. Nothing in these terms limits rights that cannot be limited by law.",
        ],
      },
      {
        heading: "8. Suspension, termination and changes",
        paragraphs: [
          "We may suspend or terminate access for a serious breach, unlawful use, non-payment or a security risk. Where reasonable, we will give notice and a chance to export data.",
          "You may stop using the service at any time. We may update these terms; material changes will be communicated before they take effect. Continued use after the effective date means you accept the updated terms.",
        ],
      },
      {
        heading: "9. Contact",
        paragraphs: [
          "Questions about these terms: hello@kontaflow.com. Privacy questions: privacy@kontaflow.com. Security reports: security@kontaflow.com.",
        ],
      },
    ],
  },
  {
    slug: "privacy",
    title: "Privacy Policy",
    description: "What personal data KontaFlow collects, why, how long it is kept and the choices you have.",
    updated: "Effective 1 January 2026 · version 2026-01-01",
    intro:
      "This policy explains how KontaFlow handles personal data across the web app, USSD, WhatsApp and the AI assistant. It applies to account holders, workspace members and people who contact us.",
    sections: [
      {
        heading: "1. Who is responsible",
        paragraphs: [
          "For account, billing and website data, KontaFlow acts as the data controller. For business records uploaded by a workspace, the business is the controller and KontaFlow acts as a processor on its instructions.",
          "Contact privacy@kontaflow.com for privacy requests or questions about this policy.",
        ],
      },
      {
        heading: "2. Data we collect",
        paragraphs: [
          "We collect identity and contact details (name, email, phone, country, preferred language), authentication data, business profile details, transactions, customers, suppliers, documents, messages sent to the assistant, channel identifiers, device and security logs, and consent records.",
          "Phone verification codes are stored only as a keyed hash. We do not store the plain code. Payment details, where a paid plan is arranged, are handled by the payment provider rather than stored in the bookkeeping database.",
        ],
      },
      {
        heading: "3. Why we use it",
        paragraphs: [
          "We use data to provide and secure the service, keep the books, produce reports, operate the AI assistant, communicate about the account, prevent abuse, meet legal obligations and improve the product.",
          "Depending on the context, processing is based on performing our contract, complying with law, protecting vital or public interests, or our legitimate interest in running a secure service. Marketing consent is separate and optional.",
        ],
      },
      {
        heading: "4. Sharing and processors",
        paragraphs: [
          "We do not sell personal data. We share only what is needed with providers that support the service, including hosting and database infrastructure, email delivery, SMS and USSD, WhatsApp messaging, AI processing, security and support tools.",
          "Processors are bound by confidentiality and data-protection obligations. We may disclose data if required by law, to protect rights or safety, or as part of a genuine business transfer with appropriate safeguards.",
        ],
      },
      {
        heading: "5. International transfers",
        paragraphs: [
          "Some providers process data outside Cameroon. Where required, we use contractual and organisational safeguards for those transfers. You can ask us for more information about the safeguards relevant to your data.",
        ],
      },
      {
        heading: "6. Retention",
        paragraphs: [
          "We keep account data while the account is active and for a reasonable period afterwards. Financial records may be kept for the period required by accounting, tax, anti-fraud and dispute rules.",
          "Verification codes expire after ten minutes. Security logs are kept only as long as needed to investigate abuse and maintain the service. When data is no longer needed, we delete or anonymise it.",
        ],
      },
      {
        heading: "7. Your choices and rights",
        paragraphs: [
          "You can access, correct, export or delete personal data, withdraw marketing consent, object to certain processing and ask for a restriction. Some rights are limited by legal retention or the rights of other people.",
          "Send requests to privacy@kontaflow.com. We may need to verify your identity. If you are a workspace member, contact the business that owns the workspace first; we will assist it as processor.",
        ],
      },
      {
        heading: "8. Security",
        paragraphs: [
          "We use tenant isolation, role-based access, encryption in transit, hashed verification codes, audit records and least-privilege access. No system is perfectly secure, so use a strong unique password and report suspected issues to security@kontaflow.com.",
        ],
      },
      {
        heading: "9. Children and changes",
        paragraphs: [
          "The service is for businesses and is not directed to children. Do not create an account for a child.",
          "We may update this policy as the product changes. Material changes will be communicated before they take effect. The version date at the top identifies the current policy.",
        ],
      },
    ],
  },
  {
    slug: "cookies",
    title: "Cookie Policy",
    description: "The cookies and local storage KontaFlow uses, why they are needed and how to control them.",
    updated: "Effective 1 January 2026",
    intro:
      "Cookies and similar storage help the service remember your session, language and preferences. This policy explains what we use today.",
    sections: [
      {
        heading: "1. What cookies are",
        paragraphs: [
          "A cookie is a small file stored by your browser. Local storage is a similar browser feature that can keep preferences on your device. Neither is a program that runs on its own.",
        ],
      },
      {
        heading: "2. Essential cookies",
        paragraphs: [
          "KontaFlow uses essential cookies for authentication and security. The Supabase session cookie keeps you signed in and protects requests. Without it, the dashboard cannot function.",
          "We also use a locale cookie to remember your language choice and a workspace cookie to remember the selected business. Blocking these cookies can break sign-in, language selection or workspace switching.",
        ],
      },
      {
        heading: "3. Preference storage",
        paragraphs: [
          "Your light, dark or system theme choice is stored in your browser, not sent to other people. The installable app may cache files on your device so it can open offline.",
        ],
      },
      {
        heading: "4. Analytics and advertising",
        paragraphs: [
          "The current product does not use advertising cookies or third-party behavioural tracking. If we add analytics that requires consent, we will update this policy and ask before setting non-essential cookies.",
        ],
      },
      {
        heading: "5. Managing cookies",
        paragraphs: [
          "You can delete or block cookies in your browser settings. If you block essential cookies, you may be signed out or unable to use the dashboard. Browser controls vary, so use the help page for your browser.",
          "Questions about this policy: privacy@kontaflow.com.",
        ],
      },
    ],
  },
  {
    slug: "data-processing",
    title: "Data Processing Information",
    description:
      "How KontaFlow processes business data on behalf of a workspace, including security, subprocessors and breach response.",
    updated: "Effective 1 January 2026",
    intro:
      "This page summarises the processing relationship when a business uses KontaFlow to keep its books. It is written for workspace owners, accountants and procurement teams.",
    sections: [
      {
        heading: "1. Roles",
        paragraphs: [
          "The business that owns a workspace decides what data goes in and why. It is the controller for that data. KontaFlow is the processor and acts on documented instructions to provide the service.",
          "For account, website and billing data, KontaFlow acts as controller as described in the Privacy Policy.",
        ],
      },
      {
        heading: "2. Processing scope",
        paragraphs: [
          "We process business records, contact details, transaction data, uploaded documents, channel messages and usage logs to provide bookkeeping, reporting, AI assistance, security and support. We do not use workspace records for public model training.",
        ],
      },
      {
        heading: "3. Security measures",
        paragraphs: [
          "Measures include tenant isolation with PostgreSQL row-level security, scoped roles, server-side authorisation, private storage, encryption in transit, hashed verification codes, audit records, rate limits and least-privilege operational access.",
          "No security programme eliminates every risk. Workspace owners should use strong unique credentials, review team access and keep their own copies of legally important documents.",
        ],
      },
      {
        heading: "4. Subprocessors",
        paragraphs: [
          "The service relies on providers for hosting and database infrastructure (Supabase), deployment and edge delivery (Vercel and Cloudflare), email (Resend), SMS and USSD (Africa's Talking), WhatsApp messaging (Meta and its approved providers), and AI processing (OpenAI).",
          "The exact providers enabled can vary by deployment. We require appropriate confidentiality and data-protection commitments and will communicate material changes that affect how business data is processed.",
        ],
      },
      {
        heading: "5. Breach response",
        paragraphs: [
          "If we become aware of a personal-data breach affecting a workspace, we will notify the workspace owner without undue delay and provide the information reasonably needed to meet its own obligations. We will investigate, contain and document the incident.",
        ],
      },
      {
        heading: "6. Assistance, export and deletion",
        paragraphs: [
          "We provide features and support to help a workspace respond to access, correction, export and deletion requests. On termination, the owner can export records before access ends, subject to lawful retention requirements.",
          "A signed data-processing agreement with additional terms can be requested from privacy@kontaflow.com.",
        ],
      },
    ],
  },
  {
    slug: "refunds",
    title: "Refund and Cancellation Policy",
    description: "How trial, paid plans, cancellation and refund requests work at KontaFlow.",
    updated: "Effective 1 January 2026",
    intro:
      "This policy explains what happens when you stop a plan, change a plan or believe a charge is wrong. It does not reduce rights you have under applicable consumer law.",
    sections: [
      {
        heading: "1. Free plan and trial",
        paragraphs: [
          "The Starter plan costs 0 FCFA. A new workspace also begins with a seven-day trial. No payment is required to start, and the trial does not automatically create a card charge.",
        ],
      },
      {
        heading: "2. Paid plans",
        paragraphs: [
          "Growth and Scale are monthly plans priced in FCFA. Before a paid plan is activated, we confirm the plan, price, currency, billing period and any applicable taxes with you.",
          "Paid plans are arranged with the team while online billing is being rolled out. You will not be charged through the product without that confirmation.",
        ],
      },
      {
        heading: "3. Cancellation",
        paragraphs: [
          "You can ask to cancel a paid plan at any time by contacting hello@kontaflow.com. Unless agreed otherwise, cancellation stops the next billing period and you keep access until the end of the period you have already paid for.",
          "Cancelling a paid plan does not delete your workspace automatically. You can export your records and ask for account deletion under the Privacy Policy.",
        ],
      },
      {
        heading: "4. Refunds",
        paragraphs: [
          "If you were charged twice, charged the wrong amount, or charged after a confirmed cancellation, contact us and we will investigate and correct a genuine error.",
          "Change-of-mind refunds for a period already used are considered case by case and are not guaranteed. Where consumer law gives you a stronger right, that right applies.",
        ],
      },
      {
        heading: "5. How to request help",
        paragraphs: [
          "Email hello@kontaflow.com with the workspace name, the date of the charge, the amount and the reason for the request. Do not send full card numbers or passwords. We will confirm the next step and the expected timeline after reviewing the request.",
        ],
      },
    ],
  },
  {
    slug: "acceptable-use",
    title: "Acceptable Use Policy",
    description: "The conduct and content rules that keep KontaFlow safe for businesses, their teams and their data.",
    updated: "Effective 1 January 2026",
    intro:
      "KontaFlow handles financial records and personal data. This policy sets the minimum standard for using the service. It applies to every workspace member and anyone acting for them.",
    sections: [
      {
        heading: "1. Use the service lawfully",
        paragraphs: [
          "Do not use KontaFlow for fraud, theft, money laundering, terrorist financing, sanctions evasion, bribery or any other unlawful activity. Do not use it to disguise the source or ownership of money.",
        ],
      },
      {
        heading: "2. Protect the record",
        paragraphs: [
          "Do not create false or misleading transactions, backdate entries to deceive, delete audit evidence, or use another person's identity. Corrections must follow the product's reversal process, not an attempt to rewrite history.",
          "Do not upload malware, attempt to bypass access controls, probe another workspace, scrape the service, overload it, or interfere with its security features.",
        ],
      },
      {
        heading: "3. Respect people and their data",
        paragraphs: [
          "Only upload personal data you are entitled to use. Respect privacy, confidentiality and intellectual-property rights. Do not use contact details for spam or unlawful marketing.",
        ],
      },
      {
        heading: "4. Channel rules",
        paragraphs: [
          "When using WhatsApp, SMS, USSD or email, follow the provider's policies and local law. Do not send unlawful, harassing or deceptive messages, and do not use channel access to impersonate another person or business.",
        ],
      },
      {
        heading: "5. AI use",
        paragraphs: [
          "Do not use the assistant to generate unlawful content, attempt prompt injection against the service, extract another tenant's data or bypass permissions. Review AI output before posting it to the ledger.",
        ],
      },
      {
        heading: "6. Enforcement and reporting",
        paragraphs: [
          "We may investigate suspected abuse, limit access or suspend a workspace where necessary to protect users, the service or the public. Serious cases may be reported to the appropriate authority.",
          "Report abuse or a security concern to security@kontaflow.com. Include what you observed and how to reproduce it, without accessing data that is not yours.",
        ],
      },
    ],
  },
];
