import { z } from "zod";
import { BUSINESS_SIZES, BUSINESS_TYPES, INDUSTRIES } from "@/lib/business";
import { SUPPORTED_CURRENCIES } from "@/lib/currency";
import { normalizePhone } from "@/lib/validation/phone";

export const onboardingSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    legalName: z.string().trim().max(160).optional().or(z.literal("")),
    businessType: z.enum(BUSINESS_TYPES),
    city: z.string().trim().min(2).max(100),
    industry: z.enum(INDUSTRIES),
    businessSize: z.enum(BUSINESS_SIZES),
    currency: z.enum(SUPPORTED_CURRENCIES),
    fiscalYearStartMonth: z.coerce.number().int().min(1).max(12),
    country: z.string().trim().length(2),
    timezone: z.string().trim().min(3).max(64),
    uiLocale: z.enum(["en", "fr", "pcm"]),
    businessPhone: z.string().trim().max(24).optional().or(z.literal("")),
  })
  .superRefine((value, ctx) => {
    if (value.businessPhone && !normalizePhone(value.businessPhone, value.country)) {
      ctx.addIssue({ code: "custom", path: ["businessPhone"], message: "Enter a valid phone number." });
    }
  });

export type OnboardingInput = z.infer<typeof onboardingSchema>;
