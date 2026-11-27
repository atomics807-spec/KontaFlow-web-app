import "server-only";

import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { assertNoError } from "@/lib/supabase/errors";
import { toTransactionPayload, type TransactionInput } from "@/lib/validation/schemas";
import type {
  AccountRow,
  AttachmentRow,
  AuditLogRow,
  CategoryRow,
  ContactRow,
  TransactionKind,
  TransactionStatus,
  TransactionViewRow,
} from "@/types/database";

export type TransactionFilters = {
  kind?: TransactionKind | "all";
  status?: TransactionStatus | "all";
  categoryId?: string;
  search?: string;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
};

export type TransactionDetail = {
  transaction: TransactionViewRow & {
    recorded_at: string;
    recorded_timezone: string;
    void_reason: string | null;
    voided_at: string | null;
    sync_received_at: string | null;
    client_generated_id: string | null;
    counter_account_id: string | null;
  };
  attachments: AttachmentRow[];
  audit: (AuditLogRow & { actor_name: string | null })[];
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
    .order("created_at", { ascending: false });

  const limit = filters.limit ?? 50;
  const offset = filters.offset ?? 0;
  query = query.range(offset, offset + limit - 1);

  if (filters.kind && filters.kind !== "all") query = query.eq("kind", filters.kind);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
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

export async function getTransactionDetail(
  workspaceId: string,
  transactionId: string,
): Promise<TransactionDetail | null> {
  const supabase = await createClient();
  const [viewResult, rawResult, attachmentResult, auditResult] = await Promise.all([
    supabase
      .from("v_transactions")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("id", transactionId)
      .maybeSingle(),
    supabase
      .from("transactions")
      .select("recorded_at, recorded_timezone, void_reason, voided_at, sync_received_at, client_generated_id, counter_account_id")
      .eq("workspace_id", workspaceId)
      .eq("id", transactionId)
      .maybeSingle(),
    supabase
      .from("attachments")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("transaction_id", transactionId)
      .order("created_at"),
    supabase
      .from("audit_logs")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("entity", "transaction")
      .eq("entity_id", transactionId)
      .order("created_at", { ascending: true }),
  ]);

  for (const result of [viewResult, rawResult, attachmentResult, auditResult]) {
    if (result.error) throw assertNoError(result.error, "Could not load the transaction.");
  }
  if (!viewResult.data || !rawResult.data) return null;

  const auditRows = (auditResult.data ?? []) as AuditLogRow[];
  const actorIds = [...new Set(auditRows.map((row) => row.actor_id).filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  if (actorIds.length > 0) {
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", actorIds);
    for (const profile of profiles ?? []) {
      if (profile.full_name) names.set(profile.id, profile.full_name);
    }
  }

  return {
    transaction: {
      ...viewResult.data,
      ...rawResult.data,
    } as TransactionDetail["transaction"],
    attachments: (attachmentResult.data ?? []) as AttachmentRow[],
    audit: auditRows.map((row) => ({
      ...row,
      actor_name: row.actor_id ? names.get(row.actor_id) ?? null : null,
    })),
  };
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

export type TransactionCursor = { occurredOn: string; createdAt: string; id: string };

export type TransactionPage = {
  rows: TransactionViewRow[];
  nextCursor: string | null;
};

function encodeCursor(row: TransactionViewRow): string {
  return Buffer.from(
    JSON.stringify({ occurredOn: row.occurred_on, createdAt: row.created_at, id: row.id }),
  ).toString("base64url");
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

function decodeCursor(value: string): TransactionCursor | null {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as TransactionCursor;
    if (
      /^\d{4}-\d{2}-\d{2}$/.test(parsed.occurredOn) &&
      ISO_TIMESTAMP_PATTERN.test(parsed.createdAt) &&
      !Number.isNaN(Date.parse(parsed.createdAt)) &&
      UUID_PATTERN.test(parsed.id)
    ) {
      return parsed;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Keyset pagination for large tenant ledgers. Offset pagination becomes
 * progressively slower on deep pages; this stays on the composite index.
 */
export async function listTransactionsPage(
  workspaceId: string,
  filters: TransactionFilters & { cursor?: string | null } = {},
): Promise<TransactionPage> {
  const supabase = await createClient();
  const requestedLimit = Number.isFinite(filters.limit) ? Number(filters.limit) : 50;
  const limit = Math.min(Math.max(requestedLimit, 1), 100);
  let query = supabase
    .from("v_transactions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("occurred_on", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  if (filters.kind && filters.kind !== "all") query = query.eq("kind", filters.kind);
  if (filters.status && filters.status !== "all") query = query.eq("status", filters.status);
  if (filters.categoryId) query = query.eq("category_id", filters.categoryId);
  if (filters.from) query = query.gte("occurred_on", filters.from);
  if (filters.to) query = query.lte("occurred_on", filters.to);
  if (filters.search) {
    const term = filters.search.replace(/[%,()]/g, " ").trim();
    if (term) query = query.or(`description.ilike.%${term}%,reference.ilike.%${term}%`);
  }

  const cursor = filters.cursor ? decodeCursor(filters.cursor) : null;
  if (filters.cursor && !cursor) throw new AppError("validation_failed", "Invalid page cursor.");
  if (cursor) {
    const { occurredOn, createdAt, id } = cursor;
    query = query.or(
      `occurred_on.lt.${occurredOn},and(occurred_on.eq.${occurredOn},created_at.lt.${createdAt}),` +
        `and(occurred_on.eq.${occurredOn},created_at.eq.${createdAt},id.lt.${id})`,
    );
  }

  const { data, error } = await query;
  if (error) throw assertNoError(error, "Could not load transactions.");
  const rows = (data ?? []) as TransactionViewRow[];
  const pageRows = rows.slice(0, limit);
  return {
    rows: pageRows,
    nextCursor: rows.length > limit && pageRows.length ? encodeCursor(pageRows[pageRows.length - 1]!) : null,
  };
}
