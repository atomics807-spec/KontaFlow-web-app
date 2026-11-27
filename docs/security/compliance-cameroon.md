# Cameroon security and privacy compliance notes

Status: engineering guidance, not legal advice. Counsel must confirm the
current text, implementing decrees and regulator expectations before launch.

## Legal baseline

The project brief named Law No. 2010/012 and Law No. 2010/013. The second title
needs a correction before it is used in customer-facing material:

| Instrument | Actual subject | Relevance to KontaFlow |
| --- | --- | --- |
| Law No. 2010/012 of 21 December 2010 | Cybersecurity and cybercrime | Unauthorised access, interception, data integrity, abuse monitoring, incident handling |
| Law No. 2010/013 of 21 December 2010 | Electronic communications | Privacy of communications, traffic data, electronic marketing, network security |
| Law No. 2024/017 of 23 December 2024 | Protection of personal data | Controller/processor duties, lawful basis, data-subject rights, security, breach handling, transfers |
| Law No. 2010/021 of 21 December 2010 | Electronic commerce | Electronic records, contracts, trust services |
| Framework Law No. 2011/012 of 6 May 2011 | Consumer protection | Fair notice, complaints, misleading claims |
| Law No. 2016/007 of 12 July 2016 | Criminal Code | Computer-related offences and general criminal liability |
| CEMAC Regulation No. 03/16 | Payment systems, means and incidents | Mobile-money and payment incident handling |

Law No. 2010/013 is therefore an electronic-communications law, not a
standalone personal-data act. The current personal-data act is Law No.
2024/017. The implementing decree for the 2024 act was still a draft when the
comparative summary below was last checked. Track it before publishing a
compliance claim.

Reference consulted for the instrument list and definitions (secondary source,
not the gazette): [DLA Piper — Data protection laws in Cameroon](https://www.dlapiperdataprotection.com/index.html?t=law&c=CM).

## Engineering controls mapped to the law

| Legal theme | Product control | Where it lives |
| --- | --- | --- |
| Lawful, specified purpose | Signup records policy version, timestamp, locale, IP and user agent; marketing is a separate opt-in | `signUpAction`, `privacy_consents` |
| Consent withdrawal | Marketing consent can be switched off without deleting the account | Settings → Security → Privacy, `updateMarketingConsentAction` |
| Access and portability | Signed-in user downloads a JSON export of profile, memberships, consents and bookkeeping rows they may read | `GET /api/privacy/export` |
| Erasure | User opens a deletion request; platform staff review and execute it; user can cancel before completion | `account_deletion_requests`, `request_account_deletion`, `cancel_account_deletion` |
| Rectification | Profile, business name, phone and locale are editable in settings; verification timestamps are not client-writable | Settings, RLS column grants |
| Security and confidentiality | RLS on every tenant table, private storage, HttpOnly cookies, strict headers, CSRF checks, durable rate limits | `supabase/migrations`, `src/lib/security` |
| Breach detection | Append-only `security_events`, audit trail, webhook signature failures, rate-limit hits | `security_events`, `audit_logs`, `docs/security/incident-response.md` |
| Data minimisation | AI history is bounded and purgeable; logs redact secrets and message bodies; receipts are validated before storage | `src/lib/ai`, `src/lib/logger.ts`, `src/lib/security/file-validation.ts` |
| Processor management | Supabase, OpenAI, Resend, Africa's Talking, Meta, Vercel/Cloudflare are documented subprocessors; each needs a DPA and transfer review | `docs/integrations`, procurement |
| International transfers | Hosting and AI processing may leave Cameroon; record the transfer basis and give notice in the privacy policy | Legal review before launch |
| Electronic communications privacy | TLS in transit, no message bodies in audit metadata, WhatsApp opt-out and 24-hour window, USSD shared token | `docs/security/security.md` |
| Cybercrime prevention | Least privilege, service-role isolation, audit trail, upload scanning hook, incident response, abuse monitoring | `src/lib/security`, `src/lib/permissions.ts` |

## Data-subject request handling

1. Verify the requester is signed in and owns the account.
2. Use the self-service export for access and portability. It returns JSON and
   excludes other tenants, secrets, internal risk scores and service-only rows.
3. Use the deletion workflow for erasure. Do not hard-delete on the request
   alone: financial records may need to survive for accounting, tax, dispute
   and anti-fraud duties. Staff must document the lawful retention basis.
4. Record the decision and the legal basis in the support ticket. Do not put
   identity documents or full financial records in the ticket.
5. Reply within the period set by the 2024 act and its implementing decree.
   Until the decree is published, use a documented internal target and escalate
   to counsel.

## Breach notification

The 2024 act is expected to require notification to the supervisory authority
and, where the risk is high, to affected people. The final deadline and format
must be confirmed in the implementing decree. The runbook in
`docs/security/incident-response.md` therefore uses an internal 72-hour
escalation target, not a claim that 72 hours is the statutory deadline.

## Launch gate

Do not publish "Cameroon-compliant" or "GDPR-equivalent" claims until counsel
has confirmed:

- the current personal-data act and any implementing decree;
- registration, prior-formality or DPO duties that apply to the company;
- the lawful basis for AI processing and any additional notice or consent;
- transfer mechanisms for Supabase, OpenAI, Resend and edge hosting;
- retention periods for bookkeeping, receipts, AI conversations and security
  logs;
- the incident-notification channel, template and deadline.
