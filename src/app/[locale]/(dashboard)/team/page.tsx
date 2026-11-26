import type { Metadata } from "next";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InviteMemberForm } from "@/components/forms/invite-member-form";
import { listPendingInvitations, listWorkspaceMembers } from "@/services/workspaces";
import { requireWorkspaceContext } from "@/lib/supabase/auth";
import { resolveLocale, intlLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/server";
import { formatDate } from "@/lib/dates";
import { planFor } from "@/lib/plans";
import { ROLE_RANK } from "@/lib/permissions";
import { changeRoleAction, removeMemberAction, revokeInvitationAction } from "./actions";
import type { WorkspaceRole } from "@/types/database";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const dict = await getDictionary(resolveLocale((await params).locale));
  return { title: dict.nav.team, robots: { index: false, follow: false } };
}

export default async function TeamPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = resolveLocale((await params).locale);
  const dict = await getDictionary(locale);
  const context = await requireWorkspaceContext(locale);

  const [members, invitations] = await Promise.all([
    listWorkspaceMembers(context.workspace.id),
    context.can("members:read") ? listPendingInvitations(context.workspace.id) : Promise.resolve([]),
  ]);

  const seats = planFor(context.workspace.plan).seats;
  const used = members.length + invitations.length;
  const canInvite = context.can("members:invite");
  const canUpdate = context.can("members:update");

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-forest">{dict.settings.members}</h1>
          <p className="mt-1 text-sm text-muted">{dict.settings.membersSubtitle}</p>
        </div>
        {canInvite ? <InviteMemberForm /> : null}
      </header>

      <div className="flex items-center gap-2 text-xs text-muted">
        <Badge tone="outline">
          {used} / {seats} {dict.settings.members}
        </Badge>
        <span>{dict.plans.current}</span>
      </div>

      <Card className="overflow-hidden">
        <ul className="divide-y divide-line/70">
          {members.map((member) => {
            const editable = canUpdate && member.role !== "owner" && member.user_id !== context.user.id;
            return (
              <li key={member.id} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={member.full_name || member.email} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-forest">
                      {member.full_name || member.email.split("@")[0]}
                      {member.user_id === context.user.id ? (
                        <span className="ml-1.5 text-[0.65rem] font-semibold text-muted">({dict.common.profile})</span>
                      ) : null}
                    </p>
                    <p className="truncate text-xs text-muted">{member.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:justify-end">
                  {editable ? (
                    <form action={changeRoleAction} className="flex items-center gap-1.5">
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="memberId" value={member.id} />
                      <label htmlFor={`role-${member.id}`} className="sr-only">
                        {dict.settings.role}
                      </label>
                      <select
                        id={`role-${member.id}`}
                        name="role"
                        defaultValue={member.role}
                        className="h-8 rounded-lg border border-line bg-white px-2 text-xs font-semibold text-forest"
                      >
                        {(Object.keys(ROLE_RANK) as WorkspaceRole[])
                          .filter((role) => role !== "owner" && ROLE_RANK[role] <= ROLE_RANK[context.role])
                          .map((role) => (
                            <option key={role} value={role}>
                              {dict.roles[role]}
                            </option>
                          ))}
                      </select>
                      <Button type="submit" variant="secondary" size="sm" className="h-8 px-2 text-xs">
                        {dict.common.save}
                      </Button>
                    </form>
                  ) : (
                    <Badge tone={member.role === "owner" ? "forest" : "jade"}>{dict.roles[member.role]}</Badge>
                  )}

                  {member.joined_at ? (
                    <span className="hidden text-[0.7rem] text-muted sm:inline">
                      {formatDate(member.joined_at, intlLocale(locale))}
                    </span>
                  ) : null}

                  {canUpdate && member.role !== "owner" && member.user_id !== context.user.id ? (
                    <form action={removeMemberAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="memberId" value={member.id} />
                      <Button type="submit" variant="ghost" size="sm" className="h-8 px-2 text-xs text-clay">
                        {dict.settings.removeMember}
                      </Button>
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {invitations.length > 0 ? (
        <section aria-labelledby="pending-invites" className="space-y-2">
          <h2 id="pending-invites" className="text-sm font-bold text-forest">
            {dict.settings.pendingInvites}
          </h2>
          <Card className="overflow-hidden">
            <ul className="divide-y divide-line/70">
              {invitations.map((invitation) => (
                <li key={invitation.id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-forest">{invitation.email}</p>
                    <p className="text-xs text-muted">
                      {dict.roles[invitation.role as WorkspaceRole]} ·{" "}
                      {formatDate(invitation.expires_at, intlLocale(locale))}
                    </p>
                  </div>
                  {canUpdate ? (
                    <form action={revokeInvitationAction}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="invitationId" value={invitation.id} />
                      <Button type="submit" variant="ghost" size="sm" className="text-xs text-clay">
                        {dict.settings.removeMember}
                      </Button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ) : null}

      <p className="text-xs leading-relaxed text-muted">{dict.roles.ownerDesc}</p>
    </div>
  );
}
