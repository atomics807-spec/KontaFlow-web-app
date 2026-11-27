# Security incident response runbook

This runbook covers suspected unauthorised access, data disclosure, credential
compromise, payment fraud and destructive changes. It is an operational plan,
not a legal opinion.

## Severity

| Severity | Examples | First response |
| --- | --- | --- |
| SEV-1 | Confirmed cross-tenant read/write, service-role key leak, payment fraud, destructive database access | Page the incident lead immediately; freeze affected credentials |
| SEV-2 | Single-account takeover, receipt malware, repeated webhook signature failures, exposed internal endpoint | Respond within one hour; contain before broad investigation |
| SEV-3 | Rate-limit abuse, failed login spray, low-impact spam, scanner noise | Triage during business hours; tune controls |

## Roles

- **Incident lead** — owns the timeline, decisions and external communication.
- **Security engineer** — contains, preserves evidence and leads technical analysis.
- **Data protection lead** — assesses personal-data impact and notification duties.
- **Product/support lead** — handles customer communication and support tickets.
- **Legal counsel** — confirms regulator notification, retention and contractual duties.

Keep one incident channel and one timestamped decision log. Do not debate
liability in the customer channel.

## First 30 minutes

1. Open an incident record with an ID, detector, start time and current severity.
2. Preserve evidence before rotating: export relevant `security_events`,
   `audit_logs`, edge/WAF logs and provider webhook logs to a restricted
   location. Do not copy secrets into the ticket.
3. Contain the smallest blast radius:
   - revoke the compromised session or API key;
   - restrict or suspend the account through the platform admin console;
   - disable the affected integration adapter;
   - block the source at Cloudflare if the traffic is external.
4. Confirm whether tenant data crossed a workspace boundary. Check RLS,
   service-role calls, storage signed URLs and export downloads.
5. Escalate to SEV-1 if any tenant data was read or changed by an unauthorised party.

## Investigation checklist

- Which identity, workspace, role and channel were involved?
- Which rows or objects were accessed? Use immutable audit records, not only app logs.
- Was the service-role key, OpenAI key, webhook secret or a user session exposed?
- Did the attacker change financial records, members, roles or payment state?
- Are there persistence signs: new platform admin, new channel link, new API key,
  changed recovery email, changed webhook URL?
- Is the issue still reproducible? If yes, keep the affected path disabled.

## Notification

1. The data protection lead decides whether the incident is a personal-data
   breach. Record the reasoning.
2. If notification is required, counsel confirms the authority, form and
   deadline. The internal escalation target is 72 hours from confirmation, but
   the statutory deadline must be checked against the current Cameroonian law
   and implementing decree.
3. Notify affected workspace owners with facts only: what happened, what data,
   when, what KontaFlow did, what the customer should do, and the contact point.
4. Do not notify a wider audience until counsel approves the wording.
5. Payment incidents may also require the provider and CEMAC payment-incident
   process.

## Recovery

- Rotate every credential that could have been exposed.
- Patch the root cause and add a regression test.
- Re-enable the path gradually and watch `security_events` for recurrence.
- Confirm backups restore correctly if data was destroyed.
- For financial records, use the reversal workflow; never edit posted ledger rows.

## Post-incident

Within five business days:

- publish an internal postmortem with timeline, root cause, impact and owners;
- add preventive controls to the backlog with due dates;
- update this runbook and the threat model;
- record whether notification was made and keep the evidence;
- remove temporary access and close the incident channel.

## Useful signals

- `security_events` — authentication, CSRF, rate-limit, upload, webhook and
  privacy events.
- `audit_logs` — financial and administrative mutations.
- `webhook_events` / `payment_webhooks` — replay, signature and processing state.
- Cloudflare/Supabase logs — WAF, auth and database access outside the app.
