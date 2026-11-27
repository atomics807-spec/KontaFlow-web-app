import "server-only";

import { AppError } from "@/lib/errors";
import { createClient } from "@/lib/supabase/server";
import { assertNoError } from "@/lib/supabase/errors";
import type {
  PlatformAdminAccount,
  PlatformAdminAuditEntry,
  PlatformAdminOperationsOverview,
  PlatformAdminOverview,
  PlatformAdminPayment,
  PlatformAdminUser,
  PlatformAdminWorkspace,
  PlatformAiUsage,
  PlatformEmailDelivery,
  PlatformIntegrationStatus,
  PlatformSecurityAudit,
  PlatformSupportAccessGrant,
  PlatformSupportRequest,
  PlatformUssdActivity,
  PlatformUsageMetrics,
  PlatformWhatsappActivity,
  SupportSnapshot,
  SystemAnnouncement,
} from "@/types/platform-admin";

export async function getPlatformOverview(): Promise<PlatformAdminOverview> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_admin_overview");
  if (error) throw assertNoError(error, "Could not load platform totals.");
  if (!data) throw new AppError("not_found", "Platform totals are unavailable.");
  return data;
}

export async function listPlatformUsers(search?: string): Promise<PlatformAdminUser[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_admin_list_users", {
    p_search: search?.trim() || null,
    p_limit: 100,
    p_offset: 0,
  });
  if (error) throw assertNoError(error, "Could not load accounts.");
  return data ?? [];
}

export async function listPlatformWorkspaces(search?: string): Promise<PlatformAdminWorkspace[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_admin_list_workspaces", {
    p_search: search?.trim() || null,
    p_limit: 100,
    p_offset: 0,
  });
  if (error) throw assertNoError(error, "Could not load workspaces.");
  return data ?? [];
}

export async function listPlatformAdmins(): Promise<PlatformAdminAccount[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_admin_list_admins");
  if (error) throw assertNoError(error, "Could not load platform administrators.");
  return data ?? [];
}

export async function listPlatformAudit(): Promise<PlatformAdminAuditEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_admin_list_audit", { p_limit: 100 });
  if (error) throw assertNoError(error, "Could not load the platform audit log.");
  return data ?? [];
}

export async function getPlatformOperationsOverview(): Promise<PlatformAdminOperationsOverview> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_admin_operations_overview");
  if (error) throw assertNoError(error, "Could not load operations totals.");
  return data as PlatformAdminOperationsOverview;
}

export async function listPlatformPayments(
  status?: string,
  search?: string,
): Promise<PlatformAdminPayment[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_admin_list_payments", {
    p_status: status?.trim() || null,
    p_search: search?.trim() || null,
    p_limit: 200,
    p_offset: 0,
  });
  if (error) throw assertNoError(error, "Could not load payments.");
  return (data ?? []) as PlatformAdminPayment[];
}

export async function listPlatformSupportRequests(status?: string): Promise<PlatformSupportRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_admin_list_support_requests", {
    p_status: status?.trim() || null,
    p_limit: 200,
  });
  if (error) throw assertNoError(error, "Could not load support requests.");
  return (data ?? []) as PlatformSupportRequest[];
}

export async function getPlatformIntegrationStatus(): Promise<PlatformIntegrationStatus> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_admin_integration_status");
  if (error) throw assertNoError(error, "Could not load integration status.");
  return data as PlatformIntegrationStatus;
}

export async function getPlatformUsageMetrics(): Promise<PlatformUsageMetrics> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_admin_usage_metrics");
  if (error) throw assertNoError(error, "Could not load usage metrics.");
  return data as PlatformUsageMetrics;
}

export async function getPlatformAiUsage(): Promise<PlatformAiUsage> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_admin_ai_usage");
  if (error) throw assertNoError(error, "Could not load AI usage.");
  return data as PlatformAiUsage;
}

export async function getPlatformEmailDelivery(): Promise<PlatformEmailDelivery> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_admin_email_delivery");
  if (error) throw assertNoError(error, "Could not load email delivery records.");
  return data as PlatformEmailDelivery;
}

export async function getPlatformUssdActivity(): Promise<PlatformUssdActivity> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_admin_ussd_activity");
  if (error) throw assertNoError(error, "Could not load USSD activity.");
  return data as PlatformUssdActivity;
}

export async function getPlatformWhatsappActivity(): Promise<PlatformWhatsappActivity> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_admin_whatsapp_activity");
  if (error) throw assertNoError(error, "Could not load WhatsApp activity.");
  return data as PlatformWhatsappActivity;
}

export async function getPlatformSecurityAudit(): Promise<PlatformSecurityAudit> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_admin_security_audit", { p_limit: 200 });
  if (error) throw assertNoError(error, "Could not load the security audit log.");
  return data as PlatformSecurityAudit;
}

export async function listPlatformAnnouncements(): Promise<SystemAnnouncement[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_admin_list_announcements");
  if (error) throw assertNoError(error, "Could not load announcements.");
  return (data ?? []) as SystemAnnouncement[];
}

export async function listPlatformSupportAccess(): Promise<PlatformSupportAccessGrant[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_admin_support_access_list", { p_limit: 200 });
  if (error) throw assertNoError(error, "Could not load support access grants.");
  return (data ?? []) as PlatformSupportAccessGrant[];
}

export async function getPlatformSupportSnapshot(workspaceId: string): Promise<SupportSnapshot> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_admin_support_snapshot", {
    p_workspace_id: workspaceId,
  });
  if (error) throw assertNoError(error, "An approved support access grant is required.");
  if (!data) throw new AppError("not_found", "The support snapshot is unavailable.");
  return data as SupportSnapshot;
}
