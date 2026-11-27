import { expect, test } from "@playwright/test";
import { admin, clearRateLimits, login, seedTransactions, seedUser } from "./helpers";

test.beforeAll(async () => {
  await clearRateLimits();
});

test("a tenant cannot open another tenant's transaction", async ({ page }) => {
  const ownerA = await seedUser({ workspaceName: "Tenant A" });
  const ownerB = await seedUser({ workspaceName: "Tenant B" });
  await seedTransactions(ownerB, 1);
  const { data: transactionB } = await admin
    .from("transactions")
    .select("id, description")
    .eq("workspace_id", ownerB.workspaceId)
    .single();

  await login(page, ownerA.email);
  await page.goto(`/en/transactions/${transactionB!.id}`);
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  await expect(page.getByText("Seeded entry 1")).toHaveCount(0);
});

test("offline sync rejects a forged workspace id", async ({ page }) => {
  const attacker = await seedUser({ workspaceName: "Attacker Co" });
  const victim = await seedUser({ workspaceName: "Victim Co" });
  const { data: victimAccount } = await victim.client
    .from("accounts")
    .select("id")
    .eq("workspace_id", victim.workspaceId)
    .limit(1)
    .single();
  const { data: victimCategory } = await victim.client
    .from("categories")
    .select("id")
    .eq("workspace_id", victim.workspaceId)
    .eq("kind", "income")
    .limit(1)
    .single();

  await login(page, attacker.email);
  const response = await page.request.post("/api/sync", {
    headers: { origin: "http://localhost:3000" },
    data: {
      items: [
        {
          clientGeneratedId: `forged-${Date.now()}`,
          workspaceId: victim.workspaceId,
          currency: "XAF",
          kind: "income",
          amount: "9000",
          description: "Forged cross-tenant sale",
          occurredOn: new Date().toISOString().slice(0, 10),
          categoryId: victimCategory!.id,
          accountId: victimAccount!.id,
          paymentMethod: "cash",
        },
      ],
    },
  });
  expect(response.ok()).toBe(true);
  const body = (await response.json()) as { results: { status: string; code?: string }[] };
  expect(body.results[0]).toMatchObject({ status: "failed", code: "forbidden" });

  const { count } = await admin
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", victim.workspaceId);
  expect(count).toBe(0);
});

test("protected APIs require a session and reject cross-origin writes", async ({ page, request }) => {
  const anonymous = await request.post("/api/ai/chat", {
    headers: { origin: "http://localhost:3000" },
    data: { message: "Spent 500 on fuel", requestId: "request-anon-123" },
  });
  expect(anonymous.status()).toBe(401);

  const user = await seedUser({ workspaceName: "CSRF Co" });
  await login(page, user.email);
  const crossOrigin = await page.request.post("/api/ai/chat", {
    headers: { origin: "https://evil.example" },
    data: { message: "Spent 500 on fuel", requestId: "request-csrf-123" },
  });
  expect(crossOrigin.status()).toBe(403);

  const sameOrigin = await page.request.post("/api/ai/chat", {
    headers: { origin: "http://localhost:3000" },
    data: { message: "Spent 500 on fuel", requestId: "request-same-123" },
  });
  expect([200, 402, 403, 429, 503]).toContain(sameOrigin.status());
});

test("direct REST reads are filtered by row level security", async ({ page }) => {
  const ownerA = await seedUser({ workspaceName: "RLS A" });
  const ownerB = await seedUser({ workspaceName: "RLS B" });
  await seedTransactions(ownerB, 2);
  await login(page, ownerA.email);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
  const response = await page.request.get(
    `${supabaseUrl}/rest/v1/transactions?workspace_id=eq.${ownerB.workspaceId}&select=id,description`,
    { headers: { apikey: anonKey, Authorization: `Bearer ${ownerA.accessToken}` } },
  );
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual([]);
});
