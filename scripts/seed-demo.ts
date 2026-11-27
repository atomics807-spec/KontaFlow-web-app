/**
 * Local preview data for KontaFlow.
 *
 *   npm run seed:demo
 *
 * Idempotent: re-running updates passwords/profiles and only adds missing
 * workspaces, contacts, transactions, budgets, invoices and debts. It uses the
 * service-role key only for provisioning; transactions go through the same
 * authenticated `record_transaction` RPC as the web app.
 *
 * Never point this at a production project. The demo password is intentionally
 * shared with the preview audience.
 */
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { createClient, type SupabaseClient, type User } from "@supabase/supabase-js";

function loadEnv(): Record<string, string> {
  const values: Record<string, string> = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      values[match[1]!] = match[2]!.replace(/^["']|["']$/g, "");
    }
  } catch {
    // CI or a hosted preview supplies the variables directly.
  }
  return { ...values, ...process.env } as Record<string, string>;
}

const env = loadEnv();
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const PASSWORD = env.DEMO_PASSWORD ?? "KontaFlowDemo2026!";
const DEMO_DOMAIN = "demo.kontaflow.app";

if (!ANON_KEY || !SERVICE_ROLE_KEY) {
  throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required");
}
if (env.APP_ENV === "production" && env.ALLOW_DEMO_SEED !== "true") {
  throw new Error("Refusing to seed demo accounts in production (set ALLOW_DEMO_SEED=true to override)");
}

const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type DemoAccount = {
  email: string;
  name: string;
  phone: string;
  locale?: string;
  verified?: boolean;
  onboarding?: boolean;
};

type WorkspaceInfo = { id: string; name: string };

const accounts: Record<string, DemoAccount> = {
  owner: { email: `owner@${DEMO_DOMAIN}`, name: "Ariane Nkeng", phone: "+237670000001" },
  admin: { email: `admin@${DEMO_DOMAIN}`, name: "Brice Tchoumi", phone: "+237670000002" },
  accountant: { email: `accountant@${DEMO_DOMAIN}`, name: "Claudine Eto", phone: "+237670000003" },
  manager: { email: `manager@${DEMO_DOMAIN}`, name: "Didier Fokou", phone: "+237670000004" },
  staff: { email: `staff@${DEMO_DOMAIN}`, name: "Estelle Mbah", phone: "+237670000005" },
  scale: { email: `scale@${DEMO_DOMAIN}`, name: "Franck Ngu", phone: "+237670000006" },
  trial: { email: `trial@${DEMO_DOMAIN}`, name: "Ghislaine Mola", phone: "+237670000007" },
  expired: { email: `expired@${DEMO_DOMAIN}`, name: "Henri Bello", phone: "+237670000008" },
  onboarding: {
    email: `onboarding@${DEMO_DOMAIN}`,
    name: "Irene Njoya",
    phone: "+237670000009",
    onboarding: false,
  },
  superadmin: { email: `superadmin@${DEMO_DOMAIN}`, name: "Platform Super Admin", phone: "+237670000010" },
  support: { email: `support@${DEMO_DOMAIN}`, name: "Platform Support", phone: "+237670000011" },
} satisfies Record<string, DemoAccount>;

function isoDate(offsetDays = 0): string {
  const date = new Date();
  date.setUTCHours(12, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function monthBounds(): { start: string; end: string } {
  const now = new Date();
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

async function findUserByEmail(email: string): Promise<User | null> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`list_users_failed: ${error.message}`);
    const found = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (data.users.length < 200) break;
  }
  return null;
}

async function ensureUser(account: DemoAccount): Promise<string> {
  const metadata = {
    first_name: account.name.split(" ")[0],
    last_name: account.name.split(" ").slice(1).join(" "),
    full_name: account.name,
    phone: account.phone,
    country: "CM",
    locale: account.locale ?? "en",
    privacy_accepted: true,
    privacy_policy_version: "2026-01-01",
    marketing_opt_in: false,
  };
  const existing = await findUserByEmail(account.email);
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error) throw new Error(`update_user_failed:${account.email}:${error.message}`);
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: account.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: metadata,
  });
  if (error || !data.user) throw new Error(`create_user_failed:${account.email}:${error?.message ?? "no_user"}`);
  return data.user.id;
}

