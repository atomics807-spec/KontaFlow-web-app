import { expect, test } from "@playwright/test";
import {
  admin,
  APP_URL,
  clearRateLimits,
  completeOnboarding,
  mailpitHtml,
  mailpitMessages,
  PASSWORD,
  recordQuickTransaction,
  seedUser,
  signUpThroughUi,
  verifyPhoneThroughUi,
  waitForSmsCode,
} from "./helpers";

test.beforeAll(async () => {
  await clearRateLimits();
});

test("new business completes registration, verification and bookkeeping", async ({ page }) => {
  const { email, phone } = await signUpThroughUi(page);

  await verifyPhoneThroughUi(page, phone);
  await completeOnboarding(page, "Nkeng Fresh Foods");

  await expect(page.getByText("Welcome to KontaFlow")).toBeVisible();
  await expect(page.getByText("14 days left in your trial")).toBeVisible();

  await recordQuickTransaction(page, "income", "12500", "E2E cement sale");
  await recordQuickTransaction(page, "expense", "3000", "E2E fuel");

  await page.goto("/en/transactions");
  await expect(page.getByRole("heading", { name: "Transactions" })).toBeVisible();
  await expect(page.getByText("E2E cement sale")).toBeVisible();
  await expect(page.getByText("E2E fuel")).toBeVisible();

  await page.goto("/en/reports");
  await expect(page.getByRole("heading", { name: "Reports" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Profit & loss" })).toBeVisible();
  await expect(page.getByText("Revenue").first()).toBeVisible();
  await expect(page.getByText("Net profit").first()).toBeVisible();

  const { data: createdProfile } = await admin
    .from("profiles")
    .select("id, email_verified_at, phone_verified_at, onboarding_completed_at, verification_required")
    .eq("phone", `+237${phone}`)
    .single();

  const { data: consent } = await admin
    .from("privacy_consents")
    .select("consent_type, version, granted, locale")
    .eq("user_id", createdProfile!.id)
    .eq("consent_type", "privacy")
    .single();
  expect(consent).toMatchObject({ consent_type: "privacy", granted: true, locale: "en" });
  expect(consent?.version).toBeTruthy();
  expect(createdProfile?.email_verified_at).toBeTruthy();
  expect(createdProfile?.phone_verified_at).toBeTruthy();
  expect(createdProfile?.onboarding_completed_at).toBeTruthy();

  await page.getByRole("complementary").getByLabel("Language").selectOption("fr");
  await page.waitForURL(/\/fr\/reports/);
  await expect(page.getByRole("heading", { name: "Rapports" })).toBeVisible();
  await page.getByRole("complementary").getByLabel("Langue").selectOption("en");
  await page.waitForURL(/\/en\/reports/);

  await page.goto("/en/dashboard");
  const { data: workspace } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", createdProfile!.id)
    .single();
  const { count } = await admin
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspace!.workspace_id);
  expect(count).toBe(2);
  expect(email).toContain("@example.com");
});

test("email verification link confirms the account and opens phone verification", async ({ page }) => {
  const user = await seedUser({ verified: false, workspaceName: "Unverified Co" });
  const { data: link, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
    options: { redirectTo: `${APP_URL}/auth/callback?next=/en/verify-phone` },
  });
  expect(error).toBeNull();
  expect(link.properties?.hashed_token).toBeTruthy();

  await page.goto(
    `${APP_URL}/auth/callback?token_hash=${link.properties!.hashed_token}&type=magiclink&next=/en/verify-phone`,
  );
  await page.waitForURL(/verify-phone/, { timeout: 30_000 });
  await expect(page.getByText("Confirm your phone")).toBeVisible();

  const { data: profile } = await admin
    .from("profiles")
    .select("email_verified_at")
    .eq("id", user.userId)
    .single();
  expect(profile?.email_verified_at).toBeTruthy();
});

test("password recovery email resets the password end to end", async ({ page }) => {
  const user = await seedUser({ workspaceName: "Recovery Co" });
  const newPassword = "NewStrongPass456";

  await page.goto("/en/forgot-password");
  await page.getByLabel("Email").fill(user.email);
  await page.getByRole("button", { name: /email me a reset link/i }).click();
  await expect(page.getByText(/reset link/i).last()).toBeVisible();

  let message: { ID: string } | undefined;
  await expect
    .poll(async () => {
      const messages = await mailpitMessages();
      message = messages.find((item) => item.To.some((to) => to.Address === user.email));
      return Boolean(message);
    }, { timeout: 20_000 })
    .toBe(true);

  const html = await mailpitHtml(message!.ID);
  const href = html.match(/href="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
  expect(href).toContain("/auth/v1/verify");
  await page.goto(href!);
  await page.waitForURL(/reset-password/, { timeout: 30_000 });
  await page.getByLabel("New password", { exact: true }).fill(newPassword);
  await page.getByLabel("Confirm password").fill(newPassword);
  await page.getByRole("button", { name: /update password/i }).click();
  await expect(page.getByText("Password updated. You can sign in now.")).toBeVisible();

  await page.context().clearCookies();
  await page.goto("/en/login");
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password", { exact: true }).fill(newPassword);
  await page.getByRole("button", { name: /sign in/i }).click();
  await page.waitForURL(/dashboard/);
  expect(PASSWORD).not.toBe(newPassword);
});

test("phone verification rejects a wrong code and then accepts the SMS code", async ({ page }) => {
  const user = await seedUser({ verified: false, workspaceName: "OTP Co" });
  const { data: link } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: user.email,
    options: { redirectTo: `${APP_URL}/auth/callback?next=/en/verify-phone` },
  });
  await page.goto(
    `${APP_URL}/auth/callback?token_hash=${link.properties!.hashed_token}&type=magiclink&next=/en/verify-phone`,
  );
  await page.waitForURL(/verify-phone/);

  await page.getByRole("button", { name: /send code by sms/i }).click();
  await page.getByLabel("6-digit code").fill("000000");
  await page.getByRole("button", { name: /verify phone number/i }).click();
  await expect(page.getByText(/not correct|invalid|incorrect|expired/i).first()).toBeVisible();

  const code = await waitForSmsCode(user.phone);
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: /verify phone number/i }).click();
  await page.waitForURL(/onboarding/, { timeout: 30_000 });
});
