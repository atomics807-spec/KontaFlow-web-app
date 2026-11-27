"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWorkspaceContext } from "@/lib/supabase/auth";
import { can } from "@/lib/permissions";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";
import { voidTransaction } from "@/services/transactions";
import { isAppError } from "@/lib/errors";
import { transactionSchema, toTransactionPayload } from "@/lib/validation/schemas";
import { fieldErrorsFrom, formError, formSuccess, type FormState } from "@/lib/action-utils";

export async function voidTransactionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const context = await getWorkspaceContext();

  if (!context) return formError(dict.errors.unauthorized);
  if (!can(context.role, "transactions:void")) return formError(dict.errors.forbidden);

  const transactionId = String(formData.get("transactionId") ?? "");
  const reason = String(formData.get("reason") ?? "").slice(0, 240);
  if (!transactionId) return formError(dict.errors.notFound);

  try {
    await voidTransaction(transactionId, reason || undefined);
  } catch (error) {
    return formError(isAppError(error) ? error.publicMessage : dict.errors.generic);
  }

  revalidatePath(`/${locale}/transactions`);
  revalidatePath(`/${locale}/transactions/${transactionId}`);
  revalidatePath(`/${locale}/dashboard`);
  return formSuccess(dict.transactions.voided);
}

export async function recordQuickTransactionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const context = await getWorkspaceContext();
  if (!context) return formError(dict.errors.unauthorized);
  if (!can(context.role, "transactions:create")) return formError(dict.errors.forbidden);

  const parsed = transactionSchema.safeParse({
    kind: formData.get("kind"),
    amount: formData.get("amount"),
    description: formData.get("description"),
    occurredOn: formData.get("occurredOn"),
    categoryId: formData.get("categoryId") || null,
    accountId: formData.get("accountId"),
    contactId: formData.get("contactId") || null,
    paymentMethod: formData.get("paymentMethod") ?? "cash",
    clientGeneratedId: formData.get("clientGeneratedId") || null,
  });
  if (!parsed.success) return formError(dict.errors.amountInvalid, fieldErrorsFrom(parsed.error));

  const supabase = await createClient();
  const payload = toTransactionPayload(parsed.data, context.workspace.id, context.workspace.currency, {
    channel: "web",
  });
  const { error } = await supabase.rpc("record_transaction", { p_payload: payload });
  if (error) return formError(dict.transactions.createError);

  revalidatePath(`/${locale}/dashboard`);
  revalidatePath(`/${locale}/transactions`);
  return formSuccess(dict.transactions.createSuccess);
}

export async function amendTransactionAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const context = await getWorkspaceContext();
  if (!context) return formError(dict.errors.unauthorized);
  if (!can(context.role, "transactions:create") || !can(context.role, "transactions:void")) {
    return formError(dict.errors.forbidden);
  }

  const transactionId = String(formData.get("transactionId") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(transactionId)) return formError(dict.errors.notFound);

  const parsed = transactionSchema.safeParse({
    kind: formData.get("kind"),
    amount: formData.get("amount"),
    description: formData.get("description"),
    occurredOn: formData.get("occurredOn"),
    categoryId: formData.get("categoryId") || null,
    accountId: formData.get("accountId"),
    counterAccountId: formData.get("counterAccountId") || null,
    contactId: formData.get("contactId") || null,
    paymentMethod: formData.get("paymentMethod") ?? "cash",
    reference: formData.get("reference") || null,
  });
  if (!parsed.success) return formError(dict.errors.amountInvalid, fieldErrorsFrom(parsed.error));

  const supabase = await createClient();
  const payload = toTransactionPayload(parsed.data, context.workspace.id, context.workspace.currency, {
    channel: "web",
  });
  const { data, error } = await supabase.rpc("amend_transaction", {
    p_transaction_id: transactionId,
    p_payload: payload,
    p_reason: String(formData.get("reason") ?? "").slice(0, 240) || null,
  });
  if (error) {
    return formError(
      error.code === "insufficient_privilege"
        ? dict.errors.forbidden
        : isAppError(error)
          ? error.publicMessage
          : dict.errors.generic,
    );
  }

  const nextId = (data as { id?: string } | null)?.id;
  revalidatePath(`/${locale}/dashboard`);
  revalidatePath(`/${locale}/transactions`);
  revalidatePath(`/${locale}/transactions/${transactionId}`);
  redirect(`/${locale}/transactions/${nextId ?? transactionId}`);
}