async function setProfile(
  userId: string,
  account: DemoAccount,
  options: { defaultWorkspaceId?: string | null; onboarding?: boolean } = {},
): Promise<void> {
  const verified = account.verified !== false;
  const now = new Date().toISOString();
  const payload: Record<string, unknown> = {
    id: userId,
    first_name: account.name.split(" ")[0],
    last_name: account.name.split(" ").slice(1).join(" "),
    full_name: account.name,
    phone: account.phone,
    country_code: "CM",
    locale: account.locale ?? "en",
    email_verified_at: verified ? now : null,
    phone_verified_at: verified ? now : null,
    verification_required: !verified,
    onboarding_completed_at: options.onboarding === false ? null : now,
  };
  if (options.defaultWorkspaceId !== undefined) payload.default_workspace_id = options.defaultWorkspaceId;
  const { error } = await admin.from("profiles").upsert(payload, { onConflict: "id" });
  if (error) throw new Error(`profile_failed:${account.email}:${error.message}`);
}

async function signedClient(email: string): Promise<SupabaseClient> {
  const base = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await base.auth.signInWithPassword({ email, password: PASSWORD });
  if (error || !data.session) throw new Error(`sign_in_failed:${email}:${error?.message ?? "no_session"}`);
  return createClient(SUPABASE_URL, ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
}

async function ensureWorkspace(
  ownerId: string,
  ownerEmail: string,
  name: string,
  options: { locale?: string } = {},
): Promise<WorkspaceInfo> {
  const { data: existing, error: findError } = await admin
    .from("workspaces")
    .select("id, name")
    .eq("owner_id", ownerId)
    .eq("name", name)
    .maybeSingle();
  if (findError) throw new Error(`workspace_lookup_failed:${name}:${findError.message}`);
  if (existing) return existing as WorkspaceInfo;

  const client = await signedClient(ownerEmail);
  const { data, error } = await client.rpc("create_workspace", {
    p_name: name,
    p_currency: "XAF",
    p_country: "CM",
    p_timezone: "Africa/Douala",
    p_legal_name: name,
    p_locale: options.locale ?? "en",
  });
  if (error) throw new Error(`create_workspace_failed:${name}:${error.message}`);
  return { id: String((data as { id: string }).id), name };
}

async function setPlan(workspaceId: string, planCode: "growth" | "scale" | "starter", status: string): Promise<void> {
  const { data: plan, error: planError } = await admin
    .from("subscription_plans")
    .select("id, price_minor")
    .eq("code", planCode)
    .single();
  if (planError || !plan) throw new Error(`plan_lookup_failed:${planCode}:${planError?.message ?? "missing"}`);
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const isExpired = status === "canceled";
  const { error } = await admin
    .from("subscriptions")
    .update({
      plan: planCode,
      plan_id: plan.id,
      status,
      price_minor: plan.price_minor,
      trial_started_at: null,
      trial_ends_at: isExpired ? new Date(now.getTime() - 86_400_000).toISOString() : null,
      trial_plan_id: null,
      current_period_start: isExpired
        ? new Date(now.getTime() - 60 * 86_400_000).toISOString()
        : now.toISOString(),
      current_period_end: isExpired ? new Date(now.getTime() - 86_400_000).toISOString() : periodEnd.toISOString(),
    })
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(`subscription_failed:${workspaceId}:${error.message}`);
  const { error: workspaceError } = await admin.from("workspaces").update({ plan: planCode }).eq("id", workspaceId);
  if (workspaceError) throw new Error(`workspace_plan_failed:${workspaceId}:${workspaceError.message}`);
}

async function addMember(workspaceId: string, userId: string, role: string, invitedBy: string): Promise<void> {
  const { error } = await admin.from("workspace_members").upsert(
    {
      workspace_id: workspaceId,
      user_id: userId,
      role,
      status: "active",
      invited_by: invitedBy,
      joined_at: new Date().toISOString(),
    },
    { onConflict: "workspace_id,user_id" },
  );
  if (error) throw new Error(`member_failed:${role}:${error.message}`);
  await admin.from("profiles").update({ default_workspace_id: workspaceId }).eq("id", userId);
}

type Contact = { id: string; name: string; kind: "customer" | "supplier" };

async function ensureContacts(workspaceId: string, ownerId: string): Promise<Contact[]> {
  const wanted: Omit<Contact, "id">[] = [
    { name: "Mami Alice Provisions", kind: "customer" },
    { name: "Bonaberi Hardware", kind: "customer" },
    { name: "Akwa Boutique", kind: "customer" },
    { name: "Nkeng Transport", kind: "supplier" },
    { name: "Douala Wholesale", kind: "supplier" },
    { name: "Eneo Prepaid", kind: "supplier" },
    { name: "Bamenda Grain Cooperative", kind: "customer" },
    { name: "Muea Market Traders", kind: "customer" },
  ];
  const { data: existing, error } = await admin
    .from("contacts")
    .select("id, name, kind")
    .eq("workspace_id", workspaceId);
  if (error) throw new Error(`contacts_read_failed:${workspaceId}:${error.message}`);
  const byName = new Map((existing ?? []).map((row) => [String(row.name), row as Contact]));
  for (const contact of wanted) {
    if (byName.has(contact.name)) continue;
    const { data, error: insertError } = await admin
      .from("contacts")
      .insert({
        workspace_id: workspaceId,
        kind: contact.kind,
        name: contact.name,
        phone: `+2376${Math.floor(10_000_000 + Math.random() * 89_999_999)}`,
        email: `${contact.name.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@example.cm`,
        created_by: ownerId,
      })
      .select("id, name, kind")
      .single();
    if (insertError || !data) throw new Error(`contact_failed:${contact.name}:${insertError?.message ?? "missing"}`);
    byName.set(contact.name, data as Contact);
  }
  return wanted.map((contact) => byName.get(contact.name)!).filter(Boolean);
}

async function seedTransactions(
  workspace: WorkspaceInfo,
  ownerEmail: string,
  count: number,
  label: string,
): Promise<void> {
  const { count: existingCount, error: countError } = await admin
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace.id)
    .like("client_generated_id", "demo-%");
  if (countError) throw new Error(`transaction_count_failed:${workspace.id}:${countError.message}`);
  if ((existingCount ?? 0) >= count) {
    console.log(`  ${label}: ${existingCount} demo transactions already present`);
    return;
  }

  const [{ data: accounts }, { data: categories }, contacts] = await Promise.all([
    admin.from("accounts").select("id, name, subtype").eq("workspace_id", workspace.id),
    admin.from("categories").select("id, name, kind").eq("workspace_id", workspace.id),
    ensureContacts(workspace.id, (await admin.from("workspaces").select("owner_id").eq("id", workspace.id).single()).data!.owner_id),
  ]);
  if (!accounts || !categories) throw new Error(`chart_missing:${workspace.id}`);

  const cash = accounts.find((row) => row.subtype === "cash");
  const mobile = accounts.find((row) => row.subtype === "mobile_money");
  const bank = accounts.find((row) => row.subtype === "bank");
  if (!cash || !mobile || !bank) throw new Error(`accounts_missing:${workspace.id}`);

  const incomeCategories = categories.filter((row) => row.kind === "income");
  const expenseCategories = categories.filter((row) => row.kind === "expense");
  const customers = contacts.filter((row) => row.kind === "customer");
  const suppliers = contacts.filter((row) => row.kind === "supplier");

  const incomeDescriptions = [
    "Daily market sales",
    "Boutique sales",
    "Wholesale order",
    "Service fee",
    "Delivery income",
    "Customer deposit",
    "Weekend sales",
    "Corporate order",
  ];
  const expenseDescriptions = [
    "Stock purchase",
    "Transport to market",
    "Shop rent",
    "Fuel for delivery",
    "Staff salaries",
    "Electricity token",
    "Packaging supplies",
    "Marketing flyers",
  ];
  const paymentMethods = ["cash", "mobile_money", "bank_transfer", "cash", "mobile_money"];
  const channels = ["web", "whatsapp", "ussd", "sync", "web", "ai"];

  const client = await signedClient(ownerEmail);
  let inserted = 0;
  for (let index = 0; index < count; index += 1) {
    const offset = -Math.floor((index / Math.max(count - 1, 1)) * 88);
    const isTransfer = index % 17 === 0;
    const isExpense = !isTransfer && index % 3 !== 0;
    const kind = isTransfer ? "transfer" : isExpense ? "expense" : "income";
    const amount = isTransfer
      ? 25_000 + (index % 5) * 10_000
      : isExpense
        ? 2_500 + (index % 9) * 3_500
        : 12_000 + (index % 11) * 9_500;
    const category = isTransfer
      ? null
      : isExpense
        ? expenseCategories[index % expenseCategories.length]
        : incomeCategories[index % incomeCategories.length];
    const contact = isTransfer
      ? null
      : isExpense
        ? suppliers[index % suppliers.length]
        : customers[index % customers.length];
    const account = isTransfer
      ? mobile
      : index % 4 === 0
        ? bank
        : index % 3 === 0
          ? mobile
          : cash;
    const { error } = await client.rpc("record_transaction", {
      p_payload: {
        workspace_id: workspace.id,
        kind,
        amount_minor: amount,
        occurred_on: isoDate(offset),
        description: isTransfer
          ? "Transfer to bank float"
          : isExpense
            ? `${expenseDescriptions[index % expenseDescriptions.length]} — ${workspace.name}`
            : `${incomeDescriptions[index % incomeDescriptions.length]} — ${workspace.name}`,
        reference: `DEMO-${String(index + 1).padStart(3, "0")}`,
        category_id: category?.id ?? null,
        contact_id: contact?.id ?? null,
        account_id: account.id,
        counter_account_id: isTransfer ? bank.id : null,
        payment_method: paymentMethods[index % paymentMethods.length],
        channel: channels[index % channels.length],
        client_generated_id: `demo-${workspace.id.slice(0, 8)}-${index + 1}`,
      },
    });
    if (error) throw new Error(`transaction_failed:${workspace.id}:${index + 1}:${error.message}`);
    inserted += 1;
  }
  console.log(`  ${label}: ${inserted} transactions seeded`);
}

