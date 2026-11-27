import { expect, test } from "@playwright/test";
import { admin, clearOfflineSession, clearRateLimits, login, seedUser, waitForOfflineReady } from "./helpers";

test.beforeAll(async () => {
  await clearRateLimits();
});

test("an offline sale is queued locally and syncs when the connection returns", async ({ page, context }) => {
  const user = await seedUser({ workspaceName: "Offline Shop" });
  await login(page, user.email);
  await waitForOfflineReady(page);

  await page.goto("/en/offline");
  await expect(page.locator("#offline-amount")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Offline Shop")).toBeVisible();

  await page.evaluate(() => navigator.serviceWorker?.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator("#offline-amount")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Record while offline")).toBeVisible();

  await page.locator("#offline-amount").fill("7500");
  await page.locator("#offline-description").fill("Offline plantain sale");
  await page.getByRole("button", { name: /Save transaction/i }).click();
  await expect(page.getByText("Saved on this device. It will sync when you are online.")).toBeVisible();

  const { count: whileOffline } = await admin
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", user.workspaceId);
  expect(whileOffline).toBe(0);

  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));

  await expect
    .poll(
      async () => {
        const { count } = await admin
          .from("transactions")
          .select("id", { count: "exact", head: true })
          .eq("workspace_id", user.workspaceId);
        return count;
      },
      { timeout: 30_000, intervals: [500, 1000, 2000] },
    )
    .toBe(1);

  const { data: synced } = await admin
    .from("transactions")
    .select("description, amount_minor, channel, status")
    .eq("workspace_id", user.workspaceId)
    .single();
  expect(synced).toMatchObject({
    description: "Offline plantain sale",
    amount_minor: 7500,
    channel: "sync",
    status: "posted",
  });
  await expect(page.getByText("Synced", { exact: true })).toBeVisible({ timeout: 30_000 });
});

test("offline capture hydrates an authenticated session when opened directly", async ({ page }) => {
  const user = await seedUser({ workspaceName: "Direct Offline" });
  await login(page, user.email);
  await waitForOfflineReady(page);
  await clearOfflineSession(page);

  await page.goto("/en/offline");
  await expect(page.locator("#offline-amount")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Direct Offline")).toBeVisible();
});
