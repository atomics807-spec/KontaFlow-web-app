"use server";

import { revalidatePath } from "next/cache";
import { getWorkspaceContext } from "@/lib/supabase/auth";
import { can } from "@/lib/permissions";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { archiveContact, createContact } from "@/services/workspaces";
import { contactSchema } from "@/lib/validation/schemas";
import { fieldErrorsFrom, formError, formSuccess, type FormState } from "@/lib/action-utils";
import { isAppError } from "@/lib/errors";
import { getWorkspaceEntitlements } from "@/lib/entitlements/service";
import { interpolate } from "@/lib/i18n/interpolate";

export async function createContactAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const context = await getWorkspaceContext();
  if (!context) return formError(dict.errors.unauthorized);
  if (!can(context.role, "contacts:manage")) return formError(dict.errors.forbidden);
  const entitlements = await getWorkspaceEntitlements(context.workspace.id, context.user.id);
  if (!entitlements.features.customer_supplier_management.included) {
    return formError(
      interpolate(dict.plans.lockedBody, {
        plan: entitlements.features.customer_supplier_management.requiredPlan ?? dict.plans.growth,
      }),
    );
  }
  if (!entitlements.writable) return formError(dict.plans.readOnly);

  const parsed = contactSchema.safeParse({
    name: formData.get("name"),
    kind: formData.get("kind") ?? "customer",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    address: formData.get("address") ?? "",
    taxId: formData.get("taxId") ?? "",
    notes: formData.get("notes") ?? "",
  });

  if (!parsed.success) {
    return formError(dict.errors.generic, fieldErrorsFrom(parsed.error));
  }

  try {
    await createContact(context.workspace.id, context.user.id, parsed.data);
  } catch (error) {
    return formError(isAppError(error) ? error.publicMessage : dict.errors.generic);
  }

  revalidatePath(`/${locale}/contacts`);
  return formSuccess(dict.contacts.save);
}

export async function archiveContactAction(formData: FormData): Promise<void> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const context = await getWorkspaceContext();
  if (!context || !can(context.role, "contacts:manage")) return;
  const entitlements = await getWorkspaceEntitlements(context.workspace.id, context.user.id);
  if (!entitlements.features.customer_supplier_management.included || !entitlements.writable) return;
  const contactId = String(formData.get("contactId") ?? "");
  if (!contactId) return;
  await archiveContact(contactId);
  revalidatePath(`/${locale}/contacts`);
}
