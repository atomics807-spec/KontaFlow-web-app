import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

function loadLocalEnv(): Record<string, string> {
  const values: Record<string, string> = {};
  try {
    for (const line of readFileSync(".env.local", "utf8").split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      values[match[1]!] = match[2]!.replace(/^["']|["']$/g, "");
    }
  } catch {
    // CI supplies real environment variables.
  }
  return { ...values, ...process.env } as Record<string, string>;
}

const env = loadLocalEnv();
export const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY ?? "";
export const MAILPIT_URL = env.MAILPIT_URL ?? "http://127.0.0.1:54324";
export const APP_URL = "http://localhost:3000";

export const admin: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export const PASSWORD = "StrongPass123";

export function uniqueEmail(prefix = "e2e"): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

export function uniquePhone(): string {
  return `6${String(Math.floor(10_000_000 + Math.random() * 89_999_999))}`;
}

export type SeededUser = {
  email: string;
  phone: string;
  password: string;
  userId: string;
  workspaceId: string;
  accessToken: string;
  client: SupabaseClient;
};

async function signedInClient(email: string, password: string): Promise<{ client: SupabaseClient; accessToken: string }> {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) throw new Error(`sign_in_failed:${error?.message ?? "no_session"}`);
  const authed = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
  });
  return { client: authed, accessToken: data.session.access_token };
}

export async function seedUser(options: {
  workspaceName?: string;
  verified?: boolean;
  email?: string;
} = {}): Promise<SeededUser> {
  const email = options.email ?? uniqueEmail();
  const phone = uniquePhone();
  const verified = options.verified ?? true;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: verified,
    user_metadata: {
      first_name: "E2E",
      last_name: "Owner",
      full_name: "E2E Owner",
      phone: `+237${phone}`,
      country: "CM",
      locale: "en",
      privacy_accepted: true,
      privacy_policy_version: "2026-01-01",
      marketing_opt_in: false,
    },
  });
  if (error || !data.user) throw new Error(`create_user_failed:${error?.message ?? "no_user"}`);

  const now = new Date().toISOString();
  await admin
    .from("profiles")
    .update({
      phone: `+237${phone}`,
      phone_verified_at: verified ? now : null,
      email_verified_at: verified ? now : null,
      verification_required: !verified,
      onboarding_completed_at: verified ? now : null,
    })
    .eq("id", data.user.id);

  let client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  let accessToken = "";
  if (verified) {
    const session = await signedInClient(email, PASSWORD);
    client = session.client;
    accessToken = session.accessToken;
  }
  let workspaceId = "";
  if (verified) {
    const workspace = await client.rpc("create_workspace", {
      p_name: options.workspaceName ?? "E2E Business",
      p_currency: "XAF",
      p_country: "CM",
      p_timezone: "Africa/Douala",
      p_legal_name: null,
      p_locale: "en",
    });
    if (workspace.error) throw new Error(`create_workspace_failed:${workspace.error.message}`);
    workspaceId = String((workspace.data as { id: string }).id);
  }

  return {
    email,
    phone,
    password: PASSWORD,
    userId: data.user.id,
    workspaceId,
    accessToken,
    client,
  };
}




export async function clearOfflineSession(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("kontaflow-offline");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("session", "readwrite");
      tx.objectStore("session").clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });
}

export async function waitForOfflineReady(page: Page, timeout = 30_000): Promise<void> {
  await page.waitForFunction(
    async () => {
      const open = () =>
        new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open("kontaflow-offline");
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
      const db = await open();
      if (!db.objectStoreNames.contains("session") || !db.objectStoreNames.contains("accounts")) {
        db.close();
        return false;
      }
      const read = <T,>(store: string, key?: IDBValidKey) =>
        new Promise<T | undefined>((resolve, reject) => {
          const request = db.transaction(store).objectStore(store).get(key as IDBValidKey);
          request.onsuccess = () => resolve(request.result as T | undefined);
          request.onerror = () => reject(request.error);
        });
      const session = await read<{ userId: string }>("session", "active");
      const accounts = await new Promise<unknown[]>((resolve, reject) => {
        const request = db.transaction("accounts").objectStore("accounts").getAll();
        request.onsuccess = () => resolve(request.result as unknown[]);
        request.onerror = () => reject(request.error);
      });
      db.close();
      return Boolean(session?.userId) && accounts.length > 0;
    },
    undefined,
    { timeout },
  );
}

export async function setPlan(user: SeededUser, plan: "growth" | "scale"): Promise<void> {
  const { data: planRow, error: planError } = await admin
    .from("subscription_plans")
    .select("id, price_minor")
    .eq("code", plan)
    .single();
  if (planError || !planRow) throw new Error(`plan_lookup_failed:${planError?.message ?? plan}`);
  const now = new Date();
  const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const { error } = await admin
    .from("subscriptions")
    .update({
      plan,
      plan_id: planRow.id,
      status: "active",
      price_minor: planRow.price_minor,
      trial_ends_at: null,
      current_period_start: now.toISOString(),
      current_period_end: periodEnd.toISOString(),
    })
    .eq("workspace_id", user.workspaceId);
  if (error) throw new Error(`plan_update_failed:${error.message}`);
}

