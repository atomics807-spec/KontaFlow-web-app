import { describe, expect, it } from "vitest";
import { CONTACT_TOPICS, createContactSchema } from "@/lib/validation/contact";

const messages = {
  name: "Enter your name.",
  email: "Enter a valid email.",
  message: "Write a message.",
  topic: "Choose a topic.",
  consent: "Agree to be contacted.",
};

const schema = createContactSchema(messages);

const valid = {
  name: "Awa Nkeng",
  email: "Awa@Example.CM",
  company: "",
  topic: "sales",
  message: "Please tell me more about the Growth plan.",
  consent: true,
};

describe("contact form validation", () => {
  it("accepts a complete request and normalises the email", () => {
    const parsed = schema.safeParse(valid);
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.email).toBe("awa@example.cm");
      expect(parsed.data.company).toBeNull();
    }
  });

  it("rejects an invalid email", () => {
    const parsed = schema.safeParse({ ...valid, email: "not-an-email" });
    expect(parsed.success).toBe(false);
    if (!parsed.success) expect(parsed.error.issues[0]?.message).toBe(messages.email);
  });

  it("requires a message of at least 10 characters", () => {
    const parsed = schema.safeParse({ ...valid, message: "too short" });
    expect(parsed.success).toBe(false);
  });

  it("requires consent", () => {
    const parsed = schema.safeParse({ ...valid, consent: false });
    expect(parsed.success).toBe(false);
  });

  it("rejects unknown topics", () => {
    const parsed = schema.safeParse({ ...valid, topic: "crypto" });
    expect(parsed.success).toBe(false);
  });

  it("keeps the topic list stable", () => {
    expect(CONTACT_TOPICS).toEqual(["sales", "support", "partnership", "press", "other"]);
  });
});
