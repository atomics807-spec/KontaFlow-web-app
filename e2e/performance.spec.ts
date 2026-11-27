import { expect, test } from "@playwright/test";
import { admin, clearRateLimits, login, seedTransactions, seedUser } from "./helpers";

test.beforeAll(async () => {
  await clearRateLimits();
});

test("dashboard and reports stay usable with 300 transactions on a slow device", async ({ page }) => {
  test.setTimeout(240_000);
  const user = await seedUser({ workspaceName: "Performance Shop" });
  await seedTransactions(user, 300);

  const { count } = await admin
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", user.workspaceId);
  expect(count).toBe(300);

  await login(page, user.email);
  await page.goto("/en/dashboard");
  await expect(page.getByText("This month").first()).toBeVisible();

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 150,
    downloadThroughput: (1.6 * 1024 * 1024) / 8,
    uploadThroughput: (750 * 1024) / 8,
  });

  const startedAt = Date.now();
  await page.reload();
  await expect(page.getByText("This month").first()).toBeVisible({ timeout: 30_000 });
  const interactiveMs = Date.now() - startedAt;
  expect(interactiveMs).toBeLessThan(30_000);

  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    return {
      domContentLoaded: navigation?.domContentLoadedEventEnd ?? 0,
      nodes: document.querySelectorAll("main *").length,
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(metrics.domContentLoaded).toBeLessThan(30_000);
  expect(metrics.nodes).toBeGreaterThan(50);
  expect(metrics.overflow).toBeLessThanOrEqual(1);

  const reportStartedAt = Date.now();
  const report = await page.request.get("/en/reports");
  const reportMs = Date.now() - reportStartedAt;
  expect(report.status()).toBe(200);
  expect(reportMs).toBeLessThan(5_000);

  const listStartedAt = Date.now();
  const list = await page.request.get("/en/transactions");
  const listMs = Date.now() - listStartedAt;
  expect(list.status()).toBe(200);
  expect(listMs).toBeLessThan(5_000);

  await page.goto("/en/transactions");
  await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();
  const renderedRows = await page.locator("table tbody tr").count();
  expect(renderedRows).toBeLessThanOrEqual(50);
});
