"use server";

import { revalidatePath } from "next/cache";
import { getWorkspaceContext } from "@/lib/supabase/auth";
import { logger } from "@/lib/logger";
import { resolveLocale } from "@/lib/i18n/config";
import { markAllNotificationsRead, markNotificationRead } from "@/services/notifications";

export async function markNotificationReadAction(id: string, locale: string): Promise<void> {
  const context = await getWorkspaceContext();
  if (!context || !id) return;
  const safeLocale = resolveLocale(locale);
  try {
    await markNotificationRead(context.workspace.id, id, context.user.id);
    revalidatePath(`/${safeLocale}`, "layout");
  } catch (error) {
    logger.warn("notifications.mark_read_failed", { error });
  }
}

export async function markAllNotificationsReadAction(locale: string): Promise<void> {
  const context = await getWorkspaceContext();
  if (!context) return;
  const safeLocale = resolveLocale(locale);
  try {
    await markAllNotificationsRead(context.workspace.id, context.user.id);
    revalidatePath(`/${safeLocale}`, "layout");
  } catch (error) {
    logger.warn("notifications.mark_all_failed", { error });
  }
}
