import { expect, test } from "@playwright/test";
import { admin, clearRateLimits, login, seedUser } from "./helpers";

test.beforeAll(async () => {
  await clearRateLimits();
});

test("a new owner lands on the picture-first screen and records without writing", async ({ page }) => {
  const user = await seedUser({ workspaceName: "Easy Market" });
  await admin.from("profiles").update({ easy_mode: true }).eq("id", user.userId);

  await login(page, user.email);
  await page.waitForURL(/\/en\/easy/, { timeout: 30_000 });

  const guide = page.getByRole("dialog");
  await expect(guide).toBeVisible();
  await expect(guide.getByText("This is your money")).toBeVisible();
  await guide.getByRole("button", { name: /next/i }).click();
  await expect(guide.getByText("Three taps to record")).toBeVisible();
  await guide.getByRole("button", { name: /next/i }).click();
  await expect(guide.getByText("Help is always here")).toBeVisible();
  await guide.getByRole("button", { name: /start recording/i }).click();
  await expect(guide).toBeHidden();

  await expect(page.getByRole("link", { name: "My money", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "I sold", exact: true }).click();
  await page.waitForURL(/\/en\/easy\/record\?kind=income/, { timeout: 30_000 });

  await page.getByRole("button", { name: "5,000" }).click();
  await page.getByRole("button", { name: /^continue$/i }).click();
  await page.getByRole("button", { name: /Sales/ }).first().click();
  await page.getByRole("button", { name: /^continue$/i }).click();
  await expect(page.getByRole("heading", { name: "Check this" })).toBeVisible();
  await page.getByRole("button", { name: /yes, save/i }).click();

  await expect(page.getByText(/saved/i).first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole("link", { name: /see my money/i }).click();
  await page.waitForURL(/\/en\/easy/, { timeout: 30_000 });

  const { data: entries } = await admin
    .from("transactions")
    .select("amount_minor, kind, description")
    .eq("workspace_id", user.workspaceId)
    .order("created_at", { ascending: false })
    .limit(1);
  expect(entries?.[0]).toMatchObject({ kind: "income" });
  expect(String(entries?.[0]?.amount_minor)).toBe("5000");

  await page.getByRole("banner").getByRole("button", { name: /open the full screen/i }).click();
  await page.waitForURL(/\/en\/dashboard/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /hello/i })).toBeVisible();
  const { data: profile } = await admin.from("profiles").select("easy_mode").eq("id", user.userId).single();
  expect(profile?.easy_mode).toBe(false);
});
