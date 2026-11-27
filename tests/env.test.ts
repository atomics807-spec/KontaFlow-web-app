import { afterEach, describe, expect, it, vi } from "vitest";
import { getServerEnv, resetEnvCache } from "@/lib/env";
import { deploymentInfo } from "@/lib/platform/deployment";

afterEach(() => {
  vi.unstubAllEnvs();
  resetEnvCache();
});

describe("server environment", () => {
  it("treats a blank optional OpenAI base URL as unset", () => {
    vi.stubEnv("OPENAI_BASE_URL", "");
    resetEnvCache();
    expect(getServerEnv().OPENAI_BASE_URL).toBeUndefined();
  });

  it("accepts an OpenAI-compatible base URL", () => {
    vi.stubEnv("OPENAI_BASE_URL", "http://127.0.0.1:4010/v1");
    resetEnvCache();
    expect(getServerEnv().OPENAI_BASE_URL).toBe("http://127.0.0.1:4010/v1");
  });

  it("reports the deployment target and release version", () => {
    vi.stubEnv("APP_ENV", "production");
    vi.stubEnv("DEPLOYMENT_TARGET", "cloudflare");
    vi.stubEnv("APP_VERSION", "abc123");
    resetEnvCache();
    expect(deploymentInfo()).toEqual({
      environment: "production",
      target: "cloudflare",
      version: "abc123",
    });
  });
});
