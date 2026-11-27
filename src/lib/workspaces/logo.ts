import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { WorkspaceRow } from "@/types/database";

const LOGO_BUCKET = "kontaflow-workspace-logos";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

type LogoSource = Pick<WorkspaceRow, "id" | "logo_path" | "logo_url">;

function safeExternalLogo(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? value : null;
  } catch {
    return null;
  }
}

/**
 * Signed URLs are short-lived and scoped to the requesting member by storage
 * RLS. Paths are checked against the workspace id so a malformed row cannot be
 * used to sign an object from another tenant.
 */
export async function resolveWorkspaceLogoUrls(
  supabase: SupabaseClient,
  workspaces: LogoSource[],
): Promise<Record<string, string | null>> {
  const entries = await Promise.all(
    workspaces.map(async (workspace) => {
      const external = safeExternalLogo(workspace.logo_url);
      if (external) return [workspace.id, external] as const;
      if (!workspace.logo_path || !workspace.logo_path.startsWith(`${workspace.id}/`)) {
        return [workspace.id, null] as const;
      }

      const { data, error } = await supabase.storage
        .from(LOGO_BUCKET)
        .createSignedUrl(workspace.logo_path, SIGNED_URL_TTL_SECONDS);

      return [workspace.id, error ? null : (data?.signedUrl ?? null)] as const;
    }),
  );

  return Object.fromEntries(entries);
}