async function ensureBudgets(workspaceId: string, ownerId: string): Promise<void> {
  const { data: existing, error } = await admin
    .from("budgets")
    .select("id")
    .eq("workspace_id", workspaceId)
    .limit(1);
  if (error) throw new Error(`budget_read_failed:${workspaceId}:${error.message}`);
  if (existing && existing.length > 0) return;

  const { start, end } = monthBounds();
  const { data: categories } = await admin
    .from("categories")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .eq("kind", "expense");
  const transport = categories?.find((row) => row.name === "Transport");
  const marketing = categories?.find((row) => row.name === "Marketing");
  const rows: Record<string, unknown>[] = [
    {
      workspace_id: workspaceId,
      name: "Monthly operating budget",
      category_id: null,
      period_start: start,
      period_end: end,
      amount_minor: 450_000,
      currency: "XAF",
      alert_threshold_bp: 8000,
      created_by: ownerId,
    },
  ];
  if (transport) {
    rows.push({
      workspace_id: workspaceId,
      name: "Transport budget",
      category_id: transport.id,
      period_start: start,
      period_end: end,
      amount_minor: 90_000,
      currency: "XAF",
      alert_threshold_bp: 7500,
      created_by: ownerId,
    });
  }
  if (marketing) {
    rows.push({
      workspace_id: workspaceId,
      name: "Marketing budget",
      category_id: marketing.id,
      period_start: start,
      period_end: end,
      amount_minor: 60_000,
      currency: "XAF",
      alert_threshold_bp: 9000,
      created_by: ownerId,
    });
  }
  const { error: insertError } = await admin.from("budgets").insert(rows);
  if (insertError) throw new Error(`budget_failed:${workspaceId}:${insertError.message}`);
}

