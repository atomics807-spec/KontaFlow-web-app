import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { recordTransaction } from "@/services/transactions";
import { transactionSchema } from "@/lib/validation/schemas";
import { can } from "@/lib/permissions";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import type { WorkspaceRole } from "@/types/database";

const itemSchema = z.object({
  clientGeneratedId: z.string().min(8).max(120),
  workspaceId: z.uuid(),
  currency: z.string().min(3).max(3),
  kind: z.enum(["income", "expense", "transfer"]),
  amount: z.string().min(1).max(20),
  description: z.string().min(2).max(500),
  occurredOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  categoryId: z.uuid().nullable().optional(),
  accountId: z.uuid(),
  counterAccountId: z.uuid().nullable().optional(),
  contactId: z.uuid().nullable().optional(),
  paymentMethod: z.enum(["cash", "mobile_money", "bank_transfer", "card", "cheque", "other"]),
  reference: z.string().max(120).nullable().optional(),
});

const bodySchema = z.object({ items: z.array(itemSchema).min(1).max(100) });

type Result = {
  clientGeneratedId: string;
  status: "synced" | "duplicate" | "failed";
  error?: string;
  transactionId?: string;
};

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_payload" }, { status: 422 });
  }

  const workspaceIds = [...new Set(parsed.data.items.map((item) => item.workspaceId))];
  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .eq("status", "active")
    .in("workspace_id", workspaceIds);

  const roles = new Map((memberships ?? []).map((m) => [m.workspace_id, m.role as WorkspaceRole]));
  const results: Result[] = [];

  for (const item of parsed.data.items) {
    const role = roles.get(item.workspaceId);
    if (!role || !can(role, "transactions:create")) {
      results.push({ clientGeneratedId: item.clientGeneratedId, status: "failed", error: "forbidden" });
      continue;
    }

    const validated = transactionSchema.safeParse({
      kind: item.kind,
      amount: item.amount,
      description: item.description,
      occurredOn: item.occurredOn,
      categoryId: item.categoryId ?? null,
      accountId: item.accountId,
      counterAccountId: item.counterAccountId ?? null,
      contactId: item.contactId ?? null,
      paymentMethod: item.paymentMethod,
      reference: item.reference ?? null,
      clientGeneratedId: item.clientGeneratedId,
    });

    if (!validated.success) {
      results.push({
        clientGeneratedId: item.clientGeneratedId,
        status: "failed",
        error: validated.error.issues[0]?.message ?? "invalid_payload",
      });
      continue;
    }

    try {
      const created = await recordTransaction(item.workspaceId, item.currency, validated.data, {
        channel: "sync",
      });
      results.push({
        clientGeneratedId: item.clientGeneratedId,
        status: created.duplicate ? "duplicate" : "synced",
        transactionId: created.id,
      });
    } catch (error) {
      const message = isAppError(error) ? error.publicMessage : "Could not sync this entry.";
      if (!isAppError(error)) logger.error("sync.item_failed", { error });
      results.push({ clientGeneratedId: item.clientGeneratedId, status: "failed", error: message });
    }
  }

  return NextResponse.json({ results });
}