export async function endSubscription(user: SeededUser): Promise<void> {
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { error } = await admin
    .from("subscriptions")
    .update({ status: "canceled", trial_ends_at: past, current_period_end: past })
    .eq("workspace_id", user.workspaceId);
  if (error) throw new Error(`subscription_end_failed:${error.message}`);
}

export async function login(page: Page, email: string, password = PASSWORD): Promise<void> {
  await page.goto("/en/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/\/en\/(dashboard|onboarding|verify-phone)/, { timeout: 30_000 });
}

export async function clearRateLimits(): Promise<void> {
  await admin.from("security_rate_limits").delete().neq("bucket_key", "");
}

export function readSmsCode(phone: string): string | null {
  try {
    const log = readFileSync(".e2e-server.log", "utf8");
    const lines = log.split("\n").filter((line) => line.includes("[sms:console]") && line.includes(phone));
    const last = lines.at(-1);
    return last?.match(/KontaFlow: (\d{6})/)?.[1] ?? null;
  } catch {
    return null;
  }
}

export async function waitForSmsCode(phone: string): Promise<string> {
  let code: string | null = null;
  await expect
    .poll(() => {
      code = readSmsCode(phone);
      return code;
    }, { timeout: 20_000, intervals: [250, 500, 1000] })
    .not.toBeNull();
  return code!;
}

export async function signUpThroughUi(page: Page): Promise<{ email: string; phone: string }> {
  const email = uniqueEmail("ui");
  const phone = uniquePhone();
  await page.goto("/en/signup");
  await page.getByLabel("First name").fill("Amina");
  await page.getByLabel("Last name").fill("Nkeng");
  await page.getByLabel("Business name").fill("Nkeng Fresh Foods");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Phone").fill(phone);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Confirm password").fill(PASSWORD);
  await page.getByRole("checkbox").first().check();
  await page.getByRole("button", { name: /create account/i }).click();
  await page.waitForURL(/verify-phone/, { timeout: 30_000 });
  return { email, phone };
}

export async function verifyPhoneThroughUi(page: Page, phone: string): Promise<void> {
  await page.getByRole("button", { name: /send code by sms/i }).click();
  const code = await waitForSmsCode(phone);
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: /verify phone number/i }).click();
  await page.waitForURL(/onboarding/, { timeout: 30_000 });
}

export async function completeOnboarding(page: Page, name = "Nkeng Fresh Foods"): Promise<void> {
  await page.locator("#name").fill(name);
  await page.locator("#city").fill("Douala");
  await page.getByRole("button", { name: /create workspace/i }).click();
  await page.waitForURL(/dashboard/, { timeout: 30_000 });
}

export async function recordQuickTransaction(
  page: Page,
  kind: "income" | "expense",
  amount: string,
  description: string,
): Promise<void> {
  const label = kind === "income" ? /^Income$/ : /^Expense$/;
  await page.getByRole("button", { name: label }).first().click();
  await page.getByLabel("Amount").fill(amount);
  await page.getByLabel("What was it for?").fill(description);
  await page.getByRole("button", { name: /^Save$/ }).click();
  await expect(page.getByText("Transaction recorded.")).toBeVisible();
}

export async function seedTransactions(user: SeededUser, count: number): Promise<void> {
  const { data: accounts } = await user.client
    .from("accounts")
    .select("id, subtype")
    .eq("workspace_id", user.workspaceId)
    .eq("is_archived", false);
  const cash = accounts?.find((account) => account.subtype === "cash") ?? accounts?.[0];
  const { data: categories } = await user.client
    .from("categories")
    .select("id, kind")
    .eq("workspace_id", user.workspaceId)
    .eq("kind", "income");
  const category = categories?.[0];
  if (!cash || !category) throw new Error("workspace_defaults_missing");

  const today = new Date().toISOString().slice(0, 10);
  for (let offset = 0; offset < count; offset += 25) {
    const batch = Array.from({ length: Math.min(25, count - offset) }, (_, index) => {
      const sequence = offset + index;
      return user.client.rpc("record_transaction", {
        p_payload: {
          workspace_id: user.workspaceId,
          kind: sequence % 4 === 0 ? "expense" : "income",
          amount_minor: String(1000 + (sequence % 50) * 100),
          description: `Seeded entry ${sequence + 1}`,
          account_id: cash.id,
          category_id: sequence % 4 === 0 ? null : category.id,
          occurred_on: today,
          channel: "web",
          client_generated_id: `seed-${user.workspaceId}-${sequence}`,
        },
      });
    });
    const results = await Promise.all(batch);
    const failed = results.find((result) => result.error);
    if (failed?.error) throw new Error(`seed_transaction_failed:${failed.error.message}`);
  }
}

export async function mailpitMessages(): Promise<
  { ID: string; To: { Address: string }[]; Subject: string }[]
> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=50`);
  if (!response.ok) throw new Error(`mailpit_failed:${response.status}`);
  const body = (await response.json()) as {
    messages?: { ID: string; To: { Address: string }[]; Subject: string }[];
  };
  return body.messages ?? [];
}

export async function mailpitHtml(id: string): Promise<string> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`);
  if (!response.ok) throw new Error(`mailpit_message_failed:${response.status}`);
  const body = (await response.json()) as { HTML?: string; Text?: string };
  return body.HTML ?? body.Text ?? "";
}
