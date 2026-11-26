import "server-only";

import { getServerEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/types/database";
import type { UssdSessionState } from "@/lib/ussd/menu";

export type LoadedUssdSession = {
  sessionId: string;
  phone: string;
  userId: string | null;
  workspaceId: string | null;
  state: UssdSessionState;
  expiresAt: string;
};

function parseState(value: Json): UssdSessionState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { version: 1, stage: "menu" };
  }
  const stage = value.stage;
  const validStages = ["menu", "amount", "category", "confirm", "language", "done"];
  return {
    version: 1,
    stage: typeof stage === "string" && validStages.includes(stage) ? (stage as UssdSessionState["stage"]) : "menu",
    kind: value.kind === "income" || value.kind === "expense" ? value.kind : undefined,
    amountMinor: typeof value.amountMinor === "string" ? value.amountMinor : undefined,
    categoryIds: Array.isArray(value.categoryIds)
      ? value.categoryIds.filter((id): id is string => typeof id === "string")
      : undefined,
    categoryId: typeof value.categoryId === "string" ? value.categoryId : undefined,
    accountId: typeof value.accountId === "string" ? value.accountId : undefined,
    currency: typeof value.currency === "string" ? value.currency : undefined,
    lastText: typeof value.lastText === "string" ? value.lastText : undefined,
    response: typeof value.response === "string" ? value.response : undefined,
    completedAt: typeof value.completedAt === "string" ? value.completedAt : undefined,
  };
}

function expiresAt(): string {
  return new Date(Date.now() + getServerEnv().USSD_SESSION_TTL_SECONDS * 1000).toISOString();
}

export async function loadUssdSession(sessionId: string): Promise<LoadedUssdSession | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ussd_sessions")
    .select("session_id, phone, user_id, workspace_id, state, expires_at")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) {
    logger.warn("ussd.session_read_failed", { code: error.code });
    throw new Error("Could not read the USSD session");
  }
  if (!data) return null;

  return {
    sessionId: data.session_id,
    phone: data.phone,
    userId: data.user_id,
    workspaceId: data.workspace_id,
    state: parseState(data.state as Json),
    expiresAt: data.expires_at,
  };
}

export async function saveUssdSession(params: {
  sessionId: string;
  phone: string;
  userId: string;
  workspaceId: string;
  state: UssdSessionState;
  serviceCode?: string | null;
}): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("ussd_sessions").upsert(
    {
      session_id: params.sessionId.slice(0, 120),
      phone: params.phone,
      workspace_id: params.workspaceId,
      user_id: params.userId,
      state: params.state as unknown as Json,
      service_code: params.serviceCode?.slice(0, 32) ?? null,
      expires_at: expiresAt(),
    },
    { onConflict: "session_id" },
  );
  if (error) {
    logger.warn("ussd.session_write_failed", { code: error.code });
    throw new Error("Could not save the USSD session");
  }
}

export async function completeUssdSession(params: {
  sessionId: string;
  phone: string;
  userId: string;
  workspaceId: string;
  state: UssdSessionState;
  text: string;
  response: string;
}): Promise<void> {
  const admin = createAdminClient();
  const completed: UssdSessionState = {
    ...params.state,
    stage: "done",
    lastText: params.text,
    response: params.response,
    completedAt: new Date().toISOString(),
  };
  const { error } = await admin
    .from("ussd_sessions")
    .update({
      state: completed as unknown as Json,
      expires_at: expiresAt(),
    })
    .eq("session_id", params.sessionId)
    .eq("phone", params.phone)
    .eq("workspace_id", params.workspaceId)
    .eq("user_id", params.userId);
  if (error) logger.warn("ussd.session_complete_failed", { code: error.code });
}
