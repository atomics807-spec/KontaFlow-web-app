import { getServerEnv } from "@/lib/env";

export type DeploymentInfo = {
  environment: "development" | "preview" | "production" | "test";
  target: "local" | "node" | "vercel" | "cloudflare";
  version: string | null;
};

/**
 * Platform environment variables are read only here. Application code should
 * use this adapter instead of branching on Vercel or Cloudflare globals.
 */
export function deploymentInfo(): DeploymentInfo {
  const env = getServerEnv();
  return {
    environment: env.APP_ENV,
    target: env.DEPLOYMENT_TARGET,
    version: env.APP_VERSION ?? process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? null,
  };
}
