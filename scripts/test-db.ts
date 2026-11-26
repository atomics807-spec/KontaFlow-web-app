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

const alice = { sub: ALICE, email: "alice@example.com", role: "authenticated" };
const bob = { sub: BOB, email: "bob@example.com", role: "authenticated" };
const charlie = { sub: CHARLIE, email: "charlie@example.com", role: "authenticated" };
const dora = { sub: DORA, email: "dora@example.com", role: "authenticated" };

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
      "anon cannot read new tables",
      (await expectError(client, "anon", null, `select count(*) from invoices`))?.code,
      "42501",
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
            and c.relname not in ('ussd_sessions', 'webhook_events', 'payment_webhooks', 'otp_verifications', 'idempotency_records')`,
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
