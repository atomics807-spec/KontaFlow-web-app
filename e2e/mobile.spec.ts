import { expect, test } from "@playwright/test";
import { clearRateLimits, login, seedUser, waitForOfflineReady } from "./helpers";

test.beforeAll(async () => {
  await clearRateLimits();
});

test("mobile navigation, manifest and responsive layout work on a phone", async ({ page, request }) => {
  const user = await seedUser({ workspaceName: "Mobile Shop" });
  await login(page, user.email);
  await page.goto("/en/dashboard");

  await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  await page.getByRole("button", { name: "Open menu" }).click();
  const transactionsLink = page.getByRole("link", { name: "Transactions", exact: true });
  await expect(transactionsLink).toBeVisible();
  await transactionsLink.click();
  await expect(page).toHaveURL(/\/en\/transactions/);
  await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);

  const manifestResponse = await request.get("/manifest.webmanifest");
  expect(manifestResponse.status()).toBe(200);
  const manifest = (await manifestResponse.json()) as {
    name: string;
    display: string;
    icons: { src: string; sizes: string }[];
  };
  expect(manifest.name).toContain("KontaFlow");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.length).toBeGreaterThan(0);

  const serviceWorker = await request.get("/sw.js");
  expect(serviceWorker.status()).toBe(200);
  expect(await serviceWorker.text()).toContain("KontaFlow");
});

test("mobile offline capture remains usable without a connection", async ({ page, context }) => {
  const user = await seedUser({ workspaceName: "Mobile Offline" });
  await login(page, user.email);
  await waitForOfflineReady(page);
  await page.goto("/en/offline");
  await expect(page.locator("#offline-amount")).toBeVisible();

  await page.evaluate(() => navigator.serviceWorker?.ready);
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByText("Record while offline")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#offline-amount")).toBeVisible();
  await context.setOffline(false);
});
