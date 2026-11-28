"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/supabase/auth";
import { resolveLocale } from "@/lib/i18n/config";
import { logger } from "@/lib/logger";

export async function setEasyModeAction(formData: FormData): Promise<void> {
  const locale = resolveLocale(String(formData.get("locale") ?? "en"));
  const mode = formData.get("mode") === "full" ? "full" : "easy";
  const user = await getSessionUser();
  if (!user) redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/${mode}`)}`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ easy_mode: mode === "easy" })
    .eq("id", user.id);
  if (error) logger.warn("profile.easy_mode_update_failed", { code: error.code });

  revalidatePath("/", "layout");
  redirect(`/${locale}/${mode === "easy" ? "easy" : "dashboard"}`);
}
