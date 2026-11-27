import "server-only";

import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { assertNoError } from "@/lib/supabase/errors";
import type {
  ChannelIdentityRow,
  ContactRow,
  MemberStatus,
  SubscriptionRow,
  WorkspaceInvitationRow,
  WorkspaceRole,
} from "@/types/database";

export async function listContacts(workspaceId: string, search?: string): Promise<ContactRow[]> {
  const supabase = await createClient();
  let query = supabase
    .from("contacts")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("is_archived", false)
    .order("name")
    .limit(200);

  if (search) {
    const term = search.replace(/[%,()]/g, " ").trim();
    if (term) query = query.or(`name.ilike.%${term}%,phone.ilike.%${term}%`);
  }

  const { data, error } = await query;
  if (error) throw assertNoError(error, "Could not load contacts.");
  return data ?? [];
}

export type ContactInput = {
  name: string;
  kind: "customer" | "supplier" | "both";
  phone?: string;
  email?: string;
  address?: string;
  taxId?: string;
  notes?: string;
};

export async function createContact(workspaceId: string, userId: string, input: ContactInput): Promise<ContactRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      workspace_id: workspaceId,
      created_by: userId,
      name: input.name,
      kind: input.kind,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      tax_id: input.taxId?.trim() || null,
      notes: input.notes?.trim() || null,
    })
    .select("*")
    .single();

  if (error) throw assertNoError(error, "Could not save the contact.");
  return data;
}

export async function archiveContact(contactId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("contacts").update({ is_archived: true }).eq("id", contactId);
  if (error) throw assertNoError(error, "Could not archive the contact.");
}

// ---------------------------------------------------------------------------
// Workspace administration
// ---------------------------------------------------------------------------

export type MemberDirectoryRow = {
  id: string;
  user_id: string;
  role: WorkspaceRole;
  status: MemberStatus;
  joined_at: string | null;
  full_name: string;
  email: string;
};

export async function listWorkspaceMembers(workspaceId: string): Promise<MemberDirectoryRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_workspace_members", { p_workspace_id: workspaceId });
  if (error) throw assertNoError(error, "Could not load the team.");
  return (data ?? []) as MemberDirectoryRow[];
}

export async function listPendingInvitations(workspaceId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_invitations")
    .select("*")
    .eq("workspace_id", workspaceId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  if (error) throw assertNoError(error, "Could not load invitations.");
  return data ?? [];
}

export async function getSubscription(workspaceId: string): Promise<SubscriptionRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (error) throw assertNoError(error, "Could not load billing.");
  return data;
}

export async function updateWorkspace(
  workspaceId: string,
  input: { name: string; legalName?: string; currency: string; timezone: string; country: string; locale: string },
): Promise<void> {
  const supabase = await createClient();

  const { data: workspace, error: readError } = await supabase
    .from("workspaces")
    .select("currency")
    .eq("id", workspaceId)
    .single();
  if (readError) throw assertNoError(readError, "Could not load the workspace.");

  if (workspace.currency !== input.currency) {
    // Changing currency would reinterpret every stored amount.
    const { count, error: countError } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId);
    if (countError) throw assertNoError(countError, "Could not verify the currency change.");
    if ((count ?? 0) > 0) {
      throw new AppError(
        "conflict",
        "This workspace already has transactions, so its currency cannot change.",
      );
    }
  }

  const { error } = await supabase
    .from("workspaces")
    .update({
      name: input.name,
      legal_name: input.legalName?.trim() || null,
      currency: input.currency,
      timezone: input.timezone,
      country_code: input.country.toUpperCase(),
      locale: input.locale,
    })
    .eq("id", workspaceId);

  if (error) throw assertNoError(error, "Could not save the workspace settings.");
}

export async function removeMember(workspaceId: string, memberId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("id", memberId);
  if (error) throw assertNoError(error, "Could not remove the member.");
}

export async function updateMemberRole(
  workspaceId: string,
  memberId: string,
  role: WorkspaceRole,
): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", workspaceId)
    .eq("id", memberId);
  if (error) throw assertNoError(error, "Could not change the role.");
}

export async function listAuditLogs(workspaceId: string, limit = 40) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw assertNoError(error, "Could not load the audit trail.");
  return data ?? [];
}

export async function inviteMember(
  workspaceId: string,
  email: string,
  role: WorkspaceRole,
  invitedBy: string,
): Promise<WorkspaceInvitationRow> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("workspace_invitations")
    .insert({
      workspace_id: workspaceId,
      email: email.toLowerCase(),
      role,
      invited_by: invitedBy,
      token: crypto.randomUUID(),
      status: "pending",
      expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new AppError("conflict", "That person already has a pending invitation.");
    }
    throw assertNoError(error, "Could not create the invitation.");
  }
  return data as WorkspaceInvitationRow;
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.from("workspace_invitations").update({ status: "revoked" }).eq("id", invitationId);
  if (error) throw assertNoError(error, "Could not revoke the invitation.");
}

export async function listChannelIdentities(workspaceId: string): Promise<ChannelIdentityRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("channel_identities")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });
  if (error) throw assertNoError(error, "Could not load connected channels.");
  return (data ?? []) as ChannelIdentityRow[];
}
