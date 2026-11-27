import { expect, test } from "@playwright/test";
import { login, seedTransactions, seedUser } from "./helpers";

const HEALTH_TOKEN = "e2e-health-token";

test("health exposes request correlation and operational queue metrics", async ({ request }) => {
  const response = await request.get("/api/health", {
    headers: { authorization: `Bearer ${HEALTH_TOKEN}` },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["x-request-id"]).toBeTruthy();
  const body = (await response.json()) as {
    operational?: { queue: { queued: number }; outbox: { pending: number } } | null;
  };
  expect(body.operational?.queue.queued).toBeGreaterThanOrEqual(0);
  expect(body.operational?.outbox.pending).toBeGreaterThanOrEqual(0);
});

test("metrics require a health token and never cache the response", async ({ request }) => {
  expect((await request.get("/api/metrics")).status()).toBe(401);
  const response = await request.get("/api/metrics", {
    headers: { authorization: `Bearer ${HEALTH_TOKEN}` },
  });
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toContain("no-store");
  const body = (await response.json()) as { counters: Record<string, number>; operational: unknown };
  expect(typeof body.counters).toBe("object");
  expect(body.operational).toBeTruthy();
});

test("queue worker rejects callers without the cron secret", async ({ request }) => {
  expect((await request.post("/api/cron/queue-worker")).status()).toBe(403);
});

test("transaction API requires a session and paginates with a cursor", async ({ page }) => {
  expect((await page.request.get("/api/transactions")).status()).toBe(401);

  const user = await seedUser({ workspaceName: "Cursor Shop" });
  await seedTransactions(user, 60);
  await login(page, user.email);

  const first = await page.request.get("/api/transactions?limit=25");
  expect(first.status()).toBe(200);
  const firstBody = (await first.json()) as {
    rows: { id: string }[];
    nextCursor: string | null;
  };
  expect(firstBody.rows).toHaveLength(25);
  expect(firstBody.nextCursor).toBeTruthy();

  const second = await page.request.get(
    `/api/transactions?limit=25&cursor=${encodeURIComponent(firstBody.nextCursor!)}`,
  );
  expect(second.status()).toBe(200);
  const secondBody = (await second.json()) as { rows: { id: string }[] };
  expect(secondBody.rows).toHaveLength(25);
  const firstIds = new Set(firstBody.rows.map((row) => row.id));
  expect(secondBody.rows.some((row) => firstIds.has(row.id))).toBe(false);

  expect((await page.request.get("/api/transactions?cursor=not-a-cursor")).status()).toBe(422);
});
