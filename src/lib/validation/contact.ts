import { z } from "zod";

export const CONTACT_TOPICS = ["sales", "support", "partnership", "press", "other"] as const;
export type ContactTopic = (typeof CONTACT_TOPICS)[number];

export type ContactValidationMessages = {
  name: string;
  email: string;
  message: string;
  topic: string;
  consent: string;
};

export function createContactSchema(messages: ContactValidationMessages) {
  return z.object({
    name: z.string().trim().min(2, messages.name).max(120, messages.name),
    email: z.string().trim().toLowerCase().max(160, messages.email).pipe(z.email(messages.email)),
    company: z
      .string()
      .trim()
      .max(120)
      .optional()
      .transform((value) => (value ? value : null)),
    topic: z.enum(CONTACT_TOPICS, { message: messages.topic }),
    message: z.string().trim().min(10, messages.message).max(4000, messages.message),
    consent: z.literal(true, { message: messages.consent }),
  });
}

export type ContactInput = z.infer<ReturnType<typeof createContactSchema>>;
