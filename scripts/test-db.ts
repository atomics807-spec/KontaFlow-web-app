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

const alice = { sub: ALICE, email: "alice@example.com", role: "authenticated" };
const bob = { sub: BOB, email: "bob@example.com", role: "authenticated" };
const charlie = { sub: CHARLIE, email: "charlie@example.com", role: "authenticated" };

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
         ($3, 'charlie@example.com', '{"full_name":"Charlie Fotso"}'::jsonb)`,
      [ALICE, BOB, CHARLIE],
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

    const idA = workspaceA.id;
    const idB = workspaceB.id;
    ok("workspace A created", Boolean(idA));
    ok("workspace B created", Boolean(idB));
    eq("A has 8 system accounts", await scalar(client, `select count(*) from accounts where workspace_id = $1`, [idA]), 8);
    eq("A has 13 starter categories", await scalar(client, `select count(*) from categories where workspace_id = $1`, [idA]), 13);
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
        `select public.get_dashboard_summary($1, current_date - 30, current_date) as data`,
        [idA],
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
        `select public.get_dashboard_summary($1, current_date - 30, current_date) as data`,
        [idA],
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
        `select public.get_report($1, current_date - 30, current_date) as data`,
        [idA],
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
          `select public.get_workspace_summary_as_service($1, current_date - 30, current_date) as data`,
          [idB],
        );
        return result.rows[0]!.data;
      },
    );
    eq("service summary returns totals", serviceSummary.totalIncomeMinor, "7000");

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
