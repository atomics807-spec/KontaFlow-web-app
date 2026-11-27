import { createHmac } from "node:crypto";
import { expect, test } from "@playwright/test";

const USSD_TOKEN = "e2e-ussd-token";
const WHATSAPP_VERIFY_TOKEN = "e2e-whatsapp-token";
const WHATSAPP_APP_SECRET = "e2e-whatsapp-secret";

test("USSD rejects a bad callback token and answers an unlinked number", async ({ request }) => {
  const denied = await request.post("/api/ussd?token=wrong", {
    form: { sessionId: "session-1", phoneNumber: "+237600000000", text: "", serviceCode: "*123#" },
  });
  expect(denied.status()).toBe(403);

  const response = await request.post(`/api/ussd?token=${USSD_TOKEN}`, {
    form: { sessionId: "session-2", phoneNumber: "+237600000001", text: "", serviceCode: "*123#" },
  });
  expect(response.status()).toBe(200);
  const body = await response.text();
  expect(body.startsWith("END ")).toBe(true);
  expect(body.toLowerCase()).toContain("link");
});

test("WhatsApp verifies the challenge and rejects forged signatures", async ({ request }) => {
  const challenge = await request.get(
    `/api/whatsapp?hub.mode=subscribe&hub.verify_token=${WHATSAPP_VERIFY_TOKEN}&hub.challenge=abc123`,
  );
  expect(challenge.status()).toBe(200);
  expect(await challenge.text()).toBe("abc123");

  const wrongChallenge = await request.get(
    "/api/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=abc123",
  );
  expect(wrongChallenge.status()).toBe(403);

  const body = JSON.stringify({ object: "not_a_whatsapp_account" });
  const forged = await request.post("/api/whatsapp", {
    data: body,
    headers: { "content-type": "application/json", "x-hub-signature-256": "sha256=deadbeef" },
  });
  expect(forged.status()).toBe(403);

  const signature = `sha256=${createHmac("sha256", WHATSAPP_APP_SECRET).update(body).digest("hex")}`;
  const accepted = await request.post("/api/whatsapp", {
    data: body,
    headers: { "content-type": "application/json", "x-hub-signature-256": signature },
  });
  expect(accepted.status()).toBe(200);
  expect(await accepted.text()).toBe("OK");
});
