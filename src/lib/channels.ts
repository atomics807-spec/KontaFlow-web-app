import "server-only";

import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppError } from "@/lib/errors";
import { formatMoney, moneyLocale } from "@/lib/money";
import { resolveLocale, type Locale } from "@/lib/i18n/config";

export type ChannelName = "ussd" | "whatsapp";

export type ChannelIdentity = {
  workspaceId: string;
  userId: string;
  channel: ChannelName;
  address: string;
  locale: Locale;
};

export function channelAddressCandidates(address: string): string[] {
  const digits = address.replace(/[^\d]/g, "");
  const set = new Set<string>([address, digits, `+${digits}`]);
  if (digits.startsWith("237") && digits.length > 9) {
    set.add(digits.slice(3));
    set.add(`+237${digits.slice(3)}`);
  }
  return [...set];
}

/** Maps an inbound phone number to the workspace it is linked to. */
export async function resolveChannelIdentity(
  channel: ChannelName,
  address: string,
): Promise<ChannelIdentity | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("channel_identities")
    .select("workspace_id, user_id, channel, address")
    .eq("channel", channel)
    .not("verified_at", "is", null)
    .in("address", channelAddressCandidates(address))
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  const [{ data: workspace }, { data: profile }, { data: membership }] = await Promise.all([
    admin.from("workspaces").select("locale").eq("id", data.workspace_id).maybeSingle(),
    admin.from("profiles").select("locale").eq("id", data.user_id).maybeSingle(),
    admin
      .from("workspace_members")
      .select("status")
      .eq("workspace_id", data.workspace_id)
      .eq("user_id", data.user_id)
      .maybeSingle(),
  ]);

  if (membership?.status !== "active") return null;

  return {
    workspaceId: data.workspace_id,
    userId: data.user_id,
    channel: data.channel as ChannelName,
    address: data.address,
    locale: resolveLocale(profile?.locale ?? workspace?.locale),
  };
}

/** Stable, bounded idempotency key for a channel message and tool call. */
export function channelClientId(channel: string, requestId: string): string {
  return `${channel}-${createHash("sha256").update(requestId).digest("hex").slice(0, 64)}`;
}

export async function recordChannelTransaction(params: {
  workspaceId: string;
  actorId: string;
  channel: Exclude<ChannelName, never> | "ai" | "system";
  kind: "income" | "expense";
  amountMinor: bigint;
  description: string;
  occurredOn?: string;
  categoryId?: string | null;
  accountId: string;
  paymentMethod?: "cash" | "mobile_money" | "bank_transfer" | "other";
  clientGeneratedId: string;
}): Promise<{ id: string; duplicate: boolean }> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("record_channel_transaction", {
    p_workspace_id: params.workspaceId,
    p_actor_id: params.actorId,
    p_channel: params.channel,
    p_payload: {
      kind: params.kind,
      amount_minor: params.amountMinor.toString(),
      description: params.description,
      occurred_on: params.occurredOn ?? null,
      category_id: params.categoryId ?? null,
      account_id: params.accountId,
      payment_method: params.paymentMethod ?? "cash",
      channel: params.channel,
      client_generated_id: params.clientGeneratedId,
    },
  });

  if (error) {
    throw new AppError("validation_failed", "That entry could not be recorded. Check the amount and try again.");
  }

  const result = data as { id: string; duplicate: boolean };
  return { id: result.id, duplicate: result.duplicate };
}

export async function defaultCashAccount(workspaceId: string): Promise<{ id: string; currency: string } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("accounts")
    .select("id, currency, subtype, name")
    .eq("workspace_id", workspaceId)
    .eq("is_archived", false)
    .in("subtype", ["cash", "mobile_money", "bank"])
    .order("subtype", { ascending: true })
    .limit(1)
    .maybeSingle();

  return data ? { id: data.id, currency: data.currency } : null;
}

export async function categoryFor(workspaceId: string, kind: "income" | "expense"): Promise<string | null> {
  const admin = createAdminClient();
  const preferred = kind === "income" ? "Sales" : "Other expenses";
  const { data } = await admin
    .from("categories")
    .select("id, name")
    .eq("workspace_id", workspaceId)
    .eq("kind", kind)
    .eq("is_archived", false);

  if (!data || data.length === 0) return null;
  return data.find((row) => row.name.toLowerCase() === preferred.toLowerCase())?.id ?? data[0].id;
}

export async function cashBalance(workspaceId: string): Promise<{ minor: bigint; currency: string }> {
  const admin = createAdminClient();
  const [{ data: workspace }, { data: balances }] = await Promise.all([
    admin.from("workspaces").select("currency").eq("id", workspaceId).maybeSingle(),
    admin.from("v_account_balances").select("name, balance_minor, currency").eq("workspace_id", workspaceId),
  ]);

  const currency = workspace?.currency ?? "XAF";
  const total = (balances ?? [])
    .filter((row) => ["Cash", "Mobile money", "Bank"].includes(row.name))
    .reduce((sum, row) => sum + BigInt(String(row.balance_minor ?? 0)), 0n);

  return { minor: total, currency };
}

export async function recentEntries(workspaceId: string, limit = 3) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("v_transactions")
    .select("occurred_on, kind, description, amount_minor, currency")
    .eq("workspace_id", workspaceId)
    .order("occurred_on", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export function formatMinor(minor: bigint, currency: string, locale = "en"): string {
  return formatMoney(minor, currency, moneyLocale(locale, currency));
}

export async function logUssdSession(params: {
  sessionId: string;
  phone: string;
  workspaceId?: string | null;
  userId?: string | null;
  state?: Record<string, unknown>;
  serviceCode?: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  await admin.from("ussd_sessions").upsert(
    {
      session_id: params.sessionId.slice(0, 120),
      phone: params.phone,
      workspace_id: params.workspaceId ?? null,
      user_id: params.userId ?? null,
      state: (params.state ?? {}) as never,
      service_code: params.serviceCode ?? null,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    },
    { onConflict: "session_id" },
  );
}

export async function logWhatsappMessage(params: {
  workspaceId: string | null;
  waMessageId: string | null;
  direction: "inbound" | "outbound";
  fromPhone: string;
  toPhone: string;
  body: string;
  status?: string;
}): Promise<void> {
  const admin = createAdminClient();
  await admin.from("whatsapp_messages").insert({
    workspace_id: params.workspaceId,
    wa_message_id: params.waMessageId,
    direction: params.direction,
    from_phone: params.fromPhone,
    to_phone: params.toPhone,
    message_type: "text",
    body: params.body.slice(0, 2000),
    status: params.status ?? "received",
  });
}
