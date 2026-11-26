#!/usr/bin/env tsx
/**
 * Provisions the demo platform super administrator.
 *
 *   npm run demo:super-admin
 *
 * Reads .env.local so it never receives credentials on the command line.
 * The account exists only in public.platform_admins, never in workspace_members.
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

function loadEnvFile(file: string): void {
  if (!existsSync(file)) return;
  for (const rawLine of readFileSync(file, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

async function main(): Promise<void> {
  loadEnvFile(".env.local");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  }

  const email = process.env.KONTAFLOW_SUPER_ADMIN_EMAIL ?? "superadmin@kontaflow.demo";
  const configuredPassword = process.env.KONTAFLOW_SUPER_ADMIN_PASSWORD;
  const demoPassword = "KontaFlowDemo2026!";
  const password = configuredPassword || demoPassword;
  const production = process.env.APP_ENV === "production" || process.env.VERCEL_ENV === "production";
  if (production && (!configuredPassword || password === demoPassword)) {
    throw new Error("Set a private KONTAFLOW_SUPER_ADMIN_PASSWORD before provisioning a production console.");
  }
  if (password.length < 12) {
    throw new Error("KONTAFLOW_SUPER_ADMIN_PASSWORD must be at least 12 characters.");
  }
  const admin = createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId: string | null = null;
  for (let page = 1; page <= 20 && !userId; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    userId = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase())?.id ?? null;
    if (data.users.length < 200) break;
  }

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: "KontaFlow Super Admin", platform_admin: true },
    });
    if (error || !data.user) throw new Error(error?.message ?? "Could not create the super admin.");
    userId = data.user.id;
    console.log(`Created auth user ${email}.`);
  } else {
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
      ban_duration: "none",
      user_metadata: { full_name: "KontaFlow Super Admin", platform_admin: true },
    });
    if (error) throw new Error(error.message);
    console.log(`Updated auth user ${email}.`);
  }

  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: "KontaFlow Super Admin",
      verification_required: false,
      email_verified_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (profileError) throw new Error(profileError.message);

  const { error: adminError } = await admin.from("platform_admins").upsert(
    {
      user_id: userId,
      role: "super_admin",
      is_active: true,
      last_seen_at: null,
    },
    { onConflict: "user_id" },
  );
  if (adminError) throw new Error(adminError.message);

  await admin.from("platform_admin_audit_log").insert({
    admin_user_id: null,
    action: "platform_admin.bootstrapped",
    target_type: "platform_admin",
    target_id: userId,
    details: { email, role: "super_admin", source: "scripts/seed-platform-admin" },
  });

  console.log(`Super admin ready: ${email}`);
  console.log("Console: /en/admin (sign in with the separate super-admin password).");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
