import { describe, expect, it } from "vitest";
import { normalizePhone, maskPhone } from "@/lib/validation/phone";
import { signupSchema } from "@/lib/validation/auth";
import { onboardingSchema } from "@/lib/validation/onboarding";
import { passwordSchema } from "@/lib/validation/schemas";

const messages = {
  firstNameRequired: "first name",
  lastNameRequired: "last name",
  businessNameRequired: "business name",
  phoneInvalid: "phone",
  privacyRequired: "privacy",
  passwordMismatch: "mismatch",
};

function validSignup(overrides: Record<string, unknown> = {}) {
  return {
    firstName: "Awa",
    lastName: "Nkeng",
    businessName: "Nkeng Fresh Foods",
    email: "Awa@Example.CM",
    country: "CM",
    phone: "6 71 23 45 67",
    password: "StrongPass123",
    confirm: "StrongPass123",
    preferredLocale: "fr",
    privacyAccepted: true,
    marketingOptIn: false,
    ...overrides,
  };
}

describe("phone normalisation", () => {
  it("normalises Cameroon national formats to E.164", () => {
    expect(normalizePhone("6 71 23 45 67", "CM")).toBe("+237671234567");
    expect(normalizePhone("0671234567", "CM")).toBe("+237671234567");
    expect(normalizePhone("00237671234567", "CM")).toBe("+237671234567");
    expect(normalizePhone("+237 671 23 45 67", "CM")).toBe("+237671234567");
  });

  it("uses the selected country dial code", () => {
    expect(normalizePhone("06 12 34 56 78", "FR")).toBe("+33612345678");
    expect(normalizePhone("671234567", "CM")).toBe("+237671234567");
  });

  it("rejects malformed or wrong-length numbers", () => {
    expect(normalizePhone("", "CM")).toBeNull();
    expect(normalizePhone("12345", "CM")).toBeNull();
    expect(normalizePhone("6712345678", "CM")).toBeNull();
    expect(normalizePhone("abc", "CM")).toBeNull();
    expect(normalizePhone("671234567", "ZZ")).toBeNull();
  });

  it("masks numbers without leaking the middle", () => {
    expect(maskPhone("+237671234567")).toBe("+23" + "•".repeat(7) + "567");
    expect(maskPhone(null)).toBe("");
  });
});

describe("password policy", () => {
  it("requires length, lower, upper and number", () => {
    expect(passwordSchema.safeParse("StrongPass123").success).toBe(true);
    expect(passwordSchema.safeParse("password1234").success).toBe(false);
    expect(passwordSchema.safeParse("PASSWORD1234").success).toBe(false);
    expect(passwordSchema.safeParse("PasswordOnly").success).toBe(false);
    expect(passwordSchema.safeParse("Sh0rt").success).toBe(false);
  });
});

describe("signup schema", () => {
  it("accepts a complete registration", () => {
    const result = signupSchema(messages).safeParse(validSignup());
    expect(result.success).toBe(true);
  });

  it("lowercases email and rejects a missing consent", () => {
    const result = signupSchema(messages).safeParse(validSignup({ email: "Awa@Example.CM" }));
    expect(result.success && result.data.email).toBe("awa@example.cm");

    const denied = signupSchema(messages).safeParse(validSignup({ privacyAccepted: false }));
    expect(denied.success).toBe(false);
    if (!denied.success) {
      expect(denied.error.issues.some((issue) => issue.path.join(".") === "privacyAccepted")).toBe(true);
    }
  });

  it("rejects mismatched passwords and invalid phone numbers", () => {
    const mismatch = signupSchema(messages).safeParse(validSignup({ confirm: "DifferentPass123" }));
    expect(mismatch.success).toBe(false);

    const badPhone = signupSchema(messages).safeParse(validSignup({ phone: "12" }));
    expect(badPhone.success).toBe(false);
    if (!badPhone.success) {
      expect(badPhone.error.issues.some((issue) => issue.path.join(".") === "phone")).toBe(true);
    }
  });

  it("rejects unknown countries and locales", () => {
    expect(signupSchema(messages).safeParse(validSignup({ country: "ZZ" })).success).toBe(false);
    expect(signupSchema(messages).safeParse(validSignup({ preferredLocale: "de" })).success).toBe(false);
  });

  it("treats whitespace-only names as missing", () => {
    expect(signupSchema(messages).safeParse(validSignup({ firstName: "   " })).success).toBe(false);
  });

  it("requires a business name at signup", () => {
    expect(signupSchema(messages).safeParse(validSignup({ businessName: " " })).success).toBe(false);
    expect(signupSchema(messages).safeParse(validSignup({ businessName: "A" })).success).toBe(false);
  });
});

function validOnboarding(overrides: Record<string, unknown> = {}) {
  return {
    name: "Nkeng Fresh Foods",
    legalName: "ETS Nkeng",
    businessType: "limited_company",
    city: "Douala",
    industry: "food",
    businessSize: "small",
    currency: "XAF",
    fiscalYearStartMonth: 1,
    country: "CM",
    timezone: "Africa/Douala",
    uiLocale: "en",
    businessPhone: "6 71 23 45 67",
    ...overrides,
  };
}

describe("onboarding schema", () => {
  it("accepts a complete business profile", () => {
    expect(onboardingSchema.safeParse(validOnboarding()).success).toBe(true);
  });

  it("coerces the fiscal month from a select value", () => {
    const result = onboardingSchema.safeParse(validOnboarding({ fiscalYearStartMonth: "7" }));
    expect(result.success && result.data.fiscalYearStartMonth).toBe(7);
  });

  it("rejects invalid enums, months and phone numbers", () => {
    expect(onboardingSchema.safeParse(validOnboarding({ industry: "mining" })).success).toBe(false);
    expect(onboardingSchema.safeParse(validOnboarding({ fiscalYearStartMonth: 13 })).success).toBe(false);
    expect(onboardingSchema.safeParse(validOnboarding({ businessPhone: "123" })).success).toBe(false);
    expect(onboardingSchema.safeParse(validOnboarding({ currency: "BTC" })).success).toBe(false);
  });
});