async function ensureGoals(workspaceId: string, ownerId: string): Promise<void> {
  const { data: existing } = await admin.from("financial_goals").select("id").eq("workspace_id", workspaceId).limit(1);
  if (existing && existing.length > 0) return;
  const { data: account } = await admin
    .from("accounts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("subtype", "bank")
    .maybeSingle();
  const { error } = await admin.from("financial_goals").insert({
    workspace_id: workspaceId,
    name: "New delivery van",
    target_minor: 2_500_000,
    saved_minor: 750_000,
    currency: "XAF",
    target_date: isoDate(180),
    account_id: account?.id ?? null,
    status: "active",
    notes: "Replace the old van before the rainy season.",
    created_by: ownerId,
  });
  if (error) throw new Error(`goal_failed:${workspaceId}:${error.message}`);
}

async function clearDemoInvoices(workspaceId: string): Promise<void> {
  const dbUrl = env.SUPABASE_DB_URL;
  if (!dbUrl) throw new Error("SUPABASE_DB_URL is required to rebuild demo invoices");
  const db = new Client({ connectionString: dbUrl });
  await db.connect();
  try {
    await db.query("begin");
    // Issued invoices are immutable by design; this local demo reset bypasses
    // the guard only for rows whose numbers start with INV-DEMO-.
    await db.query("set local session_replication_role = replica");
    await db.query(
      `delete from public.invoice_items
        where workspace_id = $1
          and invoice_id in (
            select id from public.invoices where workspace_id = $1 and number like 'INV-DEMO-%'
          )`,
      [workspaceId],
    );
    await db.query("delete from public.invoices where workspace_id = $1 and number like 'INV-DEMO-%'", [
      workspaceId,
    ]);
    await db.query("commit");
  } catch (error) {
    await db.query("rollback");
    throw error;
  } finally {
    await db.end();
  }
}

async function ensureInvoices(workspaceId: string, ownerId: string): Promise<void> {
  await clearDemoInvoices(workspaceId);
  const { data: contacts } = await admin
    .from("contacts")
    .select("id, name, kind")
    .eq("workspace_id", workspaceId)
    .eq("kind", "customer");
  const customer = contacts?.[0];
  if (!customer) return;

  const rows = [
    {
      number: "INV-DEMO-001",
      status: "sent",
      issue_on: isoDate(-12),
      due_on: isoDate(8),
      subtotal_minor: 125_000,
      tax_minor: 0,
      total_minor: 125_000,
      amount_paid_minor: 0,
      notes: "Rice, oil and tinned goods for the Akwa shop.",
    },
    {
      number: "INV-DEMO-002",
      status: "paid",
      issue_on: isoDate(-30),
      due_on: isoDate(-2),
      subtotal_minor: 84_000,
      tax_minor: 0,
      total_minor: 84_000,
      amount_paid_minor: 84_000,
      notes: "Paid by mobile money.",
    },
    {
      number: "INV-DEMO-003",
      status: "overdue",
      issue_on: isoDate(-50),
      due_on: isoDate(-20),
      subtotal_minor: 56_000,
      tax_minor: 0,
      total_minor: 56_000,
      amount_paid_minor: 0,
      notes: "Follow up with the customer this week.",
    },
    {
      number: "INV-DEMO-004",
      status: "draft",
      issue_on: isoDate(0),
      due_on: isoDate(14),
      subtotal_minor: 210_000,
      tax_minor: 0,
      total_minor: 210_000,
      amount_paid_minor: 0,
      notes: "Awaiting confirmation of the delivery date.",
    },
  ];

  for (const row of rows) {
    const { data: invoice, error } = await admin
      .from("invoices")
      .insert({
        workspace_id: workspaceId,
        customer_id: customer.id,
        currency: "XAF",
        created_by: ownerId,
        number: row.number,
        status: "draft",
        issue_on: row.issue_on,
        due_on: row.due_on,
        subtotal_minor: row.subtotal_minor,
        tax_minor: row.tax_minor,
        total_minor: row.total_minor,
        amount_paid_minor: 0,
        notes: row.notes,
      })
      .select("id")
      .single();
    if (error || !invoice) throw new Error(`invoice_failed:${row.number}:${error?.message ?? "missing"}`);
    const { error: itemError } = await admin.from("invoice_items").insert({
      workspace_id: workspaceId,
      invoice_id: invoice.id,
      position: 1,
      description: row.number === "INV-DEMO-004" ? "Bulk maize supply" : "Assorted provisions",
      quantity: 1,
      unit_price_minor: row.total_minor,
      tax_rate_bp: 0,
      line_total_minor: row.total_minor,
    });
    if (itemError) throw new Error(`invoice_item_failed:${row.number}:${itemError.message}`);
    if (row.status !== "draft") {
      const { error: sentError } = await admin
        .from("invoices")
        .update({ status: "sent", sent_at: new Date().toISOString() })
        .eq("id", invoice.id);
      if (sentError) throw new Error(`invoice_sent_failed:${row.number}:${sentError.message}`);
    }
    if (row.status === "paid" || row.status === "overdue") {
      const dbUrl = env.SUPABASE_DB_URL;
      if (!dbUrl) throw new Error("SUPABASE_DB_URL is required to finalize demo invoices");
      const db = new Client({ connectionString: dbUrl });
      await db.connect();
      try {
        await db.query("begin");
        await db.query("select set_config('kontaflow.invoice_payment_sync', 'on', true)");
        await db.query(
          `update public.invoices
              set status = $2::public.invoice_status,
                  amount_paid_minor = $3,
                  paid_at = case when $2 = 'paid' then now() else null end
            where id = $1`,
          [invoice.id, row.status, row.amount_paid_minor],
        );
        await db.query("commit");
      } catch (error) {
        await db.query("rollback");
        throw error;
      } finally {
        await db.end();
      }
    }
  }
}

async function ensureDebts(workspaceId: string, ownerId: string): Promise<void> {
  const { data: existing } = await admin.from("debts").select("id").eq("workspace_id", workspaceId).limit(1);
  if (existing && existing.length > 0) return;
  const { data: contacts } = await admin.from("contacts").select("id, name, kind").eq("workspace_id", workspaceId);
  const customer = contacts?.find((row) => row.kind === "customer");
  const supplier = contacts?.find((row) => row.kind === "supplier");
  if (!customer || !supplier) return;
  const { data: account } = await admin
    .from("accounts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("subtype", "cash")
    .maybeSingle();

  const { data: receivable, error: receivableError } = await admin
    .from("debts")
    .insert({
      workspace_id: workspaceId,
      direction: "receivable",
      contact_id: customer.id,
      description: "Goods supplied on 30-day terms",
      principal_minor: 250_000,
      paid_minor: 100_000,
      currency: "XAF",
      opened_on: isoDate(-35),
      due_on: isoDate(10),
      status: "partially_paid",
      notes: "Customer promised the balance after the next market day.",
      created_by: ownerId,
    })
    .select("id")
    .single();
  if (receivableError || !receivable) {
    throw new Error(`debt_failed:receivable:${receivableError?.message ?? "missing"}`);
  }
  await admin.from("debt_payments").insert({
    workspace_id: workspaceId,
    debt_id: receivable.id,
    amount_minor: 100_000,
    paid_on: isoDate(-10),
    account_id: account?.id ?? null,
    payment_method: "cash",
    reference: "DEP-DEMO-001",
    notes: "First instalment.",
    created_by: ownerId,
  });
  const { error: payableError } = await admin.from("debts").insert({
    workspace_id: workspaceId,
    direction: "payable",
    contact_id: supplier.id,
    description: "Supplier invoice for stock",
    principal_minor: 180_000,
    paid_minor: 0,
    currency: "XAF",
    opened_on: isoDate(-20),
    due_on: isoDate(15),
    status: "open",
    notes: "Pay after the next sales cycle.",
    created_by: ownerId,
  });
  if (payableError) throw new Error(`debt_failed:payable:${payableError.message}`);
}

async function main(): Promise<void> {
  console.log(`Seeding KontaFlow demo data at ${SUPABASE_URL}`);
  console.log(`Demo password: ${PASSWORD}`);

  const ids: Record<string, string> = {};
  for (const [key, account] of Object.entries(accounts)) {
    ids[key] = await ensureUser(account);
    await setProfile(ids[key]!, account, {
      onboarding: account.onboarding !== false,
    });
  }

  // Growth workspace with one account per role.
  const growth = await ensureWorkspace(ids.owner!, accounts.owner.email, "Douala Fresh Market");
  await setPlan(growth.id, "growth", "active");
  await setProfile(ids.owner!, accounts.owner, { defaultWorkspaceId: growth.id });
  for (const role of ["admin", "accountant", "manager", "staff"] as const) {
    await setProfile(ids[role]!, accounts[role], { defaultWorkspaceId: growth.id });
    await addMember(growth.id, ids[role]!, role, ids.owner!);
  }
  await seedTransactions(growth, accounts.owner.email, 64, "Douala Fresh Market");
  await ensureBudgets(growth.id, ids.owner!);
  await ensureGoals(growth.id, ids.owner!);

  // Scale workspace, plus a second business for the same owner.
  const scale = await ensureWorkspace(ids.scale!, accounts.scale.email, "Bamenda Agro Supply");
  await setPlan(scale.id, "scale", "active");
  await setProfile(ids.scale!, accounts.scale, { defaultWorkspaceId: scale.id });
  await seedTransactions(scale, accounts.scale.email, 80, "Bamenda Agro Supply");
  await ensureBudgets(scale.id, ids.scale!);
  await ensureGoals(scale.id, ids.scale!);
  await ensureInvoices(scale.id, ids.scale!);
  await ensureDebts(scale.id, ids.scale!);

  const second = await ensureWorkspace(ids.scale!, accounts.scale.email, "Buea Coffee Roasters");
  await setPlan(second.id, "scale", "active");
  await seedTransactions(second, accounts.scale.email, 28, "Buea Coffee Roasters");
  await ensureBudgets(second.id, ids.scale!);

  // Trial workspace.
  const trial = await ensureWorkspace(ids.trial!, accounts.trial.email, "Limbe Fashion House");
  await setProfile(ids.trial!, accounts.trial, { defaultWorkspaceId: trial.id });
  await seedTransactions(trial, accounts.trial.email, 24, "Limbe Fashion House");
  await ensureBudgets(trial.id, ids.trial!);

  // Expired subscription: the ledger remains visible but read-only.
  const expired = await ensureWorkspace(ids.expired!, accounts.expired.email, "Garoua Auto Parts");
  await setProfile(ids.expired!, accounts.expired, { defaultWorkspaceId: expired.id });
  // A rerun may find this workspace already read-only; open it just long enough
  // to add any missing historical rows, then end it again.
  await setPlan(expired.id, "growth", "active");
  await seedTransactions(expired, accounts.expired.email, 18, "Garoua Auto Parts");
  await setPlan(expired.id, "growth", "canceled");

  // Onboarding account: verified but no workspace yet.
  await setProfile(ids.onboarding!, accounts.onboarding, { onboarding: false, defaultWorkspaceId: null });

  // Platform operators cannot belong to a workspace.
  for (const [key, role] of [
    ["superadmin", "super_admin"],
    ["support", "support"],
  ] as const) {
    const { error } = await admin.from("platform_admins").upsert(
      { user_id: ids[key]!, role, is_active: true, created_by: null },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(`platform_admin_failed:${key}:${error.message}`);
    await setProfile(ids[key]!, accounts[key], { defaultWorkspaceId: null });
  }

  console.log("\nDemo accounts");
  for (const [key, account] of Object.entries(accounts)) {
    console.log(`  ${key.padEnd(11)} ${account.email}  ${PASSWORD}`);
  }
  console.log("\nDone.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
