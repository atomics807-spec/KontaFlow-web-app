import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getWorkspaceContext } from "@/lib/supabase/auth";
import { getTransactionOptions, listTransactions } from "@/services/transactions";
import { pickTranslation, resolveLocale } from "@/lib/i18n/config";
import { getWorkspaceEntitlements } from "@/lib/entitlements/service";

export const dynamic = "force-dynamic";

/**
 * A deliberately small, authenticated payload for IndexedDB. It is never
 * cached by the service worker; the browser stores it per user in Dexie.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthenticated" }, { status: 401 });

  const context = await getWorkspaceContext();
  if (!context) return NextResponse.json({ error: "no_workspace" }, { status: 403 });

  const entitlements = await getWorkspaceEntitlements(context.workspace.id, user.id);
  if (!entitlements.features.offline_bookkeeping.included) {
    return NextResponse.json({ error: "plan_required" }, { status: 402 });
  }
  if (!entitlements.writable) {
    return NextResponse.json({ error: "read_only" }, { status: 402 });
  }

  const locale = resolveLocale(new URL(request.url).searchParams.get("locale") ?? "en");
  const [options, transactions] = await Promise.all([
    getTransactionOptions(context.workspace.id),
    listTransactions(context.workspace.id, { limit: 25 }),
  ]);

  return NextResponse.json(
    {
      workspaceId: context.workspace.id,
      identity: {
        userId: user.id,
        workspaceId: context.workspace.id,
        workspaceName: context.workspace.name,
        currency: context.workspace.currency,
        timezone: context.workspace.timezone,
        role: context.role,
        locale,
      },
      accounts: options.accounts.map((row) => ({
        id: row.id,
        name: row.name,
        subtype: row.subtype,
      })),
      categories: options.categories.map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind,
        color: row.color,
        translations: row.translations,
      })),
      contacts: options.contacts.map((row) => ({
        id: row.id,
        name: row.name,
        kind: row.kind,
      })),
      transactions: transactions.map((row) => ({
        id: row.id,
        kind: row.kind,
        amountMinor: String(row.amount_minor),
        currency: row.currency,
        occurredOn: row.occurred_on,
        description: row.description,
        categoryName: pickTranslation(row.category_translations, locale) ?? row.category_name,
        accountName: row.account_name,
        status: row.status,
        channel: row.channel,
      })),
    },
    { headers: { "cache-control": "no-store", vary: "Cookie" } },
  );
}
