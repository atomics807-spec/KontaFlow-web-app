"use server";

import { revalidatePath } from "next/cache";
import { getWorkspaceContext } from "@/lib/supabase/auth";
import { can } from "@/lib/permissions";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { voidTransaction } from "@/services/transactions";
import { isAppError } from "@/lib/errors";
import { formError, formSuccess, type FormState } from "@/lib/action-utils";

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
  revalidatePath(`/${locale}/dashboard`);
  return formSuccess(dict.transactions.voided);
}
