/**
 * Integration test for the database layer: applies every migration to a fresh
 * Postgres database, then proves multi-tenant isolation, ledger integrity and
 * permission rules using real `authenticated` / `anon` role switches.
 *
 *   npm run test:db
 *
 * Requires a Postgres instance reachable through SUPABASE_DB_URL
 * (default: postgresql://postgres:postgres@127.0.0.1:5433/postgres).
 */
import type { Client } from "pg";
import { applyMigrations, bootstrapLocalAuth, connect, databaseName, recreateDatabase } from "./lib/db";
import { asRole, eq, expectError, ok, summary } from "./lib/assert";

const TEST_DB = "kontaflow_test";
const ALICE = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";
const CHARLIE = "33333333-3333-4333-8333-333333333333";
const DORA = "44444444-4444-4444-8444-444444444444";
const EVE = "55555555-5555-4555-8555-555555555555";
const SUPER = "66666666-6666-4666-8666-666666666666";

const alice = { sub: ALICE, email: "alice@example.com", role: "authenticated" };
const bob = { sub: BOB, email: "bob@example.com", role: "authenticated" };
const charlie = { sub: CHARLIE, email: "charlie@example.com", role: "authenticated" };
const dora = { sub: DORA, email: "dora@example.com", role: "authenticated" };
const eve = { sub: EVE, email: "eve@example.com", role: "authenticated" };
const superAdmin = { sub: SUPER, email: "super@example.com", role: "authenticated" };

