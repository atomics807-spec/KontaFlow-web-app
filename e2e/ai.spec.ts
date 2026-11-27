import { expect, test } from "@playwright/test";
import { admin, clearRateLimits, login, seedUser, setPlan } from "./helpers";

test.beforeAll(async () => {
  await clearRateLimits();
});

test("AI assistant drafts a transaction, waits for confirmation and posts it", async ({ page }) => {
  const user = await seedUser({ workspaceName: "AI Test Co" });
  await setPlan(user, "growth");
  await login(page, user.email);
  await page.goto("/en/assistant");

  await page.locator("#assistant-input:visible").fill("Spent 500 on transport this morning");
  await page.getByRole("button", { name: "Send" }).filter({ visible: true }).click();

  await expect(page.getByText(/prepared a draft expense/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Review before posting")).toBeVisible();
  await expect(page.getByText("E2E transport")).toBeVisible();

  const { count: beforeConfirm } = await admin
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", user.workspaceId);
  expect(beforeConfirm).toBe(0);

  await page.getByRole("button", { name: "Confirm and post" }).click();
  await expect(page.getByText("Posted", { exact: true })).toBeVisible({ timeout: 30_000 });

  const { data: transactions } = await admin
    .from("transactions")
    .select("description, amount_minor, kind, channel")
    .eq("workspace_id", user.workspaceId);
  expect(transactions).toHaveLength(1);
  expect(transactions?.[0]).toMatchObject({
    description: "E2E transport",
    amount_minor: 500,
    kind: "expense",
  });

  await page.goto("/en/transactions");
  await expect(page.getByText("E2E transport")).toBeVisible();
  await expect(page.getByText("500 FCFA").first()).toBeVisible();
});
