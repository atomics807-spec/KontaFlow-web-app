import "server-only";

import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { assertNoError } from "@/lib/supabase/errors";
import { toTransactionPayload, type TransactionInput } from "@/lib/validation/schemas";
import type { AccountRow, CategoryRow, ContactRow, TransactionKind, TransactionViewRow } from "@/types/database";

export type TransactionFilters = {
  kind?: TransactionKind | "all";
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
};

export async function listTransactions(
  workspaceId: string,
  filters: TransactionFilters = {},
): Promise<TransactionViewRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("v_transactions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(filters.limit ?? 50);

  if (filters.kind && filters.kind !== "all") query = query.eq("kind", filters.kind);
  if (filters.from) query = query.gte("occurred_on", filters.from);
  if (filters.to) query = query.lte("occurred_on", filters.to);
  if (filters.search) {
    const term = filters.search.replace(/[%,()]/g, " ").trim();
    if (term) query = query.or(`description.ilike.%${term}%,reference.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw assertNoError(error, "Could not load transactions.");
  return data ?? [];
}

export type TransactionOptions = {
  accounts: AccountRow[];
  categories: CategoryRow[];
  contacts: ContactRow[];
};

export async function getTransactionOptions(workspaceId: string): Promise<TransactionOptions> {
  const supabase = await createClient();
  const [accounts, categories, contacts] = await Promise.all([
    supabase
      .from("accounts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("type", "asset")
      .in("subtype", ["cash", "bank", "mobile_money"])
      .eq("is_archived", false)
      .order("name"),
    supabase
      .from("categories")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("is_archived", false)
      .order("kind")
      .order("name"),
    supabase
      .from("contacts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("is_archived", false)
      .order("name"),
  ]);

  for (const result of [accounts, categories, contacts]) {
    if (result.error) throw assertNoError(result.error, "Could not load the transaction form.");
  }

  return {
    accounts: accounts.data ?? [],
    categories: categories.data ?? [],
    contacts: contacts.data ?? [],
  };
}

export type RecordTransactionResult = {
  id: string;
  duplicate: boolean;
  amountMinor: bigint;
};

export type ReceiptAttachment = {
  path: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export async function recordTransaction(
  workspaceId: string,
  currency: string,
  input: TransactionInput,
  options?: { channel?: string; attachment?: ReceiptAttachment | null },
): Promise<RecordTransactionResult> {
  const supabase = await createClient();
  if (options?.attachment && !options.attachment.path.startsWith(`${workspaceId}/`)) {
    throw new AppError("forbidden", "That receipt does not belong to this workspace.");
  }
  const payload = toTransactionPayload(input, workspaceId, currency, {
    channel: options?.channel,
    attachmentPath: options?.attachment?.path ?? null,
  });

  const { data, error } = await supabase.rpc("record_transaction", { p_payload: payload });
  if (error) throw assertNoError(error, "Could not record the transaction.");
  if (!data) throw new AppError("internal_error", "Could not record the transaction.");

  if (options?.attachment) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) throw new AppError("unauthenticated", "Sign in again to attach the receipt.");

    const { error: attachmentError } = await supabase.from("attachments").upsert(
      {
        workspace_id: workspaceId,
        transaction_id: data.id,
        storage_path: options.attachment.path,
        file_name: options.attachment.fileName,
        mime_type: options.attachment.mimeType,
        size_bytes: options.attachment.sizeBytes,
        uploaded_by: user.id,
      },
      { onConflict: "workspace_id,storage_path", ignoreDuplicates: true },
    );
    if (attachmentError) throw assertNoError(attachmentError, "Could not save the receipt.");
  }

  return {
    id: data.id,
    duplicate: Boolean(data.duplicate),
    amountMinor: BigInt(String(data.amount_minor ?? payload.amount_minor)),
  };
}

export async function voidTransaction(transactionId: string, reason?: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("void_transaction", {
    p_transaction_id: transactionId,
    p_reason: reason ?? null,
  });
  if (error) throw assertNoError(error, "Could not void the transaction.");
}