async function commitAs<T>(
  client: Client,
  claims: Record<string, unknown>,
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  await client.query("begin");
  try {
    await client.query("set local role authenticated");
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function scalar(client: Client, sql: string, params: unknown[] = []): Promise<string> {
  const result = await client.query(sql, params);
  const row = result.rows[0];
  if (!row) return "";
  const first = Object.values(row as Record<string, unknown>)[0];
  return first === null || first === undefined ? "" : String(first);
}



async function main(): Promise<void> {
  const maintenance = await connect();
  const dbName = TEST_DB;
  console.log(`Preparing fresh database "${dbName}" ...`);
  await recreateDatabase(maintenance, dbName);
  await maintenance.end();

  const client = await connect(undefined, dbName);
  try {
    await bootstrapLocalAuth(client);
    const files = await applyMigrations(client);
    ok(`applied ${files.length} migrations`, files.length >= 8, files);

    await client.query(
      `insert into auth.users (id, email, raw_user_meta_data) values
         ($1, 'alice@example.com', '{"full_name":"Alice Nkeng"}'::jsonb),
         ($2, 'bob@example.com', '{"full_name":"Bob Mbarga"}'::jsonb),
         ($3, 'charlie@example.com', '{"full_name":"Charlie Fotso"}'::jsonb),
         ($4, 'dora@example.com', '{"full_name":"Dora Etaba"}'::jsonb)`,
      [ALICE, BOB, CHARLIE, DORA],
    );

    // These accounts stand in for customers who existed before Phase 4.
    await client.query(
      `update profiles
       set email_verified_at = now(),
           phone_verified_at = now(),
           verification_required = false
       where id = any($1::uuid[])`,
      [[ALICE, BOB, CHARLIE, DORA]],
    );

    console.log("\nProvisioning");
    const workspaceA = await commitAs(client, alice, async (c) => {
      const result = await c.query<{ data: { id: string } }>(
        `select public.create_workspace('Nkeng Fresh Foods', 'XAF', 'CM', 'Africa/Douala', 'Nkeng SARL', 'en') as data`,
      );
      return result.rows[0]!.data;
    });
    const workspaceB = await commitAs(client, bob, async (c) => {
      const result = await c.query<{ data: { id: string } }>(
        `select public.create_workspace('Mbarga Motors', 'XAF', 'CM', 'Africa/Douala', null, 'fr') as data`,
      );
      return result.rows[0]!.data;
    });

    // The starter trial allows one business. Temporarily raise the fixture
    // limit so the multi-workspace and payment tests can use a second tenant.
    await asRole(
      client,
      "service_role",
      null,
      async (c) => {
        await c.query(`update subscription_plans set workspace_limit = 2 where code = 'starter'`);
        await c.query(
          `insert into plan_features (plan_id, feature_id, included)
           select p.id, f.id, true
             from subscription_plans p, subscription_features f
            where p.code = 'starter' and f.code = 'multiple_workspaces'
           on conflict (plan_id, feature_id) do update set included = true`,
        );
      },
      true,
    );
    const workspacePcm = await commitAs(client, alice, async (c) => {
      const result = await c.query<{ data: { id: string } }>(
        `select public.create_workspace('Pidgin Shop', 'XAF', 'CM', 'Africa/Douala', null, 'pcm') as data`,
      );
      return result.rows[0]!.data;
    });
    await asRole(
      client,
      "service_role",
      null,
      async (c) => {
        await c.query(
          `delete from plan_features pf
             using subscription_features f, subscription_plans p
            where pf.feature_id = f.id and pf.plan_id = p.id
              and p.code = 'starter' and f.code = 'multiple_workspaces'`,
        );
        await c.query(`update subscription_plans set workspace_limit = 1 where code = 'starter'`);
      },
      true,
    );
    eq("workspace creation accepts pcm", await scalar(client, `select locale from workspaces where id = $1`, [workspacePcm.id]), "pcm");
    eq(
      "starter categories carry pcm translations",
      await scalar(client, `select translations ->> 'pcm' from categories where workspace_id = $1 and name = 'Sales'`, [workspacePcm.id]),
      "Sale",
    );

    eq(
      "starter blocks an extra business",
      (
        await expectError(
          client,
          "authenticated",
          alice,
          `select public.create_workspace('Third Shop', 'XAF', 'CM', 'Africa/Douala', null, 'en')`,
          [],
          { commit: true },
        )
      )?.code,
      "42501",
    );

    const idA = workspaceA.id;
    const idB = workspaceB.id;
    const todayA = await scalar(client, `select (now() at time zone 'Africa/Douala')::date::text`);
    ok("workspace A created", Boolean(idA));
    ok("workspace B created", Boolean(idB));
    eq("A has 8 system accounts", await scalar(client, `select count(*) from accounts where workspace_id = $1`, [idA]), 8);
    eq("A has 15 starter categories", await scalar(client, `select count(*) from categories where workspace_id = $1`, [idA]), 15);
    eq(
      "A subscription is trialing",
      await scalar(client, `select status from subscriptions where workspace_id = $1`, [idA]),
      "trialing",
    );
    eq(
      "A owner membership",
      await scalar(client, `select role from workspace_members where workspace_id = $1 and user_id = $2`, [idA, ALICE]),
      "owner",
    );
    eq(
      "profile auto-created with name",
      await scalar(client, `select full_name from profiles where id = $1`, [ALICE]),
      "Alice Nkeng",
    );
    eq(
      "member directory returns email text",
      await commitAs(client, alice, (c) =>
        scalar(c, `select email from public.get_workspace_members($1) where user_id = $2`, [idA, ALICE]),
      ),
      "alice@example.com",
    );

    console.log("\nRecording transactions");
    const txIncome = await commitAs(client, alice, async (c) => {
      const category = await c.query<{ id: string }>(
        `select id from categories where workspace_id = $1 and name = 'Sales'`,
        [idA],
      );
      const account = await c.query<{ id: string }>(
        `select id from accounts where workspace_id = $1 and subtype = 'cash'`,
        [idA],
      );
      const result = await c.query<{ data: { id: string } }>(
        `select public.record_transaction($1::jsonb) as data`,
        [
          JSON.stringify({
            workspace_id: idA,
            kind: "income",
            amount_minor: 50000,
            description: "Sold 2 crates of tomatoes",
            category_id: category.rows[0]!.id,
            account_id: account.rows[0]!.id,
            client_generated_id: "device-1-tx-1",
            channel: "sync",
          }),
        ],
      );
      return result.rows[0]!.data;
    });

    const txExpense = await commitAs(client, alice, async (c) => {
      const category = await c.query<{ id: string }>(
        `select id from categories where workspace_id = $1 and name = 'Transport'`,
        [idA],
      );
      const account = await c.query<{ id: string }>(
        `select id from accounts where workspace_id = $1 and subtype = 'cash'`,
        [idA],
      );
      const result = await c.query<{ data: { id: string } }>(
        `select public.record_transaction($1::jsonb) as data`,
        [
          JSON.stringify({
            workspace_id: idA,
            kind: "expense",
            amount_minor: 12500,
            description: "Fuel for the delivery bike",
            category_id: category.rows[0]!.id,
            account_id: account.rows[0]!.id,
            payment_method: "mobile_money",
          }),
        ],
      );
      return result.rows[0]!.data;
    });

    ok("income recorded", Boolean(txIncome.id));
    ok("expense recorded", Boolean(txExpense.id));
    eq("four ledger lines", await scalar(client, `select count(*) from ledger_lines where workspace_id = $1`, [idA]), 4);
    eq(
      "every transaction is balanced",
      await scalar(
        client,
        `select count(*) from (
           select transaction_id from ledger_lines where workspace_id = $1
           group by transaction_id having sum(debit_minor) <> sum(credit_minor)
         ) unbalanced`,
        [idA],
      ),
      0,
    );

    const dashboard = await asRole(client, "authenticated", alice, async (c) => {
      const result = await c.query<{ data: Record<string, string> }>(
        `select public.get_dashboard_summary($1, $2::date - 30, $2::date) as data`,
        [idA, todayA],
      );
      return result.rows[0]!.data;
    });
    eq("dashboard income", dashboard.totalIncomeMinor, "50000");
    eq("dashboard expense", dashboard.totalExpenseMinor, "12500");
    eq("dashboard net profit", dashboard.netProfitMinor, "37500");
    eq("dashboard cash balance", dashboard.cashBalanceMinor, "37500");

    console.log("\nIdempotency");
    const duplicate = await commitAs(client, alice, async (c) => {
      const account = await c.query<{ id: string }>(
        `select id from accounts where workspace_id = $1 and subtype = 'cash'`,
        [idA],
      );
      const result = await c.query<{ data: { id: string; duplicate: boolean } }>(
        `select public.record_transaction($1::jsonb) as data`,
        [
          JSON.stringify({
            workspace_id: idA,
            kind: "income",
            amount_minor: 50000,
            description: "Retry from offline queue",
            account_id: account.rows[0]!.id,
            client_generated_id: "device-1-tx-1",
            channel: "sync",
          }),
        ],
      );
      return result.rows[0]!.data;
    });
    ok("replayed client id returns original transaction", duplicate.id === txIncome.id && duplicate.duplicate === true);
    eq("still two transactions", await scalar(client, `select count(*) from transactions where workspace_id = $1`, [idA]), 2);
    eq("sync usage metered", await scalar(client, `select count(*) from usage_events where workspace_id = $1 and kind = 'sync_push'`, [idA]), 1);

    console.log("\nTenant isolation");
    const asBob = async (sql: string, params: unknown[] = []) =>
      asRole(client, "authenticated", bob, async (c) => scalar(c, sql, params));
    const asAlice = async (sql: string, params: unknown[] = []) =>
      asRole(client, "authenticated", alice, async (c) => scalar(c, sql, params));
    const asDora = async (sql: string, params: unknown[] = []) =>
      asRole(client, "authenticated", dora, async (c) => scalar(c, sql, params));

    eq("cannot read A transactions", await asBob(`select count(*) from transactions where workspace_id = $1`, [idA]), 0);
    eq("cannot read A ledger", await asBob(`select count(*) from ledger_lines where workspace_id = $1`, [idA]), 0);
    eq("cannot read A accounts", await asBob(`select count(*) from accounts where workspace_id = $1`, [idA]), 0);
    eq("cannot read A categories", await asBob(`select count(*) from categories where workspace_id = $1`, [idA]), 0);
    eq("cannot read A workspace row", await asBob(`select count(*) from workspaces where id = $1`, [idA]), 0);
    eq("cannot read A members", await asBob(`select count(*) from workspace_members where workspace_id = $1`, [idA]), 0);
    eq("cannot read A audit log", await asBob(`select count(*) from audit_logs where workspace_id = $1`, [idA]), 0);
    eq("cannot read A subscription", await asBob(`select count(*) from subscriptions where workspace_id = $1`, [idA]), 0);
    const dashboardProbe = await expectError(
      client,
      "authenticated",
      bob,
      `select public.get_dashboard_summary($1, current_date - 30, current_date)`,
      [idA],
    );
    ok("cannot read A dashboard", dashboardProbe?.code === "42501", dashboardProbe);

    const anonError = await expectError(client, "anon", null, `select count(*) from transactions`);
    ok("anon has no table access", Boolean(anonError?.code === "42501"), anonError);

    console.log("\nWrite protections");
    const directInsert = await expectError(
      client,
      "authenticated",
      bob,
      `insert into transactions (workspace_id, kind, occurred_on, description, account_id, amount_minor)
       values ($1, 'income', current_date, 'sneaky', $2, 1000)`,
      [idA, (await client.query(`select id from accounts where workspace_id = $1 limit 1`, [idA])).rows[0].id],
    );
    ok("cannot insert transactions directly", directInsert?.code === "42501", directInsert);

    const crossRecord = await expectError(
      client,
      "authenticated",
      bob,
      `select public.record_transaction($1::jsonb)`,
      [JSON.stringify({ workspace_id: idA, kind: "expense", amount_minor: 100, description: "x" })],
    );
    ok("cannot record into another tenant", crossRecord?.code === "42501", crossRecord);

    const crossVoid = await expectError(
      client,
      "authenticated",
      bob,
      `select public.void_transaction($1, 'nope')`,
      [txExpense.id],
    );
    ok("cannot void another tenant's transaction", crossVoid?.code === "42501", crossVoid);

    const directLedger = await expectError(
      client,
      "authenticated",
      alice,
      `insert into ledger_lines (workspace_id, transaction_id, account_id, line_no, debit_minor)
       values ($1, $2, $3, 9, 1)`,
      [idA, txIncome.id, (await client.query(`select id from accounts where workspace_id = $1 limit 1`, [idA])).rows[0].id],
    );
    ok("cannot write ledger lines directly", directLedger?.code === "42501", directLedger);

    const tamper = await expectError(
      client,
      "service_role",
      null,
      `update transactions set amount_minor = 999999 where id = $1`,
      [txIncome.id],
    );
    ok("posted transactions are immutable", tamper?.code === "23514", tamper);

    console.log("\nRole boundaries");
    await client.query(`insert into workspace_members (workspace_id, user_id, role, status) values ($1, $2, 'staff', 'active')`, [
      idB,
      CHARLIE,
    ]);
    const staffRecord = await commitAs(client, charlie, async (c) => {
      const account = await c.query<{ id: string }>(
        `select id from accounts where workspace_id = $1 and subtype = 'mobile_money'`,
        [idB],
      );
      const result = await c.query<{ data: { id: string } }>(`select public.record_transaction($1::jsonb) as data`, [
        JSON.stringify({
          workspace_id: idB,
          kind: "expense",
          amount_minor: 3000,
          description: "Bike repair",
          account_id: account.rows[0]!.id,
        }),
      ]);
      return result.rows[0]!.data;
    });
    ok("staff can record transactions", Boolean(staffRecord.id));

    const staffVoid = await expectError(client, "authenticated", charlie, `select public.void_transaction($1, 'x')`, [
      staffRecord.id,
    ]);
    ok("staff cannot void", staffVoid?.code === "42501", staffVoid);

    const staffCategory = await expectError(
      client,
      "authenticated",
      charlie,
      `insert into categories (workspace_id, name, kind) values ($1, 'Sneaky', 'expense')`,
      [idB],
    );
    ok("staff cannot manage categories", staffCategory?.code === "42501", staffCategory);

    eq(
      "owner cannot demote themselves when sole owner",
      String(
        (
          await expectError(
            client,
            "authenticated",
            alice,
            `delete from workspace_members where workspace_id = $1 and user_id = $2`,
            [idA, ALICE],
          )
        )?.code,
      ),
      "23514",
    );

    console.log("\nInvitations");
    const invitationToken = await commitAs(client, alice, async (c) => {
      const result = await c.query<{ token: string }>(
        `insert into workspace_invitations (workspace_id, email, role, invited_by)
         values ($1, 'bob@example.com', 'accountant', $2) returning token`,
        [idA, ALICE],
      );
      return result.rows[0]!.token;
    });

    const wrongEmail = await expectError(
      client,
      "authenticated",
      charlie,
      `select public.accept_invitation($1)`,
      [invitationToken],
    );
    ok("cannot accept an invitation for another email", wrongEmail?.code === "42501", wrongEmail);

    await commitAs(client, bob, async (c) => {
      await c.query(`select public.accept_invitation($1)`, [invitationToken]);
    });
    eq(
      "invited accountant can now read A",
      await asBob(`select count(*) from transactions where workspace_id = $1`, [idA]),
      2,
    );
    eq(
      "invitation marked accepted",
      await scalar(client, `select status from workspace_invitations where token = $1`, [invitationToken]),
      "accepted",
    );

    console.log("\nVoiding");
    await commitAs(client, alice, async (c) => {
      await c.query(`select public.void_transaction($1, 'wrong amount')`, [txExpense.id]);
    });
    const afterVoid = await asRole(client, "authenticated", alice, async (c) => {
      const result = await c.query<{ data: Record<string, string> }>(
        `select public.get_dashboard_summary($1, $2::date - 30, $2::date) as data`,
        [idA, todayA],
      );
      return result.rows[0]!.data;
    });
    eq("voided expense leaves totals", afterVoid.totalExpenseMinor, "0");
    eq("voided expense restores cash", afterVoid.cashBalanceMinor, "50000");
    eq(
      "void is audited",
      await scalar(client, `select count(*) from audit_logs where workspace_id = $1 and action = 'transaction.voided'`, [idA]),
      1,
    );

    console.log("\nReporting");
    const report = await asRole(client, "authenticated", alice, async (c) => {
      const result = await c.query<{ data: Record<string, unknown> }>(
        `select public.get_report($1, $2::date - 30, $2::date) as data`,
        [idA, todayA],
      );
      return result.rows[0]!.data;
    });
    eq("report revenue", report.revenueMinor, "50000");
    eq("report expenses exclude voided", report.expenseMinor, "0");
    ok("report has daily series", Array.isArray(report.dailySeries));

    const unbalanced = await expectError(
      client,
      "service_role",
      null,
      `with t as (
         insert into transactions (workspace_id, kind, occurred_on, description, account_id, amount_minor)
         select $1, 'income', current_date, 'unbalanced', id, 1 from accounts where workspace_id = $1 limit 1
         returning id
       )
       insert into ledger_lines (workspace_id, transaction_id, account_id, line_no, debit_minor)
       select $1, id, (select id from accounts where workspace_id = $1 limit 1), 1, 1 from t`,
      [idA],
      { commit: true },
    );
    ok("unbalanced postings are rejected", unbalanced?.code === "23514", unbalanced);

    console.log("\nChannel ingestion");
    const channelAccount = await scalar(
      client,
      `select id from accounts where workspace_id = $1 and subtype = 'mobile_money'`,
      [idB],
    );
    const channelPayload = JSON.stringify({
      kind: "income",
      amount_minor: "7000",
      description: "Sale via USSD test",
      account_id: channelAccount,
      client_generated_id: "ussd-test-1",
    });
    const channelTx = await asRole(
      client,
      "service_role",
      null,
      async (c) => {
        const result = await c.query<{ data: { id: string; duplicate: boolean } }>(
          `select public.record_channel_transaction($1, $2, 'ussd', $3::jsonb) as data`,
          [idB, CHARLIE, channelPayload],
        );
        return result.rows[0]!.data;
      },
      true,
    );
    ok("channel transaction recorded", Boolean(channelTx.id));
    eq(
      "channel is stored",
      await scalar(client, `select channel from transactions where id = $1`, [channelTx.id]),
      "ussd",
    );
    eq(
      "channel entry attributed to actor",
      await scalar(client, `select created_by from transactions where id = $1`, [channelTx.id]),
      CHARLIE,
    );

    const channelRetry = await asRole(
      client,
      "service_role",
      null,
      async (c) => {
        const result = await c.query<{ data: { id: string; duplicate: boolean } }>(
          `select public.record_channel_transaction($1, $2, 'ussd', $3::jsonb) as data`,
          [idB, CHARLIE, channelPayload],
        );
        return result.rows[0]!.data;
      },
      true,
    );
    ok("channel retries are idempotent", channelRetry.duplicate === true && channelRetry.id === channelTx.id);

    console.log("\nUSSD sessions and pending links");
    const ussdSessionId = `db-ussd-${Date.now()}`;
    const ussdPhone = "+237699999999";
    await asRole(
      client,
      "service_role",
      null,
      async (c) => {
        await c.query(
          `insert into ussd_sessions (session_id, phone, workspace_id, user_id, state, service_code, expires_at)
           values ($1, $2, $3, $4, $5::jsonb, '*384*1234#', now() + interval '3 minutes')`,
          [ussdSessionId, ussdPhone, idB, CHARLIE, JSON.stringify({ version: 1, stage: "category", amountMinor: "500" })],
        );
      },
      true,
    );
    eq(
      "USSD session state is stored",
      await scalar(client, `select state ->> 'stage' from ussd_sessions where session_id = $1`, [ussdSessionId]),
      "category",
    );
    eq(
      "browser clients cannot read USSD sessions",
      await asRole(client, "authenticated", alice, (c) =>
        scalar(c, `select count(*) from ussd_sessions where session_id = $1`, [ussdSessionId]),
      ),
      "0",
    );
    const ussdSessionInsertDenied = await expectError(
      client,
      "authenticated",
      alice,
      `insert into ussd_sessions (session_id, phone, state) values ('browser-made', $1, '{}'::jsonb)`,
      [ussdPhone],
    );
    ok("browser clients cannot write USSD sessions", ussdSessionInsertDenied?.code === "42501", ussdSessionInsertDenied);

    const pendingUssdId = await asRole(
      client,
      "service_role",
      null,
      async (c) => {
        const result = await c.query<{ id: string }>(
          `insert into channel_identities
             (workspace_id, user_id, channel, address, verified_at, verification_code_hash, verification_expires_at, verification_method)
           values ($1, $2, 'ussd', $3, null, 'test-hash', now() + interval '10 minutes', 'ussd_link')
           returning id`,
          [idB, CHARLIE, ussdPhone],
        );
        return result.rows[0]!.id;
      },
      true,
    );
    ok("pending USSD link is stored without verified_at", Boolean(pendingUssdId));
    const selfVerify = await expectError(
      client,
      "authenticated",
      charlie,
      `update channel_identities set verified_at = now() where id = $1`,
      [pendingUssdId],
    );
    ok("browser clients cannot self-verify a USSD number", selfVerify?.code === "42501", selfVerify);

    const rpcDenied = await expectError(
      client,
      "authenticated",
      alice,
      `select public.record_channel_transaction($1, $2, 'ussd', $3::jsonb)`,
      [idB, CHARLIE, channelPayload],
    );
    ok("authenticated cannot call the service channel rpc", rpcDenied?.code === "42501", rpcDenied);

    const crossTenant = await expectError(
      client,
      "service_role",
      null,
      `select public.record_channel_transaction($1, $2, 'ussd', $3::jsonb)`,
      [idB, ALICE, channelPayload],
    );
    ok("service rpc still verifies membership", crossTenant?.code === "42501", crossTenant);

    const quotaAllowed = await asRole(
      client,
      "service_role",
      null,
      async (c) => {
        const result = await c.query<{ allowed: boolean }>(
          `select public.consume_channel_quota($1, $2, 'ai_message', 5) as allowed`,
          [idB, CHARLIE],
        );
        return result.rows[0]!.allowed;
      },
      true,
    );
    eq("channel quota increments", quotaAllowed, true);

    const serviceSummary = await asRole(
      client,
      "service_role",
      null,
      async (c) => {
        const result = await c.query<{ data: Record<string, string> }>(
          `select public.get_workspace_summary_as_service($1, $2::date - 30, $2::date) as data`,
          [idB, todayA],
        );
        return result.rows[0]!.data;
      },
    );
    eq("service summary returns totals", serviceSummary.totalIncomeMinor, "7000");

    console.log("\nPhase 3 · schema invariants");
    eq(
      "business settings are auto-provisioned",
      await scalar(client, `select count(*) from business_settings where workspace_id = $1`, [idA]),
      "1",
    );
    eq("plan catalogue seeded", await scalar(client, `select count(*) from subscription_plans`), "3");
    eq(
      "subscription is linked to its plan",
      await scalar(
        client,
        `select p.code from subscriptions s join subscription_plans p on p.id = s.plan_id where s.workspace_id = $1`,
        [idA],
      ),
      "starter",
    );
    ok(
      "plan features are catalogued",
      Number(await scalar(client, `select count(*) from plan_features`)) >= 10,
    );

    const invoiceNumber1 = await commitAs(client, alice, async (c) =>
      scalar(c, `select public.next_invoice_number($1)`, [idA]),
    );
    const invoiceNumber2 = await commitAs(client, alice, async (c) =>
      scalar(c, `select public.next_invoice_number($1)`, [idA]),
    );
    eq("invoice numbering starts at INV-0001", invoiceNumber1, "INV-0001");
    eq("invoice numbering increments once", invoiceNumber2, "INV-0002");

    console.log("\nPhase 3 · invoices");
    const customerA = await commitAs(client, alice, async (c) => {
      const result = await c.query<{ id: string }>(
        `insert into contacts (workspace_id, kind, name) values ($1, 'customer', 'Mami Fish') returning id`,
        [idA],
      );
      return result.rows[0]!.id;
    });
    const invoiceId = await commitAs(client, alice, async (c) => {
      const invoice = await c.query<{ id: string }>(
        `insert into invoices (workspace_id, customer_id, number, due_on, currency)
         values ($1, $2, 'INV-0001', current_date + 7, 'XAF') returning id`,
        [idA, customerA],
      );
      const id = invoice.rows[0]!.id;
      await c.query(
        `insert into invoice_items (workspace_id, invoice_id, position, description, quantity, unit_price_minor, tax_rate_bp)
         values ($1, $2, 1, 'Crates of fish', 3, 1000, 0),
                ($1, $2, 2, 'Delivery', 1.5, 2000, 1000)`,
        [idA, id],
      );
      return id;
    });
    eq(
      "invoice subtotal is derived from items",
      await scalar(client, `select subtotal_minor from invoices where id = $1`, [invoiceId]),
      "6000",
    );
    eq(
      "invoice tax uses basis points",
      await scalar(client, `select tax_minor from invoices where id = $1`, [invoiceId]),
      "300",
    );
    eq(
      "invoice total is subtotal plus tax",
      await scalar(client, `select total_minor from invoices where id = $1`, [invoiceId]),
      "6300",
    );
    eq(
      "invoice line total is rounded integer",
      await scalar(client, `select line_total_minor from invoice_items where invoice_id = $1 and position = 2`, [invoiceId]),
      "3000",
    );
    eq(
      "invoice numbers are unique inside a workspace",
      (await expectError(
        client,
        "authenticated",
        alice,
        `insert into invoices (workspace_id, customer_id, number, due_on) values ($1, $2, 'INV-0001', current_date + 3)`,
        [idA, customerA],
      ))?.code,
      "23505",
    );
    eq(
      "cross-tenant invoice inserts are rejected",
      (await expectError(
        client,
        "authenticated",
        dora,
        `insert into invoices (workspace_id, customer_id, number, due_on) values ($1, $2, 'INV-X', current_date + 3)`,
        [idA, customerA],
      ))?.code,
      "42501",
    );
    eq(
      "other tenants cannot read invoices",
      await asDora(`select count(*) from invoices where workspace_id = $1`, [idA]),
      "0",
    );

    await commitAs(client, alice, async (c) => {
      await c.query(`update invoices set status = 'sent' where id = $1`, [invoiceId]);
    });
    eq(
      "issued invoices lock their line items",
      (await expectError(
        client,
        "authenticated",
        alice,
        `insert into invoice_items (workspace_id, invoice_id, position, description, quantity, unit_price_minor)
         values ($1, $2, 3, 'Late addition', 1, 500)`,
        [idA, invoiceId],
      ))?.code,
      "23514",
    );
    eq(
      "issued invoices cannot change totals",
      (await expectError(
        client,
        "authenticated",
        alice,
        `update invoices set total_minor = 1 where id = $1`,
        [invoiceId],
      ))?.code,
      "23514",
    );
    ok(
      "only drafts can be deleted",
      (await expectError(client, "authenticated", alice, `delete from invoices where id = $1`, [invoiceId]))?.code ===
        "23514",
    );

    console.log("\nPhase 3 · debts");
    const debtId = await commitAs(client, alice, async (c) => {
      const result = await c.query<{ id: string }>(
        `insert into debts (workspace_id, direction, contact_id, description, principal_minor, due_on)
         values ($1, 'receivable', $2, 'Stock on credit', 5000, current_date + 14) returning id`,
        [idA, customerA],
      );
      return result.rows[0]!.id;
    });
    await commitAs(client, alice, async (c) => {
      await c.query(
        `insert into debt_payments (workspace_id, debt_id, amount_minor, paid_on) values ($1, $2, 2000, current_date)`,
        [idA, debtId],
      );
    });
    eq(
      "debt payment updates the paid amount",
      await scalar(client, `select paid_minor from debts where id = $1`, [debtId]),
      "2000",
    );
    eq(
      "debt status becomes partially paid",
      await scalar(client, `select status from debts where id = $1`, [debtId]),
      "partially_paid",
    );
    eq(
      "overpayments are rejected",
      (await expectError(
        client,
        "authenticated",
        alice,
        `insert into debt_payments (workspace_id, debt_id, amount_minor, paid_on) values ($1, $2, 4000, current_date)`,
        [idA, debtId],
      ))?.code,
      "23514",
    );
    await commitAs(client, alice, async (c) => {
      await c.query(
        `insert into debt_payments (workspace_id, debt_id, amount_minor, paid_on) values ($1, $2, 3000, current_date)`,
        [idA, debtId],
      );
    });
    eq(
      "settled debt is closed",
      await scalar(client, `select status || ':' || (closed_at is not null) from debts where id = $1`, [debtId]),
      "settled:true",
    );
    const paymentRow = await scalar(client, `select id from debt_payments where debt_id = $1 order by amount_minor limit 1`, [
      debtId,
    ]);
    eq(
      "payments are voided, not deleted",
      (await expectError(client, "authenticated", alice, `delete from debt_payments where id = $1`, [paymentRow]))?.code,
      "23514",
    );
    eq(
      "payment amounts are immutable",
      (await expectError(
        client,
        "authenticated",
        alice,
        `update debt_payments set amount_minor = 10 where id = $1`,
        [paymentRow],
      ))?.code,
      "23514",
    );
    eq(
      "cross-tenant debts are invisible",
      await asDora(`select count(*) from debts where workspace_id = $1`, [idA]),
      "0",
    );

    eq(
      "paid amounts are not editable on issued invoices",
      (await expectError(
        client,
        "authenticated",
        alice,
        `update invoices set amount_paid_minor = 100 where id = $1`,
        [invoiceId],
      ))?.code,
      "23514",
    );

    const linkedInvoice = await commitAs(client, alice, async (c) => {
      const invoice = await c.query<{ id: string }>(
        `insert into invoices (workspace_id, customer_id, number, due_on, currency)
         values ($1, $2, 'INV-0002', current_date + 7, 'XAF') returning id`,
        [idA, customerA],
      );
      const id = invoice.rows[0]!.id;
      await c.query(
        `insert into invoice_items (workspace_id, invoice_id, position, description, quantity, unit_price_minor)
         values ($1, $2, 1, 'Repair kit', 1, 1000)`,
        [idA, id],
      );
      await c.query(`update invoices set status = 'sent' where id = $1`, [id]);
      return id;
    });
    await commitAs(client, alice, async (c) => {
      const debt = await c.query<{ id: string }>(
        `insert into debts (workspace_id, direction, contact_id, description, principal_minor, invoice_id)
         values ($1, 'receivable', $2, 'Invoice INV-0002', 1000, $3) returning id`,
        [idA, customerA, linkedInvoice],
      );
      await c.query(
        `insert into debt_payments (workspace_id, debt_id, amount_minor, paid_on) values ($1, $2, 1000, current_date)`,
        [idA, debt.rows[0]!.id],
      );
    });
    eq(
      "payments settle the linked invoice",
      await scalar(
        client,
        `select status::text || ':' || amount_paid_minor || ':' || (paid_at is not null)
           from invoices where id = $1`,
        [linkedInvoice],
      ),
      "paid:1000:true",
    );

    console.log("\nPhase 3 · reversals and provenance");
    const reversible = await commitAs(client, alice, async (c) => {
      const account = (
        await c.query<{ id: string }>(`select id from accounts where workspace_id = $1 and subtype = 'cash'`, [idA])
      ).rows[0]!.id;
      const result = await c.query<{ data: { id: string } }>(`select public.record_transaction($1::jsonb) as data`, [
        JSON.stringify({
          workspace_id: idA,
          kind: "income",
          amount_minor: 7000,
          description: "Reversal fixture",
          account_id: account,
          channel: "ai",
        }),
      ]);
      return result.rows[0]!.data;
    });
    eq(
      "provenance is derived from the channel",
      await scalar(client, `select source::text from transactions where id = $1`, [reversible.id]),
      "ai",
    );
    const reversal = await commitAs(client, alice, async (c) => {
      const result = await c.query<{ data: { id: string; reverses: string } }>(
        `select public.reverse_transaction($1, 'wrong customer') as data`,
        [reversible.id],
      );
      return result.rows[0]!.data;
    });
    ok("reversal returns a new transaction", Boolean(reversal.id) && reversal.reverses === reversible.id);
    eq(
      "original transaction stays posted",
      await scalar(client, `select status::text from transactions where id = $1`, [reversible.id]),
      "posted",
    );
    eq(
      "reversal mirrors the ledger",
      await scalar(
        client,
        `select count(*) || ':' || coalesce(sum(debit_minor), 0) || ':' || coalesce(sum(credit_minor), 0)
           from ledger_lines where transaction_id = $1`,
        [reversal.id],
      ),
      "2:7000:7000",
    );
    eq(
      "reversal is audited",
      await scalar(
        client,
        `select count(*) from audit_logs where entity = 'transaction' and action = 'transaction.reversed' and entity_id = $1`,
        [reversible.id],
      ),
      "1",
    );
    eq(
      "double reversal is blocked",
      (await expectError(client, "authenticated", alice, `select public.reverse_transaction($1, 'again')`, [reversible.id]))
        ?.code,
      "23514",
    );
    eq(
      "cross-tenant reversal is rejected",
      (await expectError(client, "authenticated", dora, `select public.reverse_transaction($1, 'nope')`, [reversible.id]))
        ?.code,
      "42501",
    );

    console.log("\nPhase 3 · new table isolation");
    eq(
      "cross-tenant budgets are rejected",
      (await expectError(
        client,
        "authenticated",
        dora,
        `insert into budgets (workspace_id, name, period_start, period_end, amount_minor)
         values ($1, 'Sneaky budget', current_date, current_date + 30, 1000)`,
        [idA],
      ))?.code,
      "42501",
    );
    ok(
      "managers can budget",
      Boolean(
        await commitAs(client, alice, async (c) =>
          scalar(
            c,
            `with inserted as (
               insert into budgets (workspace_id, name, period_start, period_end, amount_minor)
               values ($1, 'Monthly spend', current_date, current_date + 30, 250000) returning id
             ) select id from inserted`,
            [idA],
          ),
        ),
      ),
    );
    eq(
      "cross-tenant inventory is rejected",
      (await expectError(
        client,
        "authenticated",
        dora,
        `insert into inventory_items (workspace_id, sku, name) values ($1, 'SKU-1', 'Hidden stock')`,
        [idA],
      ))?.code,
      "42501",
    );
    eq(
      "AI suggestions stay inside the workspace",
      await (async () => {
        await client.query(
          `insert into ai_suggestions (workspace_id, kind, title, body) values ($1, 'cashflow', 'Cash is tight', 'Collect receivables')`,
          [idA],
        );
        return asDora(`select count(*) from ai_suggestions where workspace_id = $1`, [idA]);
      })(),
      "0",
    );
    eq(
      "offline sync records are user scoped",
      await (async () => {
        await commitAs(client, alice, async (c) => {
          await c.query(
            `insert into offline_sync_records (workspace_id, user_id, device_id, client_generated_id, entity)
             values ($1, $2, 'device-a', 'offline-1', 'transaction')`,
            [idA, ALICE],
          );
        });
        return asDora(`select count(*) from offline_sync_records where workspace_id = $1`, [idA]);
      })(),
      "0",
    );
    eq(
      "cross-tenant notification preferences are rejected",
      (await expectError(
        client,
        "authenticated",
        dora,
        `insert into notification_preferences (workspace_id, user_id, channel) values ($1, $2, 'email')`,
        [idA, ALICE],
      ))?.code,
      "42501",
    );
    eq(
      "service-only tables have no authenticated access",
      (await expectError(client, "authenticated", alice, `select count(*) from payment_webhooks`))?.code,
      "42501",
    );
    eq(
      "payment refunds are service-only",
      (await expectError(client, "authenticated", alice, `select count(*) from payment_refunds`))?.code,
      "42501",
    );
    eq(
      "payment webhooks reject direct writes from authenticated users",
      (await expectError(
        client,
        "authenticated",
        alice,
        `insert into payment_webhooks (provider, external_event_id, payload) values ('mtn_momo', 'x', '{}'::jsonb)`,
      ))?.code,
      "42501",
    );
    eq(
      "anon cannot read new tables",
      (await expectError(client, "anon", null, `select count(*) from invoices`))?.code,
      "42501",
    );

    eq(
      "contact messages are service-only",
      (await expectError(client, "authenticated", alice, `select count(*) from contact_messages`))?.code,
      "42501",
    );
    await asRole(
      client,
      "service_role",
      null,
      async (c) => {
        await c.query(
          `insert into contact_messages (name, email, company, topic, message, locale)
           values ('Awa Nkeng', 'awa@example.cm', 'Awa Traders', 'sales', 'Please show me the Growth plan.', 'en')`,
        );
      },
      true,
    );
    eq(
      "contact messages are stored for operations",
      await scalar(client, `select count(*) from contact_messages where email = 'awa@example.cm'`),
      "1",
    );
    eq(
      "contact messages validate the email",
      (await expectError(
        client,
        "service_role",
        null,
        `insert into contact_messages (name, email, message) values ('Bad', 'not-an-email', 'This should fail.')`,
        [],
        { commit: true },
      ))?.code,
      "23514",
    );

    console.log("\nPhase 3 · security coverage");
    eq(
      "every public table has RLS enabled",
      await scalar(
        client,
        `select count(*) from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
      ),
      "0",
    );
    eq(
      "every tenant table is reachable by a policy or is service-only",
      await scalar(
        client,
        `select coalesce(string_agg(c.relname, ', '), '') from pg_class c
           join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
            and not exists (
              select 1 from pg_policies p where p.schemaname = 'public' and p.tablename = c.relname
            )
            and c.relname not in ('ussd_sessions', 'webhook_events', 'payment_webhooks', 'payment_refunds', 'otp_verifications', 'idempotency_records', 'contact_messages', 'platform_admin_audit_log', 'platform_settings', 'trial_grants', 'trial_reminder_log', 'report_deliveries')`,
      ),
      "",
    );
    eq(
      "compatibility views run with the caller's rights",
      await scalar(
        client,
        `select count(*) from pg_class
          where relname in ('financial_accounts', 'customers', 'suppliers', 'transaction_categories', 'business_categories')
            and reloptions @> array['security_invoker=true']`,
      ),
      "5",
    );
    eq(
      "views respect tenant isolation",
      await asDora(`select count(*) from financial_accounts where workspace_id = $1`, [idA]),
      "0",
    );
    ok(
      "owner sees their accounts through the view",
      Number(await asAlice(`select count(*) from financial_accounts where workspace_id = $1`, [idA])) > 0,
    );

    console.log("\nPhase 4 · identity and onboarding");
    await client.query(
      `insert into auth.users (id, email, phone, raw_user_meta_data)
       values ($1, 'eve@example.com', $2, $3::jsonb)`,
      [
        EVE,
        "+237699000111",
        JSON.stringify({
          first_name: "Eve",
          last_name: "Manga",
          phone: "+237699000111",
          country: "CM",
          locale: "fr",
          privacy_accepted: true,
          privacy_policy_version: "2026-01-01",
          marketing_opt_in: false,
        }),
      ],
    );

    eq("new profile keeps the person's name", await scalar(client, `select full_name from profiles where id = $1`, [EVE]), "Eve Manga");
    eq("new profile stores the phone", await scalar(client, `select phone from profiles where id = $1`, [EVE]), "+237699000111");
    eq("new profile is not email verified", await scalar(client, `select email_verified_at from profiles where id = $1`, [EVE]), "");
    eq("new profile is not phone verified", await scalar(client, `select phone_verified_at from profiles where id = $1`, [EVE]), "");
    eq(
      "new profile requires verification",
      await scalar(client, `select verification_required from profiles where id = $1`, [EVE]),
      "true",
    );
    eq(
      "privacy consent is recorded",
      await scalar(
        client,
        `select count(*) from privacy_consents where user_id = $1 and consent_type = 'privacy' and granted`,
        [EVE],
      ),
      "1",
    );

    const selfVerification = await expectError(
      client,
      "authenticated",
      eve,
      `update profiles set phone_verified_at = now() where id = $1`,
      [EVE],
    );
    ok(
      "users cannot mark their own phone verified",
      Boolean(selfVerification?.message.includes("permission denied")),
      selfVerification,
    );
    const selfOnboarding = await expectError(
      client,
      "authenticated",
      eve,
      `update profiles set onboarding_completed_at = now(), verification_required = false where id = $1`,
      [EVE],
    );
    ok(
      "users cannot clear the verification requirement",
      Boolean(selfOnboarding?.message.includes("permission denied")),
      selfOnboarding,
    );
    ok(
      "users can still edit their own display name",
      Boolean(
        await commitAs(client, eve, async (c) => {
          const result = await c.query(`update profiles set full_name = 'Eve Manga' where id = $1`, [EVE]);
          return result.rowCount === 1;
        }),
      ),
    );

    const unverifiedWorkspace = await expectError(
      client,
      "authenticated",
      eve,
      `select public.create_workspace('Bypass Boutique', 'XAF', 'CM', 'Africa/Douala', null, 'fr')`,
    );
    ok(
      "unverified user cannot create a workspace directly",
      Boolean(unverifiedWorkspace?.message.includes("Verify your email and phone")),
      unverifiedWorkspace,
    );

    const onboardingBeforeVerification = await expectError(
      client,
      "authenticated",
      eve,
      `select public.complete_onboarding('Bypass Boutique', 'sole_proprietorship', 'Yaoundé', 'retail', 'micro', 'XAF', 1, 'CM', '+237699000111', 'Africa/Douala', 'fr', null)`,
    );
    ok(
      "unverified user cannot finish onboarding",
      Boolean(onboardingBeforeVerification?.message.match(/verification/i)),
      onboardingBeforeVerification,
    );

    const codeHash = "a".repeat(64);
    const requested = await commitAs(client, eve, async (c) => {
      const result = await c.query<{ status: string }>(
        `select (public.request_phone_verification($1) ->> 'status') as status`,
        [codeHash],
      );
      return result.rows[0]!.status;
    });
    eq("phone code is stored", requested, "sent");

    const cooldown = await commitAs(client, eve, async (c) => {
      const result = await c.query<{ status: string }>(
        `select (public.request_phone_verification($1) ->> 'status') as status`,
        ["b".repeat(64)],
      );
      return result.rows[0]!.status;
    });
    eq("immediate resend is cooled down", cooldown, "cooldown");

    const wrongCode = await commitAs(client, eve, async (c) => {
      const result = await c.query<{ status: string; attempts_remaining: number }>(
        `select result ->> 'status' as status,
                (result ->> 'attempts_remaining')::integer as attempts_remaining
         from (select public.verify_phone_verification($1) as result) verification`,
        ["b".repeat(64)],
      );
      return result.rows[0]!;
    });
    eq("a wrong code is rejected", wrongCode.status, "invalid");
    eq("a wrong code consumes one attempt", wrongCode.attempts_remaining, 4);
    eq(
      "a wrong code does not verify the phone",
      await scalar(client, `select phone_verified_at from profiles where id = $1`, [EVE]),
      "",
    );

    const verified = await commitAs(client, eve, async (c) => {
      const result = await c.query<{ status: string }>(
        `select (public.verify_phone_verification($1) ->> 'status') as status`,
        [codeHash],
      );
      return result.rows[0]!.status;
    });
    eq("the matching code verifies the phone", verified, "verified");
    ok(
      "phone verification timestamp is set",
      Boolean(await scalar(client, `select phone_verified_at from profiles where id = $1`, [EVE])),
    );

    const stillUnverified = await expectError(
      client,
      "authenticated",
      eve,
      `select public.create_workspace('Bypass Boutique', 'XAF', 'CM', 'Africa/Douala', null, 'fr')`,
    );
    ok(
      "phone-only verification is not enough",
      Boolean(stillUnverified?.message.includes("Verify your email and phone")),
      stillUnverified,
    );

    await client.query(`update auth.users set email_confirmed_at = now() where id = $1`, [EVE]);
    ok(
      "email confirmation mirrors into the profile",
      Boolean(await scalar(client, `select email_verified_at from profiles where id = $1`, [EVE])),
    );

    const onboarded = await commitAs(client, eve, async (c) => {
      const result = await c.query<{ data: { id: string } }>(
        `select public.complete_onboarding(
           'Manga Boutique', 'sole_proprietorship', 'Yaoundé', 'retail', 'micro',
           'XAF', 1, 'CM', '+237699000111', 'Africa/Douala', 'fr', 'Ets Manga'
         ) as data`,
      );
      return result.rows[0]!.data;
    });
    const eveWorkspace = onboarded.id;
    ok("verified user finishes onboarding", Boolean(eveWorkspace));
    eq("onboarding stores the business name", await scalar(client, `select name from workspaces where id = $1`, [eveWorkspace]), "Manga Boutique");
    eq("onboarding stores the legal name", await scalar(client, `select legal_name from workspaces where id = $1`, [eveWorkspace]), "Ets Manga");
    eq("onboarding stores the business type", await scalar(client, `select business_type from workspaces where id = $1`, [eveWorkspace]), "sole_proprietorship");
    eq("onboarding stores the industry", await scalar(client, `select industry from workspaces where id = $1`, [eveWorkspace]), "retail");
    eq("onboarding stores the business size", await scalar(client, `select business_size from workspaces where id = $1`, [eveWorkspace]), "micro");
    eq("onboarding stores the city", await scalar(client, `select city from workspaces where id = $1`, [eveWorkspace]), "Yaoundé");
    eq("onboarding stores the business phone", await scalar(client, `select phone from workspaces where id = $1`, [eveWorkspace]), "+237699000111");
    eq("onboarding stores the locale", await scalar(client, `select locale from profiles where id = $1`, [EVE]), "fr");
    ok(
      "onboarding records the completion time",
      Boolean(await scalar(client, `select onboarding_completed_at from profiles where id = $1`, [EVE])),
    );
    eq(
      "onboarding makes the user the workspace owner",
      await scalar(client, `select role from workspace_members where workspace_id = $1 and user_id = $2`, [eveWorkspace, EVE]),
      "owner",
    );
    eq(
      "onboarding seeds the ledger",
      await scalar(client, `select count(*) from accounts where workspace_id = $1`, [eveWorkspace]),
      "8",
    );

    console.log("\nPhase 13 · plans, trials and entitlements");
    eq(
      "a new workspace starts on the starter trial plan",
      await scalar(
        client,
        `select p.code from subscriptions s join subscription_plans p on p.id = s.trial_plan_id where s.workspace_id = $1`,
        [eveWorkspace],
      ),
      "starter",
    );
    eq(
      "starter is the configured trial plan",
      await scalar(client, `select value ->> 'trial_plan_code' from platform_settings where key = 'billing'`),
      "starter",
    );
    eq(
      "the starter trial keeps the starter transaction limit",
      await asRole(client, "service_role", null, (c) =>
        scalar(c, `select app.workspace_limit($1, 'transaction')::text`, [eveWorkspace]),
      ),
      "500",
    );
    eq(
      "starter trial entitlements exclude advanced analytics",
      await commitAs(client, eve, (c) =>
        scalar(c, `select public.has_workspace_feature($1, 'advanced_analytics')::text`, [eveWorkspace]),
      ),
      "false",
    );
    eq(
      "starter trial entitlements include daily reports",
      await commitAs(client, eve, (c) =>
        scalar(c, `select public.has_workspace_feature($1, 'daily_reports')::text`, [eveWorkspace]),
      ),
      "true",
    );
    eq(
      "starter trial entitlements include weekly reports",
      await commitAs(client, eve, (c) =>
        scalar(c, `select public.has_workspace_feature($1, 'weekly_reports')::text`, [eveWorkspace]),
      ),
      "true",
    );
    eq(
      "starter trial entitlements include monthly reports",
      await commitAs(client, eve, (c) =>
        scalar(c, `select public.has_workspace_feature($1, 'monthly_reports')::text`, [eveWorkspace]),
      ),
      "true",
    );
    eq(
      "starter trial entitlements exclude invoicing",
      await commitAs(client, eve, (c) =>
        scalar(c, `select public.has_workspace_feature($1, 'invoice_management')::text`, [eveWorkspace]),
      ),
      "false",
    );
    eq(
      "an active trial is writable",
      await asRole(client, "service_role", null, (c) =>
        scalar(c, `select app.workspace_read_only($1)::text`, [eveWorkspace]),
      ),
      "false",
    );
    eq(
      "starter trials can consume CSV exports",
      await commitAs(client, eve, (c) =>
        scalar(c, `select public.consume_quota($1, 'export', 0)::text`, [eveWorkspace]),
      ),
      "true",
    );
    eq(
      "growth includes daily reports",
      await asRole(client, "service_role", null, (c) =>
        scalar(
          c,
          `select pf.included::text
             from plan_features pf
             join subscription_features f on f.id = pf.feature_id
             join subscription_plans p on p.id = pf.plan_id
            where p.code = 'growth' and f.code = 'daily_reports'`,
        ),
      ),
      "true",
    );
    eq(
      "growth includes weekly reports",
      await asRole(client, "service_role", null, (c) =>
        scalar(
          c,
          `select pf.included::text
             from plan_features pf
             join subscription_features f on f.id = pf.feature_id
             join subscription_plans p on p.id = pf.plan_id
            where p.code = 'growth' and f.code = 'weekly_reports'`,
        ),
      ),
      "true",
    );
    await asRole(
      client,
      "service_role",
      null,
      async (c) => {
        await c.query(`update subscriptions set trial_ends_at = now() - interval '1 hour' where workspace_id = $1`, [eveWorkspace]);
      },
      true,
    );
    eq(
      "an ended trial is read-only",
      await asRole(client, "service_role", null, (c) =>
        scalar(c, `select app.workspace_read_only($1)::text`, [eveWorkspace]),
      ),
      "true",
    );
    eq(
      "an ended trial loses feature access",
      await commitAs(client, eve, (c) =>
        scalar(c, `select public.has_workspace_feature($1, 'advanced_analytics')::text`, [eveWorkspace]),
      ),
      "false",
    );
    ok(
      "the expiry job moves the subscription to past due",
      Number(
        await asRole(client, "service_role", null, (c) => scalar(c, `select public.expire_trials()`), true),
      ) >= 1,
    );
    eq(
      "the expired subscription is past due",
      await scalar(client, `select status::text from subscriptions where workspace_id = $1`, [eveWorkspace]),
      "past_due",
    );
    eq(
      "expired trials cannot write transactions",
      (
        await expectError(
          client,
          "service_role",
          null,
          `select app.assert_transaction_limit($1)`,
          [eveWorkspace],
          { commit: true },
        )
      )?.code,
      "42501",
    );

    console.log("\nPhase 14 · mobile money payment lifecycle");
    const paymentWorkspace = workspacePcm.id;
    const growthPrice = await scalar(
      client,
      `select price_minor::text from subscription_plans where code = 'growth'`,
    );
    const paymentMerchantRef = "KF-TESTPAYMENT0001";
    const paymentTokenHash = "a".repeat(64);
    const paymentIdempotency = "11111111-1111-4111-8111-111111111111";
    const paymentIntent = await asRole(
      client,
      "service_role",
      null,
      async (c) => {
        const result = await c.query<{
          data: { payment_id: string; status: string; amount_minor: string; reused: boolean };
        }>(
          `select public.create_payment_intent(
             $1, 'growth', 'mtn_momo', '237671234567', $2, $3, $4, $5, now() + interval '20 minutes'
           ) as data`,
          [paymentWorkspace, paymentIdempotency, paymentMerchantRef, paymentTokenHash, ALICE],
        );
        return result.rows[0]!.data;
      },
      true,
    );
    eq("a pending payment intent is created", paymentIntent.status, "pending");
    eq("the intent uses the catalogue price", String(paymentIntent.amount_minor), growthPrice);
    eq(
      "the payment intent is reused for the same idempotency key",
      await asRole(client, "service_role", null, (c) =>
        scalar(
          c,
          `select (public.create_payment_intent(
             $1, 'growth', 'mtn_momo', '237671234567', $2, $3, $4, $5, now() + interval '20 minutes'
           ) ->> 'reused')`,
          [paymentWorkspace, paymentIdempotency, paymentMerchantRef, paymentTokenHash, ALICE],
        ),
      ),
      "true",
    );
    eq(
      "authenticated users cannot execute payment RPCs",
      (
        await expectError(
          client,
          "authenticated",
          alice,
          `select public.create_payment_intent($1, 'growth', 'mtn_momo', null, null, 'KF-NOTALLOWED', repeat('b', 64), $2, now() + interval '20 minutes')`,
          [paymentWorkspace, ALICE],
        )
      )?.code,
      "42501",
    );
    eq(
      "authenticated users cannot insert payment rows",
      (
        await expectError(
          client,
          "authenticated",
          alice,
          `insert into payment_transactions
             (workspace_id, provider, merchant_reference, amount_minor, currency, status)
           values ($1, 'mtn_momo', 'KF-NOTALLOWED', 100, 'XAF', 'pending')`,
          [paymentWorkspace],
        )
      )?.code,
      "42501",
    );
    await asRole(
      client,
      "service_role",
      null,
      async (c) => {
        await c.query(
          `select public.mark_payment_initiated($1, 'mtn-ref-1', null, 'PENDING', '{}'::jsonb)`,
          [paymentIntent.payment_id],
        );
      },
      true,
    );
    eq(
      "a payment with a provider reference is processing",
      await scalar(client, `select status::text from payment_transactions where id = $1`, [paymentIntent.payment_id]),
      "processing",
    );
    eq(
      "a mismatched amount cannot activate the plan",
      (
        await expectError(
          client,
          "service_role",
          null,
          `select public.confirm_payment($1, 'mtn-ref-1', now(), $2, 'XAF', 'SUCCESSFUL', '{}'::jsonb)`,
          [paymentIntent.payment_id, Number(growthPrice) + 1],
          { commit: true },
        )
      )?.code,
      "23514",
    );
    const confirmation = await asRole(
      client,
      "service_role",
      null,
      async (c) => {
        const result = await c.query<{ data: { duplicate: boolean; status: string } }>(
          `select public.confirm_payment($1, 'mtn-ref-1', now(), $2, 'XAF', 'SUCCESSFUL', '{}'::jsonb) as data`,
          [paymentIntent.payment_id, Number(growthPrice)],
        );
        return result.rows[0]!.data;
      },
      true,
    );
    eq("the verified payment activates the subscription", confirmation.status, "succeeded");
    eq(
      "the subscription is active on the paid plan",
      await scalar(client, `select status::text || ':' || plan::text from subscriptions where workspace_id = $1`, [paymentWorkspace]),
      "active:growth",
    );
    eq(
      "the workspace plan follows the payment",
      await scalar(client, `select plan::text from workspaces where id = $1`, [paymentWorkspace]),
      "growth",
    );
    eq(
      "the cron service role can check report entitlements",
      await asRole(client, "service_role", null, (c) =>
        scalar(c, `select public.has_workspace_feature($1, 'daily_reports')::text`, [paymentWorkspace]),
      ),
      "true",
    );
    eq(
      "payment success writes an audit entry",
      await scalar(
        client,
        `select count(*) from audit_logs where workspace_id = $1 and action = 'payment.succeeded'`,
        [paymentWorkspace],
      ),
      "1",
    );
    eq(
      "payment success writes one in-app notification",
      await scalar(
        client,
        `select count(*) from notifications where workspace_id = $1 and data ->> 'kind' = 'payment_succeeded'`,
        [paymentWorkspace],
      ),
      "1",
    );
    eq(
      "duplicate confirmation is idempotent",
      await asRole(client, "service_role", null, (c) =>
        scalar(
          c,
          `select (public.confirm_payment($1, 'mtn-ref-1', now(), $2, 'XAF', 'SUCCESSFUL', '{}'::jsonb) ->> 'duplicate')`,
          [paymentIntent.payment_id, Number(growthPrice)],
        ),
      ),
      "true",
    );
    eq(
      "duplicate confirmation does not duplicate the notification",
      await scalar(
        client,
        `select count(*) from notifications where workspace_id = $1 and data ->> 'kind' = 'payment_succeeded'`,
        [paymentWorkspace],
      ),
      "1",
    );
    eq(
      "the owner can read the confirmed payment",
      await asRole(client, "authenticated", alice, (c) =>
        scalar(c, `select status::text from payment_transactions where id = $1`, [paymentIntent.payment_id]),
      ),
      "succeeded",
    );
    eq(
      "a full refund moves the payment to refunded",
      await asRole(
        client,
        "service_role",
        null,
        (c) =>
          scalar(
            c,
            `select (public.refund_payment($1, $2, 'mtn-refund-1', 'Customer request', $3, 'refund') ->> 'status')`,
            [paymentIntent.payment_id, Number(growthPrice), ALICE],
          ),
        true,
      ),
      "refunded",
    );
    eq(
      "a full refund cancels renewal at period end",
      await scalar(
        client,
        `select cancel_at_period_end::text from subscriptions where workspace_id = $1`,
        [paymentWorkspace],
      ),
      "true",
    );
    eq(
      "the refund is recorded once",
      await scalar(
        client,
        `select count(*) from payment_refunds where payment_transaction_id = $1`,
        [paymentIntent.payment_id],
      ),
      "1",
    );

    const planEscalation = await expectError(
      client,
      "authenticated",
      eve,
      `update workspaces set plan = 'scale' where id = $1`,
      [eveWorkspace],
    );
    ok(
      "workspace users cannot upgrade their own plan",
      Boolean(planEscalation?.message.includes("permission denied")),
      planEscalation,
    );
    const ownerHijack = await expectError(
      client,
      "authenticated",
      eve,
      `update workspaces set owner_id = $1 where id = $2`,
      [DORA, eveWorkspace],
    );
    ok(
      "workspace users cannot transfer ownership directly",
      Boolean(ownerHijack?.message.includes("permission denied")),
      ownerHijack,
    );

    ok(
      "a user can change their phone number",
      Boolean(
        await commitAs(client, eve, async (c) => {
          const result = await c.query(`update profiles set phone = '+237699000222' where id = $1`, [EVE]);
          return result.rowCount === 1;
        }),
      ),
    );
    eq("a new phone number is stored", await scalar(client, `select phone from profiles where id = $1`, [EVE]), "+237699000222");
    eq(
      "a new phone number loses its verification",
      await scalar(client, `select phone_verified_at from profiles where id = $1`, [EVE]),
      "",
    );
    eq(
      "a new phone number re-arms the verification gate",
      await scalar(client, `select verification_required from profiles where id = $1`, [EVE]),
      "true",
    );

    await client.query(
      `update otp_verifications set created_at = now() - interval '2 hours' where user_id = $1`,
      [EVE],
    );
    const destinationChallenge = await commitAs(client, eve, async (c) => {
      const result = await c.query<{ status: string }>(
        `select (public.request_phone_verification($1) ->> 'status') as status`,
        ["c".repeat(64)],
      );
      return result.rows[0]!.status;
    });
    eq("a fresh challenge is issued for the new number", destinationChallenge, "sent");
    await commitAs(client, eve, async (c) => {
      await c.query(`update profiles set phone = '+237699000333' where id = $1`, [EVE]);
    });
    const staleDestination = await commitAs(client, eve, async (c) => {
      const result = await c.query<{ status: string }>(
        `select (public.verify_phone_verification($1) ->> 'status') as status`,
        ["c".repeat(64)],
      );
      return result.rows[0]!.status;
    });
    eq("a code for the previous number is refused", staleDestination, "phone_changed");
    eq(
      "a stale code does not verify the replacement number",
      await scalar(client, `select phone_verified_at from profiles where id = $1`, [EVE]),
      "",
    );

    console.log("\nPhase 7 · finance operations");
    const starterInvoicePayload = `select public.create_invoice(jsonb_build_object(
      'workspace_id', $1::uuid, 'customer_id', $2::uuid, 'issue_on', current_date, 'due_on', current_date + 7,
      'issue', true, 'items', jsonb_build_array(jsonb_build_object(
        'description', 'Starter invoice', 'quantity', '1', 'unit_price_minor', '5000', 'tax_rate_bp', 0))))`;
    eq(
      "starter workspaces cannot issue invoices",
      (await expectError(client, "authenticated", alice, starterInvoicePayload, [idA, customerA]))?.code,
      "42501",
    );

    await asRole(
      client,
      "service_role",
      null,
      async (c) => {
        await c.query(
          `update subscriptions set plan = 'scale', plan_id = (select id from subscription_plans where code = 'scale'), status = 'active', trial_plan_id = null, trial_ends_at = null where workspace_id = $1`,
          [idA],
        );
      },
      true,
    );
    eq(
      "a scale subscription enables invoicing",
      await commitAs(client, alice, async (c) =>
        scalar(c, `select public.has_workspace_feature($1, 'invoicing')::text`, [idA]),
      ),
      "true",
    );
    const createdInvoice = await commitAs(client, alice, async (c) => {
      const result = await c.query<{ data: { id: string; number: string; total_minor: string; status: string } }>(
        `select public.create_invoice(jsonb_build_object(
           'workspace_id', $1::uuid, 'customer_id', $2::uuid, 'issue_on', current_date, 'due_on', current_date + 7,
           'issue', true, 'items', jsonb_build_array(
             jsonb_build_object('description', 'Fish crates', 'quantity', '2', 'unit_price_minor', '5000', 'tax_rate_bp', 1925),
             jsonb_build_object('description', 'Delivery', 'quantity', '1.5', 'unit_price_minor', '2000', 'tax_rate_bp', 500)
           ))) as data`,
        [idA, customerA],
      );
      return result.rows[0]!.data;
    });
    eq("the invoice RPC returns the derived total", createdInvoice.total_minor, "15075");
    eq("the invoice RPC issues immediately", createdInvoice.status, "sent");
    eq(
      "issuing an invoice opens one receivable",
      await scalar(client, `select count(*) from debts where invoice_id = $1 and direction = 'receivable'`, [createdInvoice.id]),
      "1",
    );
    eq(
      "the invoice view exposes the remaining balance",
      await scalar(client, `select status || ':' || remaining_minor from v_invoices where id = $1`, [createdInvoice.id]),
      "sent:15075",
    );
    const linkedDebt = await scalar(client, `select id from debts where invoice_id = $1`, [createdInvoice.id]);
    const cashAccount = await scalar(
      client,
      `select id from accounts where workspace_id = $1 and subtype = 'cash' and not is_archived order by name limit 1`,
      [idA],
    );
    const cashBefore = await scalar(client, `select balance_minor from v_account_balances where account_id = $1`, [cashAccount]);
    const paymentResult = await commitAs(client, alice, async (c) => {
      const result = await c.query<{ data: { id: string; transaction_id: string | null; status: string } }>(
        `select public.record_debt_payment(jsonb_build_object(
           'debt_id', $1::uuid, 'amount_minor', '1925', 'paid_on', current_date,
           'account_id', $2::uuid, 'payment_method', 'cash', 'reference', 'INV test payment')) as data`,
        [linkedDebt, cashAccount],
      );
      return result.rows[0]!.data;
    });
    eq("the repayment RPC updates the debt", paymentResult.status, "partially_paid");
    ok("the repayment RPC posts a ledger transaction", Boolean(paymentResult.transaction_id));
    eq(
      "the repayment also updates the linked invoice",
      await scalar(client, `select status || ':' || amount_paid_minor || ':' || remaining_minor from v_invoices where id = $1`, [createdInvoice.id]),
      "partially_paid:1925:13150",
    );
    eq(
      "the repayment posts cash into the selected account",
      await scalar(client, `select (select balance_minor from v_account_balances where account_id = $1) - $2::bigint`, [cashAccount, cashBefore]),
      "1925",
    );
    eq(
      "repayments record their ledger transaction",
      await scalar(client, `select kind || ':' || amount_minor from transactions where id = $1`, [paymentResult.transaction_id]),
      "income:1925",
    );
    eq(
      "overpaying a debt is rejected by the RPC",
      (await expectError(
        client,
        "authenticated",
        alice,
        `select public.record_debt_payment(jsonb_build_object('debt_id', $1::uuid, 'amount_minor', '999999'))`,
        [linkedDebt],
      ))?.code,
      "23514",
    );
    eq(
      "a paid invoice cannot be voided",
      (await expectError(
        client,
        "authenticated",
        alice,
        `select public.void_invoice($1, 'test')`,
        [createdInvoice.id],
      ))?.code,
      "23514",
    );

    const draftInvoice = await commitAs(client, alice, async (c) => {
      const result = await c.query<{ data: { id: string; status: string } }>(
        `select public.create_invoice(jsonb_build_object(
           'workspace_id', $1::uuid, 'customer_id', $2::uuid, 'issue_on', current_date, 'due_on', current_date + 3,
           'issue', false, 'items', jsonb_build_array(
             jsonb_build_object('description', 'Draft job', 'quantity', '1', 'unit_price_minor', '2500', 'tax_rate_bp', 0)
           ))) as data`,
        [idA, customerA],
      );
      return result.rows[0]!.data;
    });
    eq("draft invoices start as drafts", draftInvoice.status, "draft");
    await commitAs(client, alice, async (c) => {
      await c.query(`select public.issue_invoice($1::uuid)`, [draftInvoice.id]);
    });
    await commitAs(client, alice, async (c) => {
      await c.query(`select public.void_invoice($1::uuid, 'Cancelled by customer')`, [draftInvoice.id]);
    });
    eq(
      "voiding an unpaid invoice closes its receivable",
      await scalar(
        client,
        `select i.status || ':' || d.status from invoices i join debts d on d.invoice_id = i.id where i.id = $1`,
        [draftInvoice.id],
      ),
      "void:written_off",
    );

    await commitAs(client, alice, async (c) => {
      await c.query(
        `insert into budgets (workspace_id, name, period_start, period_end, amount_minor, currency)
         values ($1, 'Phase 7 budget', date_trunc('month', current_date)::date,
                 (date_trunc('month', current_date) + interval '1 month - 1 day')::date, 5000, 'XAF')`,
        [idA],
      );
    });
    ok(
      "budget progress is exposed as a view",
      Boolean(
        await scalar(
          client,
          `select amount_minor || ':' || (spent_minor >= 0) from v_budget_progress where workspace_id = $1 and name = 'Phase 7 budget'`,
          [idA],
        ),
      ),
    );
    const phase7Dashboard = await commitAs(client, alice, async (c) => {
      const result = await c.query<{ data: Record<string, unknown> }>(
        `select public.get_dashboard_summary($1, $2::date - 30, $2::date) as data`,
        [idA, todayA],
      );
      return result.rows[0]!.data;
    });
    ok("the dashboard reports receivables", BigInt(String(phase7Dashboard.outstandingReceivablesMinor)) >= 13_150n);
    eq("the dashboard reports budget progress", Array.isArray(phase7Dashboard.budgetProgress), true);
    eq(
      "other tenants cannot read the invoice view",
      await asDora(`select count(*) from v_invoices where workspace_id = $1`, [idA]),
      "0",
    );

    console.log("\nPhase 8 · AI bookkeeping");
    eq(
      "Food and Water categories are available for AI mapping",
      await scalar(client, `select string_agg(name, ',' order by name) from categories where workspace_id = $1 and name in ('Food','Water')`, [idA]),
      "Food,Water",
    );
    eq(
      "AI auto-post is off by default",
      await scalar(client, `select ai_auto_post::text from business_settings where workspace_id = $1`, [idA]),
      "false",
    );
    eq(
      "AI auto-post limit defaults to 5000 FCFA",
      await scalar(client, `select ai_auto_post_max_minor::text from business_settings where workspace_id = $1`, [idA]),
      "5000",
    );

    const cashA = await scalar(client, `select id from accounts where workspace_id = $1 and subtype = 'cash'`, [idA]);
    const transportA = await scalar(client, `select id from categories where workspace_id = $1 and name = 'Transport'`, [idA]);
    const foodA = await scalar(client, `select id from categories where workspace_id = $1 and name = 'Food'`, [idA]);
    const waterA = await scalar(client, `select id from categories where workspace_id = $1 and name = 'Water'`, [idA]);

    const transactionPreview = (description: string, amount: string, categoryId: string, categoryName: string) => ({
      type: "transaction",
      kind: "expense",
      amountMinor: amount,
      currency: "XAF",
      description,
      categoryId,
      categoryName,
      accountId: cashA,
      accountName: "Cash",
      counterAccountId: null,
      counterAccountName: null,
      contactId: null,
      contactName: null,
      occurredOn: todayA,
      paymentMethod: "cash",
    });

    const createAiCommand = async (
      user: { sub: string; email: string; role: string },
      workspaceId: string,
      requestId: string,
      actions: unknown[],
      autoPostEligible = false,
    ) => {
      return commitAs(client, user, async (c) => {
        const result = await c.query<{ id: string }>(
          `insert into ai_commands
             (workspace_id, user_id, request_id, command_text, reply, locale, interpretation, preview)
           values ($1, $2, $3, 'test command', 'Review this draft.', 'en', '{}'::jsonb, $4::jsonb)
           returning id`,
          [
            workspaceId,
            user.sub,
            requestId,
            JSON.stringify({
              version: 1,
              actions,
              warnings: [],
              autoPostEligible,
            }),
          ],
        );
        return result.rows[0]!.id;
      });
    };

    const commandA = await createAiCommand(
      alice,
      idA,
      "phase8-transactions-1",
      [
        transactionPreview("Transport", "500", transportA, "Transport"),
        transactionPreview("Food", "1000", foodA, "Food"),
        transactionPreview("Water", "200", waterA, "Water"),
      ],
      true,
    );
    ok("an AI draft can hold several transactions", Boolean(commandA));
    eq(
      "another tenant cannot read an AI draft",
      await asBob(`select count(*) from ai_commands where workspace_id = $1`, [idA]),
      "0",
    );
    const directEdit = await expectError(
      client,
      "authenticated",
      alice,
      `update ai_commands set preview = '{}'::jsonb where id = $1`,
      [commandA],
    );
    ok("AI drafts cannot be edited directly", directEdit?.code === "42501", directEdit);
    const crossConfirm = await expectError(
      client,
      "authenticated",
      dora,
      `select public.confirm_ai_command($1, false)`,
      [commandA],
    );
    ok("another tenant cannot confirm an AI draft", crossConfirm?.code === "42501", crossConfirm);
    const otherMemberConfirm = await expectError(
      client,
      "authenticated",
      bob,
      `select public.confirm_ai_command($1, false)`,
      [commandA],
    );
    ok("another member cannot confirm someone else's AI draft", otherMemberConfirm?.code === "42501", otherMemberConfirm);

    const dismissCommand = await createAiCommand(
      alice,
      idA,
      "phase8-dismiss-1",
      [transactionPreview("Dismiss me", "300", transportA, "Transport")],
    );
    await commitAs(client, alice, async (c) => {
      await c.query(`select public.set_ai_command_reply($1, 'Updated AI reply')`, [dismissCommand]);
    });
    eq(
      "the AI reply can be updated by its creator",
      await scalar(client, `select reply from ai_commands where id = $1`, [dismissCommand]),
      "Updated AI reply",
    );
    const otherMemberDismiss = await expectError(
      client,
      "authenticated",
      bob,
      `select public.dismiss_ai_command($1)`,
      [dismissCommand],
    );
    ok("another member cannot discard someone else's AI draft", otherMemberDismiss?.code === "42501", otherMemberDismiss);
    const dismissResult = await commitAs(client, alice, async (c) => {
      const result = await c.query<{ data: Record<string, unknown> }>(
        `select public.dismiss_ai_command($1) as data`,
        [dismissCommand],
      );
      return result.rows[0]!.data;
    });
    eq("an AI draft can be discarded", dismissResult.status, "dismissed");
    const dismissAgain = await commitAs(client, alice, async (c) => {
      const result = await c.query<{ data: Record<string, unknown> }>(
        `select public.dismiss_ai_command($1) as data`,
        [dismissCommand],
      );
      return result.rows[0]!.data;
    });
    eq("discard is idempotent", dismissAgain.already_dismissed, true);

    const confirmA = await commitAs(client, alice, async (c) => {
      const result = await c.query<{ data: Record<string, unknown> }>(
        `select public.confirm_ai_command($1, false) as data`,
        [commandA],
      );
      return result.rows[0]!.data;
    });
    eq("AI confirmation reports posted", confirmA.status, "confirmed");
    eq("AI confirmation returns three ledger transactions", (confirmA.transactions as string[]).length, 3);
    eq(
      "AI confirmation creates three transactions",
      await scalar(
        client,
        `select count(*) from transactions where workspace_id = $1 and client_generated_id like $2`,
        [idA, `ai:${commandA}:%`],
      ),
      "3",
    );
    eq(
      "AI transactions are in the ai channel",
      await scalar(
        client,
        `select count(*) from transactions where workspace_id = $1 and client_generated_id like $2 and channel = 'ai'`,
        [idA, `ai:${commandA}:%`],
      ),
      "3",
    );
    eq(
      "AI transactions are balanced",
      await scalar(
        client,
        `select (sum(debit_minor) = sum(credit_minor))::text from ledger_lines where transaction_id in (
           select id from transactions where workspace_id = $1 and client_generated_id like $2
         )`,
        [idA, `ai:${commandA}:%`],
      ),
      "true",
    );
    eq(
      "AI confirmation is audited",
      await scalar(client, `select count(*) from audit_logs where workspace_id = $1 and action = 'ai.command_confirmed' and entity_id = $2`, [idA, commandA]),
      "1",
    );

    const confirmAgain = await commitAs(client, alice, async (c) => {
      const result = await c.query<{ data: Record<string, unknown> }>(
        `select public.confirm_ai_command($1, false) as data`,
        [commandA],
      );
      return result.rows[0]!.data;
    });
    eq("confirmation is idempotent", confirmAgain.already_confirmed, true);
    eq(
      "idempotent confirmation does not duplicate entries",
      await scalar(
        client,
        `select count(*) from transactions where workspace_id = $1 and client_generated_id like $2`,
        [idA, `ai:${commandA}:%`],
      ),
      "3",
    );

    await commitAs(client, alice, async (c) => {
      await c.query(
        `update business_settings set ai_auto_post = true, ai_auto_post_max_minor = 5000 where workspace_id = $1`,
        [idA],
      );
    });
    eq(
      "workspace owners can enable AI auto-post",
      await scalar(client, `select ai_auto_post::text from business_settings where workspace_id = $1`, [idA]),
      "true",
    );

    const autoCommand = await createAiCommand(
      alice,
      idA,
      "phase8-auto-1",
      [transactionPreview("Auto transport", "500", transportA, "Transport")],
      true,
    );
    await commitAs(client, alice, async (c) => {
      await c.query(`select public.confirm_ai_command($1, true)`, [autoCommand]);
    });
    eq(
      "auto-posted commands are marked",
      await scalar(client, `select auto_posted::text from ai_commands where id = $1`, [autoCommand]),
      "true",
    );

    const undoA = await commitAs(client, alice, async (c) => {
      const result = await c.query<{ data: Record<string, unknown> }>(
        `select public.undo_ai_command($1, 'Wrong entry') as data`,
        [commandA],
      );
      return result.rows[0]!.data;
    });
    eq("AI commands can be undone", undoA.status, "reversed");
    eq("undo creates one reversal per entry", (undoA.reversals as unknown[]).length, 3);
    eq(
      "undo creates one linked reversal per AI entry",
      await scalar(
        client,
        `select count(*) from transactions
         where workspace_id = $1
           and reverses_transaction_id in (
             select id from transactions where workspace_id = $1 and client_generated_id like $2
           )`,
        [idA, `ai:${commandA}:%`],
      ),
      "3",
    );
    eq(
      "the AI command records its reversal state",
      await scalar(client, `select status from ai_commands where id = $1`, [commandA]),
      "reversed",
    );
    const undoAgain = await commitAs(client, alice, async (c) => {
      const result = await c.query<{ data: Record<string, unknown> }>(
        `select public.undo_ai_command($1, 'Again') as data`,
        [commandA],
      );
      return result.rows[0]!.data;
    });
    eq("undo is idempotent", undoAgain.already_reversed, true);

    const debtCommand = await createAiCommand(alice, idA, "phase8-debt-1", [
      {
        type: "debt",
        direction: "receivable",
        contactId: customerA,
        contactName: "Mami Fish",
        description: "Phase 8 credit sale",
        amountMinor: "1500",
        currency: "XAF",
        openedOn: todayA,
        dueOn: null,
        notes: null,
      },
    ]);
    const debtConfirm = await commitAs(client, alice, async (c) => {
      const result = await c.query<{ data: Record<string, unknown> }>(
        `select public.confirm_ai_command($1, false) as data`,
        [debtCommand],
      );
      return result.rows[0]!.data;
    });
    const aiDebtId = (debtConfirm.debts as string[])[0]!;
    eq(
      "AI can prepare a receivable",
      await scalar(client, `select principal_minor::text || ':' || status from debts where id = $1`, [aiDebtId]),
      "1500:open",
    );

    const paymentCommand = await createAiCommand(alice, idA, "phase8-payment-1", [
      {
        type: "debt_payment",
        debtId: aiDebtId,
        debtDescription: "Phase 8 credit sale",
        contactId: customerA,
        contactName: "Mami Fish",
        amountMinor: "500",
        currency: "XAF",
        paidOn: todayA,
        accountId: cashA,
        accountName: "Cash",
        paymentMethod: "cash",
      },
    ]);
    const paymentConfirm = await commitAs(client, alice, async (c) => {
      const result = await c.query<{ data: Record<string, unknown> }>(
        `select public.confirm_ai_command($1, false) as data`,
        [paymentCommand],
      );
      return result.rows[0]!.data;
    });
    eq("AI repayment returns a ledger transaction", (paymentConfirm.transactions as string[]).length, 1);
    eq(
      "AI repayment updates the debt",
      await scalar(client, `select paid_minor::text || ':' || status from debts where id = $1`, [aiDebtId]),
      "500:partially_paid",
    );
    eq(
      "AI repayment creates a debt payment record",
      await scalar(client, `select count(*) from debt_payments where debt_id = $1`, [aiDebtId]),
      "1",
    );

    const staffContactB = await commitAs(client, bob, async (c) => {
      const result = await c.query<{ id: string }>(
        `insert into contacts (workspace_id, kind, name) values ($1, 'customer', 'Staff Customer') returning id`,
        [idB],
      );
      return result.rows[0]!.id;
    });
    const staffDebtCommand = await createAiCommand(
      charlie,
      idB,
      "phase8-staff-debt-1",
      [
        {
          type: "debt",
          direction: "receivable",
          contactId: staffContactB,
          contactName: "Staff Customer",
          description: "Staff draft",
          amountMinor: "1000",
          currency: "XAF",
          openedOn: todayA,
          dueOn: null,
          notes: null,
        },
      ],
    );
    const staffDebtConfirm = await expectError(
      client,
      "authenticated",
      charlie,
      `select public.confirm_ai_command($1, false)`,
      [staffDebtCommand],
    );
    ok("staff cannot post AI-created debts", staffDebtConfirm?.code === "42501", staffDebtConfirm);

    console.log("\nPhase 9 · AI preferences and business intelligence");
    eq(
      "AI preferences auto-provision for a new workspace",
      await scalar(client, `select count(*) from ai_workspace_preferences where workspace_id = $1`, [idA]),
      "1",
    );
    eq(
      "AI preferences default to insights on and 180 days",
      await scalar(
        client,
        `select insights_enabled::text || ':' || analysis_window_days from ai_workspace_preferences where workspace_id = $1`,
        [idA],
      ),
      "true:180",
    );
    eq(
      "workspace member can read AI preferences",
      await asBob(`select count(*) from ai_workspace_preferences where workspace_id = $1`, [idA]),
      "1",
    );
    eq(
      "outsider cannot read AI preferences",
      await asRole(client, "authenticated", charlie, (c) =>
        scalar(c, `select count(*) from ai_workspace_preferences where workspace_id = $1`, [idA]),
      ),
      "0",
    );

    const nonOwnerPreferences = await expectError(
      client,
      "authenticated",
      bob,
      `select public.update_ai_preferences($1, true, 180, 90, 'balanced', null)`,
      [idA],
    );
    ok("accountant cannot change AI preferences", nonOwnerPreferences?.code === "42501", nonOwnerPreferences);

    const updatedPreferences = await commitAs(client, alice, async (c) => {
      const result = await c.query<{ data: Record<string, unknown> }>(
        `select public.update_ai_preferences($1, false, 90, 90, 'costs', 'We sell building materials and buy stock weekly.') as data`,
        [idA],
      );
      return result.rows[0]!.data;
    });
    eq("owner can disable insights", updatedPreferences.insights_enabled, false);
    eq("owner focus is stored", updatedPreferences.advisor_focus, "costs");
    eq("analysis window is stored", updatedPreferences.analysis_window_days, 90);
    eq(
      "preference change is audited",
      await scalar(client, `select count(*) from audit_logs where workspace_id = $1 and action = 'ai.preferences_updated'`, [idA]),
      "1",
    );

    const disabledIntelligence = await expectError(
      client,
      "authenticated",
      alice,
      `select public.get_business_intelligence($1, current_date - 30, current_date)`,
      [idA],
    );
    ok("disabled insights block the analytics RPC", disabledIntelligence?.code === "42501", disabledIntelligence);

    await commitAs(client, alice, async (c) => {
      const result = await c.query<{ data: Record<string, unknown> }>(
        `select public.update_ai_preferences($1, true, 180, 90, 'balanced', null) as data`,
        [idA],
      );
      return result.rows[0]!.data;
    });

    const aIntelligence = await asRole(client, "authenticated", alice, async (c) => {
      const result = await c.query<{ data: Record<string, unknown> }>(
        `select public.get_business_intelligence($1, $2::date - 30, $2::date) as data`,
        [idA, todayA],
      );
      return result.rows[0]!.data;
    });
    const aReport = await asRole(client, "authenticated", alice, async (c) => {
      const result = await c.query<{ data: Record<string, unknown> }>(
        `select public.get_report($1, $2::date - 30, $2::date) as data`,
        [idA, todayA],
      );
      return result.rows[0]!.data;
    });
    const aTotals = aIntelligence.totals as Record<string, string>;
    const aCoverage = aIntelligence.coverage as Record<string, unknown>;
    eq("intelligence income matches the report", aTotals.incomeMinor, aReport.revenueMinor);
    eq("intelligence expense matches the report", aTotals.expenseMinor, aReport.expenseMinor);
    ok("intelligence counts posted transactions", Number(aCoverage.transactionCount) > 0, aCoverage);
    ok("intelligence returns daily series", Array.isArray(aIntelligence.dailySeries));
    ok("intelligence returns monthly series", Array.isArray(aIntelligence.monthlySeries));
    ok("intelligence returns cash flow", Boolean(aIntelligence.cashFlow));

    const crossTenantIntelligence = await expectError(
      client,
      "authenticated",
      charlie,
      `select public.get_business_intelligence($1, current_date - 30, current_date)`,
      [idA],
    );
    ok("outsider cannot read another tenant's intelligence", crossTenantIntelligence?.code === "42501", crossTenantIntelligence);

    const bIntelligence = await asRole(client, "authenticated", charlie, async (c) => {
      const result = await c.query<{ data: Record<string, unknown> }>(
        `select public.get_business_intelligence($1, $2::date - 30, $2::date) as data`,
        [idB, todayA],
      );
      return result.rows[0]!.data;
    });
    const bTotals = bIntelligence.totals as Record<string, string>;
    eq("staff can read own workspace intelligence", bTotals.incomeMinor, "7000");
    eq("staff intelligence includes own expenses", bTotals.expenseMinor, "3000");

    await commitAs(client, alice, async (c) => {
      await c.query(
        `select public.update_ai_preferences($1, true, 180, 7, 'balanced', null)`,
        [idA],
      );
    });

    const oldConversation = await client.query<{ id: string }>(
      `insert into ai_conversations (workspace_id, user_id, title, created_at, updated_at)
       values ($1, $2, 'Old advisor chat', now() - interval '30 days', now() - interval '30 days') returning id`,
      [idA, ALICE],
    );
    await client.query(
      `insert into ai_messages (conversation_id, workspace_id, role, content, created_at)
       values ($1, $2, 'user', 'Old recorded question', now() - interval '30 days')`,
      [oldConversation.rows[0]!.id, idA],
    );

    eq(
      "retention hides old conversations from the owner",
      await asAlice(`select count(*) from ai_conversations where workspace_id = $1`, [idA]),
      "0",
    );
    eq(
      "retention hides old messages from the owner",
      await asAlice(`select count(*) from ai_messages where workspace_id = $1`, [idA]),
      "0",
    );

    const nonOwnerPurge = await expectError(
      client,
      "authenticated",
      bob,
      `select public.purge_ai_history($1, 7)`,
      [idA],
    );
    ok("accountant cannot purge AI history", nonOwnerPurge?.code === "42501", nonOwnerPurge);

    const purge = await commitAs(client, alice, async (c) => {
      const result = await c.query<{ data: Record<string, unknown> }>(
        `select public.purge_ai_history($1, 7) as data`,
        [idA],
      );
      return result.rows[0]!.data;
    });
    eq("purge reports removed messages", purge.messages, 1);
    eq(
      "purged conversation is gone",
      await scalar(client, `select count(*) from ai_conversations where workspace_id = $1`, [idA]),
      "0",
    );
    eq(
      "purge is audited",
      await scalar(client, `select count(*) from audit_logs where workspace_id = $1 and action = 'ai.history_purged'`, [idA]),
      "1",
    );

    const recentConversation = await client.query<{ id: string }>(
      `insert into ai_conversations (workspace_id, user_id, title) values ($1, $2, 'Recent advisor chat') returning id`,
      [idA, ALICE],
    );
    await client.query(
      `insert into ai_messages (conversation_id, workspace_id, role, content)
       values ($1, $2, 'user', 'Recent recorded question')`,
      [recentConversation.rows[0]!.id, idA],
    );
    eq(
      "recent conversation is visible",
      await asAlice(`select count(*) from ai_conversations where workspace_id = $1`, [idA]),
      "1",
    );

    const purgeAll = await commitAs(client, alice, async (c) => {
      const result = await c.query<{ data: Record<string, unknown> }>(
        `select public.purge_ai_history($1, null, true) as data`,
        [idA],
      );
      return result.rows[0]!.data;
    });
    eq("delete-all purge removes the recent message", purgeAll.messages, 1);
    eq(
      "delete-all purge removes the recent conversation",
      await scalar(client, `select count(*) from ai_conversations where workspace_id = $1`, [idA]),
      "0",
    );
    eq(
      "delete-all purge is audited separately",
      await scalar(client, `select count(*) from audit_logs where workspace_id = $1 and action = 'ai.history_purged'`, [idA]),
      "2",
    );

    console.log("\nPhase 10 · platform administration");
    await client.query(
      `insert into auth.users (id, email, raw_user_meta_data)
       values ($1, 'super@example.com', '{"full_name":"Super Operator"}'::jsonb)`,
      [SUPER],
    );
    await client.query(
      `update profiles set verification_required = false, email_verified_at = now(), phone_verified_at = now()
       where id = $1`,
      [SUPER],
    );
    await client.query(
      `insert into platform_admins (user_id, role, is_active) values ($1, 'super_admin', true)`,
      [SUPER],
    );

    const overview = await commitAs(client, superAdmin, async (c) => {
      const result = await c.query<{ data: Record<string, unknown> }>(
        `select public.platform_admin_overview() as data`,
      );
      return result.rows[0]!.data;
    });
    ok("platform overview reports users", Number(overview.users) >= 5, overview.users);
    ok("platform overview reports workspaces", Number(overview.workspaces) >= 2, overview.workspaces);

    eq(
      "a normal tenant cannot open the platform overview",
      (
        await expectError(
          client,
          "authenticated",
          alice,
          `select public.platform_admin_overview()`,
        )
      )?.code,
      "42501",
    );

    const userList = await commitAs(client, superAdmin, async (c) => {
      const result = await c.query<{ data: { email: string; workspaces: unknown[] }[] }>(
        `select public.platform_admin_list_users('alice', 20, 0) as data`,
      );
      return result.rows[0]!.data;
    });
    eq("platform user search returns the matching account", userList.length, "1");
    eq("platform user search includes tenant list", userList[0]!.workspaces.length, "2");

    eq(
      "platform admin cannot join a tenant",
      (
        await expectError(
          client,
          "authenticated",
          superAdmin,
          `insert into workspace_members (workspace_id, user_id, role, status)
           values ($1, $2, 'staff', 'active')`,
          [idA, SUPER],
          { commit: true },
        )
      )?.code,
      "23514",
    );
    eq(
      "platform admin cannot create a tenant",
      (
        await expectError(
          client,
          "authenticated",
          superAdmin,
          `select public.create_workspace('Admin Co', 'XAF', 'CM', 'Africa/Douala', null, 'en')`,
          [],
          { commit: true },
        )
      )?.code,
      "23514",
    );

    eq(
      "tenant users cannot read the platform administrator directory",
      await asAlice(`select count(*) from platform_admins`),
      "0",
    );
    eq(
      "platform administrators cannot be restricted as tenant accounts",
      (
        await expectError(
          client,
          "authenticated",
          superAdmin,
          `select public.platform_admin_restrict_user(
             $1, 'limited', 'Console operators must be deactivated instead', null, null
           )`,
          [SUPER],
          { commit: true },
        )
      )?.code,
      "23514",
    );

    const restriction = await commitAs(client, superAdmin, async (c) => {
      const result = await c.query<{ data: { id: string } }>(
        `select public.platform_admin_restrict_user(
           $1, 'limited', 'Repeated failed payment reconciliation', now() + interval '1 day', null
         ) as data`,
        [BOB],
      );
      return result.rows[0]!.data;
    });
    ok("a platform admin can restrict an account", Boolean(restriction.id));

    eq(
      "restricted tenant loses workspace visibility",
      await asBob(`select count(*) from workspaces where id = $1`, [idB]),
      "0",
    );
    eq(
      "restricted person can still read their own restriction",
      await asBob(`select count(*) from account_restrictions where user_id = $1`, [BOB]),
      "1",
    );
    eq(
      "other tenants are unaffected by the restriction",
      Number(await asAlice(`select count(*) from workspaces where id = $1`, [idA])) > 0,
      true,
    );
    eq(
      "tenant owner cannot lift a platform restriction",
      (
        await expectError(
          client,
          "authenticated",
          bob,
          `select public.platform_admin_lift_restriction($1, 'self service', null)`,
          [restriction.id],
          { commit: true },
        )
      )?.code,
      "42501",
    );

    await commitAs(client, superAdmin, async (c) => {
      await c.query(`select public.platform_admin_lift_restriction($1, 'Appeal accepted', null)`, [
        restriction.id,
      ]);
      return true;
    });
    eq(
      "lifting a restriction restores tenant access",
      await asBob(`select count(*) from workspaces where id = $1`, [idB]),
      "1",
    );
    eq(
      "platform restrictions are audited",
      await scalar(
        client,
        `select count(*) from platform_admin_audit_log where target_id = $1 and action in ('user.restricted', 'user.restriction_lifted')`,
        [BOB],
      ),
      "2",
    );

    const planChange = await commitAs(client, superAdmin, async (c) => {
      const result = await c.query<{ data: { previous_plan: string; plan: string } }>(
        `select public.platform_admin_set_workspace_plan($1, 'growth', 'Support good-will upgrade', null) as data`,
        [idB],
      );
      return result.rows[0]!.data;
    });
    eq("platform plan change records the previous plan", planChange.previous_plan, "starter");
    eq("workspace plan is updated", await scalar(client, `select plan from workspaces where id = $1`, [idB]), "growth");
    eq(
      "subscription plan follows the workspace",
      await scalar(client, `select plan from subscriptions where workspace_id = $1`, [idB]),
      "growth",
    );

    const savedPlan = await commitAs(client, superAdmin, async (c) => {
      const result = await c.query<{ data: { saved: boolean } }>(
        `select public.platform_admin_save_plan('growth', jsonb_build_object(
           'name', 'Growth', 'description', 'For businesses that need deeper financial management.',
           'priceMinor', 9900, 'currency', 'XAF', 'billingInterval', 'month', 'seats', 8,
           'workspaceLimit', 2, 'aiMessageLimit', 500, 'transactionLimit', 5000,
           'integrationLimit', 3, 'exportLimit', 200, 'sortOrder', 2, 'isActive', true,
           'features', jsonb_build_array(jsonb_build_object('code', 'budget_management', 'included', true, 'limit', null))
         ), null) as data`,
      );
      return result.rows[0]!.data;
    });
    eq("platform admins can save a plan with the camel-case payload", savedPlan.saved, true);
    eq(
      "saving a plan updates its price",
      await scalar(client, `select price_minor::text from subscription_plans where code = 'growth'`),
      "9900",
    );
    eq(
      "saving a plan updates its feature grant",
      await scalar(
        client,
        `select pf.included::text from plan_features pf join subscription_features f on f.id = pf.feature_id
          join subscription_plans p on p.id = pf.plan_id where p.code = 'growth' and f.code = 'budget_management'`,
      ),
      "true",
    );
    eq(
      "tenant users cannot save platform plans",
      (
        await expectError(
          client,
          "authenticated",
          alice,
          `select public.platform_admin_save_plan('growth', jsonb_build_object('name', 'Hacked'), null)`,
          [],
          { commit: true },
        )
      )?.code,
      "42501",
    );
    const savedBilling = await commitAs(client, superAdmin, async (c) => {
      const result = await c.query<{ data: { trial_days: number } }>(
        `select public.platform_admin_save_billing_settings(14, 'starter', array[7,3,1], null) as data`,
      );
      return result.rows[0]!.data;
    });
    eq("platform admins can save trial settings", savedBilling.trial_days, 14);
    eq(
      "trial settings are stored",
      await scalar(client, `select value ->> 'trial_days' from platform_settings where key = 'billing'`),
      "14",
    );
    eq(
      "the trial plan setting is stored",
      await scalar(client, `select value ->> 'trial_plan_code' from platform_settings where key = 'billing'`),
      "starter",
    );
    eq(
      "tenant users cannot change trial settings",
      (
        await expectError(
          client,
          "authenticated",
          alice,
          `select public.platform_admin_save_billing_settings(14, 'starter', array[7,3,1], null)`,
          [],
          { commit: true },
        )
      )?.code,
      "42501",
    );

    const workspaceList = await commitAs(client, superAdmin, async (c) => {
      const result = await c.query<{ data: { id: string }[] }>(
        `select public.platform_admin_list_workspaces('Mbarga', 20, 0) as data`,
      );
      return result.rows[0]!.data;
    });
    eq("platform workspace search finds the tenant", workspaceList[0]!.id, idB);

    const adminList = await commitAs(client, superAdmin, async (c) => {
      const result = await c.query<{ data: { role: string }[] }>(
        `select public.platform_admin_list_admins() as data`,
      );
      return result.rows[0]!.data;
    });
    eq("platform admin directory lists the super admin", adminList[0]!.role, "super_admin");

    eq(
      "platform administrators cannot write the admin directory directly",
      (
        await expectError(
          client,
          "authenticated",
          superAdmin,
          `update platform_admins set is_active = false where user_id = $1`,
          [SUPER],
          { commit: true },
        )
      )?.code,
      "42501",
    );
    eq(
      "the last super admin cannot be deactivated",
      (
        await expectError(
          client,
          "service_role",
          null,
          `update platform_admins set is_active = false where user_id = $1`,
          [SUPER],
          { commit: true },
        )
      )?.code,
      "23514",
    );
    eq(
      "a super admin cannot deactivate their own console account",
      (
        await expectError(
          client,
          "authenticated",
          superAdmin,
          `select public.platform_admin_set_admin_status($1, false, null)`,
          [SUPER],
          { commit: true },
        )
      )?.code,
      "23514",
    );

    console.log("\nPhase 3 · tenant lifecycle");
    const workspaceC = await commitAs(client, dora, async (c) => {
      const result = await c.query<{ data: { id: string } }>(
        `select public.create_workspace('Dora Traders', 'XAF', 'CM', 'Africa/Douala', null, 'en') as data`,
      );
      return result.rows[0]!.data;
    });
    const idC = workspaceC.id;
    await commitAs(client, dora, async (c) => {
      const contact = await c.query<{ id: string }>(
        `insert into contacts (workspace_id, kind, name) values ($1, 'customer', 'Cascade Customer') returning id`,
        [idC],
      );
      const invoice = await c.query<{ id: string }>(
        `insert into invoices (workspace_id, customer_id, number, due_on)
         values ($1, $2, 'INV-C-1', current_date + 5) returning id`,
        [idC, contact.rows[0]!.id],
      );
      await c.query(
        `insert into invoice_items (workspace_id, invoice_id, position, description, quantity, unit_price_minor)
         values ($1, $2, 1, 'Cascade item', 1, 2000)`,
        [idC, invoice.rows[0]!.id],
      );
      await c.query(`update invoices set status = 'sent' where id = $1`, [invoice.rows[0]!.id]);
      const debt = await c.query<{ id: string }>(
        `insert into debts (workspace_id, direction, contact_id, description, principal_minor, invoice_id)
         values ($1, 'receivable', $2, 'Cascade debt', 2000, $3) returning id`,
        [idC, contact.rows[0]!.id, invoice.rows[0]!.id],
      );
      const account = (
        await c.query<{ id: string }>(`select id from accounts where workspace_id = $1 and subtype = 'cash'`, [idC])
      ).rows[0]!.id;
      await c.query(
        `insert into debt_payments (workspace_id, debt_id, amount_minor, paid_on, account_id)
         values ($1, $2, 500, current_date, $3)`,
        [idC, debt.rows[0]!.id, account],
      );
    });
    ok(
      "workspace owner can delete an active tenant",
      Boolean(
        await commitAs(client, dora, async (c) => {
          await c.query(`delete from workspaces where id = $1`, [idC]);
          return true;
        }),
      ),
    );
    eq("workspace rows are gone", await scalar(client, `select count(*) from workspaces where id = $1`, [idC]), "0");
    eq(
      "tenant children are gone",
      await scalar(client, `select count(*) from invoices where workspace_id = $1`, [idC]),
      "0",
    );
    eq(
      "tenant payments are gone",
      await scalar(client, `select count(*) from debt_payments where workspace_id = $1`, [idC]),
      "0",
    );

    console.log("\nPhase 11 · WhatsApp channel");

    const firstClaim = await asRole(
      client,
      "service_role",
      null,
      async (c) => {
        const result = await c.query<{ data: { claimed: boolean; event_id: string; attempt: number } }>(
          `select public.claim_webhook_event('whatsapp', 'message:wamid.test-1') as data`,
        );
        return result.rows[0]!.data;
      },
      true,
    );
    eq("first webhook delivery is claimed", firstClaim.claimed, true);
    eq("first claim starts at attempt 1", firstClaim.attempt, 1);

    const concurrentClaim = await asRole(client, "service_role", null, async (c) => {
      const result = await c.query<{ data: { claimed: boolean; status: string } }>(
        `select public.claim_webhook_event('whatsapp', 'message:wamid.test-1') as data`,
      );
      return result.rows[0]!.data;
    });
    eq("concurrent webhook delivery is not claimed", concurrentClaim.claimed, false);
    eq("concurrent webhook delivery sees processing", concurrentClaim.status, "processing");

    await asRole(
      client,
      "service_role",
      null,
      async (c) => {
        await c.query(`update webhook_events set status = 'processed' where id = $1`, [firstClaim.event_id]);
      },
      true,
    );
    const processedClaim = await asRole(client, "service_role", null, async (c) => {
      const result = await c.query<{ data: { claimed: boolean; status: string } }>(
        `select public.claim_webhook_event('whatsapp', 'message:wamid.test-1') as data`,
      );
      return result.rows[0]!.data;
    });
    eq("processed webhook delivery stays terminal", processedClaim.claimed, false);
    eq("processed webhook delivery reports processed", processedClaim.status, "processed");

    const failedFirst = await asRole(
      client,
      "service_role",
      null,
      async (c) => {
        const result = await c.query<{ data: { claimed: boolean; event_id: string } }>(
          `select public.claim_webhook_event('whatsapp', 'message:wamid.test-2') as data`,
        );
        return result.rows[0]!.data;
      },
      true,
    );
    await asRole(
      client,
      "service_role",
      null,
      async (c) => {
        await c.query(`update webhook_events set status = 'failed' where id = $1`, [failedFirst.event_id]);
      },
      true,
    );
    const retryClaim = await asRole(client, "service_role", null, async (c) => {
      const result = await c.query<{ data: { claimed: boolean; attempt: number; retry: boolean } }>(
        `select public.claim_webhook_event('whatsapp', 'message:wamid.test-2') as data`,
      );
      return result.rows[0]!.data;
    });
    eq("failed webhook delivery is reclaimable", retryClaim.claimed, true);
    eq("reclaim increments the attempt", retryClaim.attempt, 2);
    eq("reclaim is marked as a retry", retryClaim.retry, true);

    eq(
      "authenticated callers cannot claim webhook events",
      (
        await expectError(
          client,
          "authenticated",
          alice,
          `select public.claim_webhook_event('whatsapp', 'message:forbidden')`,
          [],
          { commit: true },
        )
      )?.code,
      "42501",
    );

    await asRole(
      client,
      "service_role",
      null,
      async (c) => {
        await c.query(
          `insert into channel_identities (workspace_id, user_id, channel, address, verification_code_hash, verification_expires_at)
           values ($1, $2, 'whatsapp', '+237600000001', 'hash', now() + interval '10 minutes')`,
          [idA, ALICE],
        );
      },
      true,
    );
    eq(
      "authenticated clients cannot self-assert a verified channel link",
      (
        await expectError(
          client,
          "authenticated",
          alice,
          `insert into channel_identities (workspace_id, user_id, channel, address, verified_at)
           values ($1, $2, 'whatsapp', '+237600000002', now())`,
          [idA, ALICE],
          { commit: true },
        )
      )?.code,
      "42501",
    );
    eq(
      "authenticated clients cannot mark a channel link verified",
      (
        await expectError(
          client,
          "authenticated",
          alice,
          `update channel_identities set verified_at = now() where workspace_id = $1`,
          [idA],
          { commit: true },
        )
      )?.code,
      "42501",
    );

    const serviceReport = await asRole(client, "service_role", null, async (c) => {
      const result = await c.query<{ data: { revenueMinor: string } }>(
        `select public.get_report_as_service($1, '2000-01-01', '2100-01-01') as data`,
        [idA],
      );
      return result.rows[0]!.data;
    });
    const ownerReport = await asRole(client, "authenticated", alice, async (c) => {
      const result = await c.query<{ data: { revenueMinor: string } }>(
        `select public.get_report($1, '2000-01-01', '2100-01-01') as data`,
        [idA],
      );
      return result.rows[0]!.data;
    });
    eq("service report matches the owner report", serviceReport.revenueMinor, ownerReport.revenueMinor);

    const phase11Summary = await asRole(client, "service_role", null, async (c) => {
      const result = await c.query<{ data: { totalIncomeMinor: string; cashBalanceMinor: string } }>(
        `select public.get_workspace_summary_as_service($1, '2000-01-01', '2100-01-01') as data`,
        [idA],
      );
      return result.rows[0]!.data;
    });
    const phase11OwnerSummary = await asRole(client, "authenticated", alice, async (c) => {
      const result = await c.query<{ data: { totalIncomeMinor: string; cashBalanceMinor: string } }>(
        `select public.get_dashboard_summary($1, '2000-01-01', '2100-01-01') as data`,
        [idA],
      );
      return result.rows[0]!.data;
    });
    eq("service summary matches the owner income", phase11Summary.totalIncomeMinor, phase11OwnerSummary.totalIncomeMinor);
    eq("service summary matches the owner cash", phase11Summary.cashBalanceMinor, phase11OwnerSummary.cashBalanceMinor);

    eq(
      "authenticated callers cannot use the service summary",
      (
        await expectError(
          client,
          "authenticated",
          alice,
          `select public.get_workspace_summary_as_service($1, '2000-01-01', '2100-01-01')`,
          [idA],
          { commit: true },
        )
      )?.code,
      "42501",
    );

    eq(
      "authenticated callers cannot use the service report",
      (
        await expectError(
          client,
          "authenticated",
          alice,
          `select public.get_report_as_service($1, '2000-01-01', '2100-01-01')`,
          [idA],
          { commit: true },
        )
      )?.code,
      "42501",
    );

    eq(
      "service role can read the receivables view",
      await asRole(client, "service_role", null, async (c) => {
        await c.query(`select 1 from v_debts where workspace_id = $1 limit 1`, [idA]);
        return true;
      }),
      true,
    );

    console.log(`\nDatabase: ${databaseName()}/${dbName}`);
  } finally {
    await client.end();
  }

  summary("Database integration");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
