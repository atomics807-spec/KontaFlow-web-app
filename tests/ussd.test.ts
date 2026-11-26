import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/dictionaries/en";
import { fr } from "@/lib/i18n/dictionaries/fr";
import { pcm } from "@/lib/i18n/dictionaries/pcm";
import { safeEqual } from "@/lib/security/safe-equal";
import {
  USSD_MAX_RESPONSE_CHARS,
  clampUssdResponse,
  isUssdSessionExpired,
  lastUssdInput,
  parseUssdAmount,
  parseUssdText,
  ussdClientId,
} from "@/lib/ussd/menu";

describe("USSD input handling", () => {
  it("splits the cumulative provider path and ignores empty segments", () => {
    expect(parseUssdText("1*500*2*1")).toEqual(["1", "500", "2", "1"]);
    expect(parseUssdText("1**500*")).toEqual(["1", "500"]);
    expect(parseUssdText("")).toEqual([]);
  });

  it("uses the last segment for a retried verification code", () => {
    expect(lastUssdInput("111111*222222")).toBe("222222");
    expect(lastUssdInput("")).toBe("");
  });

  it("accepts whole amounts in the workspace currency", () => {
    expect(parseUssdAmount("500", "XAF")).toBe(500n);
    expect(parseUssdAmount(" 12500 ", "XAF")).toBe(12500n);
  });

  it("rejects zero, fractions, separators and non-digits", () => {
    expect(() => parseUssdAmount("0", "XAF")).toThrow();
    expect(() => parseUssdAmount("12.5", "XAF")).toThrow();
    expect(() => parseUssdAmount("12,500", "XAF")).toThrow();
    expect(() => parseUssdAmount("abc", "XAF")).toThrow();
    expect(() => parseUssdAmount("-500", "XAF")).toThrow();
  });
});

describe("USSD callback secret", () => {
  it("accepts only an exact token", () => {
    expect(safeEqual("shared-token", "shared-token")).toBe(true);
    expect(safeEqual("shared-token", "shared-tokem")).toBe(false);
    expect(safeEqual("shared-token", "shared-token ")).toBe(false);
    expect(safeEqual("", "shared-token")).toBe(false);
  });
});

describe("USSD response limits", () => {
  it("keeps CON and END responses within the provider limit", () => {
    const long = "x".repeat(300);
    for (const kind of ["CON", "END"] as const) {
      const response = clampUssdResponse(kind, long);
      expect(response.length).toBeLessThanOrEqual(USSD_MAX_RESPONSE_CHARS);
      expect(response.startsWith(`${kind} `)).toBe(true);
      expect(response.endsWith("...")).toBe(true);
    }
  });

  it("does not alter a short response", () => {
    expect(clampUssdResponse("CON", "1. Sale\n2. Expense")).toBe("CON 1. Sale\n2. Expense");
  });

  it("ships concise menus in every supported locale", () => {
    for (const dict of [en, fr, pcm]) {
      const menu = dict.channels.ussd.menu;
      expect(clampUssdResponse("CON", menu).length).toBeLessThanOrEqual(USSD_MAX_RESPONSE_CHARS);
      for (const option of ["1", "2", "3", "4", "5", "6", "0"]) {
        expect(menu).toContain(option);
      }
    }
  });
});

describe("USSD session safety", () => {
  it("expires sessions at the deadline", () => {
    const now = new Date("2026-11-26T12:00:00.000Z");
    expect(isUssdSessionExpired("2026-11-26T11:59:59.000Z", now)).toBe(true);
    expect(isUssdSessionExpired("2026-11-26T12:00:00.000Z", now)).toBe(true);
    expect(isUssdSessionExpired("2026-11-26T12:00:01.000Z", now)).toBe(false);
    expect(isUssdSessionExpired("not-a-date", now)).toBe(true);
  });

  it("creates a bounded, stable idempotency key for one session path", () => {
    const first = ussdClientId("session-1", "2*500*1*1");
    expect(first).toBe(ussdClientId("session-1", "2*500*1*1"));
    expect(first).not.toBe(ussdClientId("session-1", "2*500*1*2"));
    expect(first).not.toBe(ussdClientId("session-2", "2*500*1*1"));
    expect(first.length).toBeLessThanOrEqual(120);
  });
});
