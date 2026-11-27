import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

const PRIVATE_PATHS = [
  "/api/",
  "/auth/",
  "/*/dashboard",
  "/*/transactions",
  "/*/reports",
  "/*/contacts",
  "/*/accounts",
  "/*/invoices",
  "/*/debts",
  "/*/budgets",
  "/*/insights",
  "/*/finance",
  "/*/assistant",
  "/*/settings",
  "/*/team",
  "/*/billing",
  "/*/onboarding",
  "/*/invite/",
  "/*/offline",
  "/*/account-restricted",
  "/*/admin",
  "/*/login",
  "/*/signup",
  "/*/forgot-password",
  "/*/reset-password",
  "/*/verify-email",
  "/*/verify-phone",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PATHS,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
