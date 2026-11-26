"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser, WORKSPACE_COOKIE } from "@/lib/supabase/auth";
import { resolveLocale } from "@/lib/i18n/config";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function acceptInvitationAction(formData: FormData): Promise<void> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const token = String(formData.get("token") ?? "");

  const user = await getSessionUser();
  if (!user) {
    redirect(`/${locale}/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  if (!UUID.test(token)) {
    redirect(`/${locale}/invite/${token}?error=invalid`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_invitation", { p_token: token });

  if (error || !data) {
    redirect(`/${locale}/invite/${token}?error=rejected`);
  }

  const cookieStore = await cookies();
  cookieStore.set(WORKSPACE_COOKIE, data.workspace_id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  revalidatePath("/", "layout");
  redirect(`/${locale}/dashboard`);
}
