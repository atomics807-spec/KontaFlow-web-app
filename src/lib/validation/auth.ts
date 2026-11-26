import { z } from "zod";
import { COUNTRIES } from "@/lib/countries";
import { emailSchema, passwordSchema } from "@/lib/validation/schemas";
import { normalizePhone } from "@/lib/validation/phone";

export type SignupMessages = {
  firstNameRequired: string;
  lastNameRequired: string;
  phoneInvalid: string;
  privacyRequired: string;
  passwordMismatch: string;
};

const personName = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[^\u0000-\u001f\u007f]+$/u);

export function signupSchema(messages: SignupMessages) {
  return z
    .object({
      firstName: personName.min(1, messages.firstNameRequired),
      lastName: personName.min(1, messages.lastNameRequired),
      email: emailSchema,
      country: z
        .string()
        .trim()
        .toUpperCase()
        .refine((code) => COUNTRIES.some((country) => country.code === code), messages.phoneInvalid),
      phone: z.string().trim().min(6).max(24),
      password: passwordSchema,
      confirm: z.string().min(1, messages.passwordMismatch),
      preferredLocale: z.enum(["en", "fr", "pcm"]),
      privacyAccepted: z.boolean().refine(Boolean, messages.privacyRequired),
      marketingOptIn: z.boolean(),
    })
    .superRefine((value, ctx) => {
      if (value.password !== value.confirm) {
        ctx.addIssue({ code: "custom", path: ["confirm"], message: messages.passwordMismatch });
      }
      if (!normalizePhone(value.phone, value.country)) {
        ctx.addIssue({ code: "custom", path: ["phone"], message: messages.phoneInvalid });
      }
    });
}

export type SignupInput = z.infer<ReturnType<typeof signupSchema>>;
