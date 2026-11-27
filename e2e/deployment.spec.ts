import { expect, test } from "@playwright/test";
import { admin, endSubscription, login, seedUser } from "./helpers";

const HEALTH_TOKEN = "e2e-health-token";

test("health endpoint reports database readiness", async ({ request }) => {
  const response = await request.get("/api/health", {
    headers: { authorization: `Bearer ${HEALTH_TOKEN}` },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const body = (await response.json()) as {
    status: string;
    service: string;
    checks: { database: string };
  };
  expect(body.status).toBe("ok");
  expect(body.service).toBe("kontaflow");
  expect(body.checks.database).toBe("ok");
});

test("health endpoint rejects a request without the health token", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.status()).toBe(401);
});

test("security headers and locale switching work on public pages", async ({ page }) => {
  const response = await page.goto("/en");
  expect(response?.status()).toBe(200);
  const headers = response?.headers() ?? {};
  expect(headers["content-security-policy"]).toContain("default-src 'self'");
  expect(headers["strict-transport-security"]).toContain("max-age=");
  expect(headers["x-frame-options"]).toBe("DENY");

  await page.goto("/fr");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await page.goto("/pcm");
  await expect(page.locator("html")).toHaveAttribute("lang", "pcm");
});

test("an ended subscription makes the ledger read-only", async ({ page }) => {
  const user = await seedUser({ workspaceName: "Expired Shop" });
  await endSubscription(user);
  await login(page, user.email);

  await expect(page.getByText(/Your trial or subscription has ended/i).first()).toBeVisible();

  const quickForm = page.locator("form").filter({ has: page.getByLabel("Amount") }).first();
  await quickForm.getByLabel("Amount").fill("1000");
  await quickForm.getByLabel("What was it for?").fill("Blocked sale");
  await quickForm.getByRole("button", { name: "Save", exact: true }).click();
  await expect(quickForm.getByRole("alert")).toContainText(/could not record the transaction/i);

  const { data: blocked } = await admin
    .from("transactions")
    .select("id")
    .eq("workspace_id", user.workspaceId)
    .eq("description", "Blocked sale");
  expect(blocked ?? []).toHaveLength(0);
});
