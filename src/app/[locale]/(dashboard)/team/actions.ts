"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getWorkspaceContext } from "@/lib/supabase/auth";
import { can, isAtLeast, ROLE_RANK } from "@/lib/permissions";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { inviteMember, listPendingInvitations, listWorkspaceMembers, removeMember, revokeInvitation, updateMemberRole } from "@/services/workspaces";
import { sendInvitationEmail } from "@/lib/integrations/email";
import { planFor } from "@/lib/plans";
import { formError, formSuccess, type FormState } from "@/lib/action-utils";
import { isAppError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getPublicEnv } from "@/lib/env";
import type { WorkspaceRole } from "@/types/database";

const inviteSchema = z.object({
  email: z.email(),
  role: z.enum(["admin", "accountant", "manager", "staff"]),
});

const roleCopy: Record<string, string> = {
  en: "Invitation created. Share this link:",
  fr: "Invitation créée. Partagez ce lien :",
  wes: "Invite don ready. Share this link:",
};

export async function inviteMemberAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const dict = await getDictionary(locale);
  const context = await getWorkspaceContext();
  if (!context) return formError(dict.errors.unauthorized);
  if (!can(context.role, "members:invite")) return formError(dict.errors.forbidden);

  const parsed = inviteSchema.safeParse({
    email: String(formData.get("email") ?? "").trim().toLowerCase(),
    role: formData.get("role") ?? "staff",
  });
  if (!parsed.success) return formError(dict.auth.emailInvalid);

  const [members, invitations] = await Promise.all([
    listWorkspaceMembers(context.workspace.id),
    listPendingInvitations(context.workspace.id),
  ]);
  const seats = planFor(context.workspace.plan).seats;
  if (members.length + invitations.length >= seats) {
    return formError(
      locale === "fr"
        ? `Votre forfait autorise ${seats} membres. Passez à un forfait supérieur pour inviter davantage de personnes.`
        : locale === "wes"
          ? `Your plan allow ${seats} members. Upgrade before you add more people.`
          : `Your plan allows ${seats} members. Upgrade to invite more people.`,
    );
  }

  if (parsed.data.role === "admin" && !isAtLeast(context.role, "owner")) {
    return formError(dict.errors.forbidden);
  }

  try {
    const invitation = await inviteMember(
      context.workspace.id,
      parsed.data.email,
      parsed.data.role as WorkspaceRole,
      context.user.id,
    );

    const inviteUrl = `${getPublicEnv().NEXT_PUBLIC_APP_URL}/${locale}/invite/${invitation.token}`;
    const email = await sendInvitationEmail({
      to: parsed.data.email,
      workspaceName: context.workspace.name,
      inviterName: context.profile.full_name || context.user.email || "KontaFlow",
      inviteUrl,
      locale,
    });

    revalidatePath(`/${locale}/team`);

    if (!email.sent) {
      return formSuccess(`${roleCopy[locale] ?? roleCopy.en} ${inviteUrl}`);
    }
    return formSuccess(dict.settings.inviteSent);
  } catch (error) {
    logger.warn("team.invite_failed", { error });
    return formError(isAppError(error) ? error.publicMessage : dict.errors.generic);
  }
}

export async function changeRoleAction(formData: FormData): Promise<void> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const context = await getWorkspaceContext();
  if (!context || !can(context.role, "members:update")) return;

  const memberId = String(formData.get("memberId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!(role in ROLE_RANK) || role === "owner") return;

  const members = await listWorkspaceMembers(context.workspace.id);
  const target = members.find((member) => member.id === memberId);
  if (!target) return;
  if (target.role === "owner") return;
  if (ROLE_RANK[role as WorkspaceRole] > ROLE_RANK[context.role]) return;

  try {
    await updateMemberRole(context.workspace.id, memberId, role as WorkspaceRole);
  } catch (error) {
    logger.warn("team.role_change_failed", { error });
  }
  revalidatePath(`/${locale}/team`);
}

export async function removeMemberAction(formData: FormData): Promise<void> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const context = await getWorkspaceContext();
  if (!context || !can(context.role, "members:remove")) return;

  const memberId = String(formData.get("memberId") ?? "");
  if (!memberId) return;

  const members = await listWorkspaceMembers(context.workspace.id);
  const target = members.find((member) => member.id === memberId);
  if (!target || target.role === "owner") return;
  if (target.user_id === context.user.id) return;

  try {
    await removeMember(context.workspace.id, memberId);
  } catch (error) {
    logger.warn("team.remove_failed", { error });
  }
  revalidatePath(`/${locale}/team`);
}

export async function revokeInvitationAction(formData: FormData): Promise<void> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const context = await getWorkspaceContext();
  if (!context || !can(context.role, "members:remove")) return;
  const invitationId = String(formData.get("invitationId") ?? "");
  if (!invitationId) return;
  try {
    await revokeInvitation(invitationId);
  } catch (error) {
    logger.warn("team.revoke_failed", { error });
  }
  revalidatePath(`/${locale}/team`);
}
