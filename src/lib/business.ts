export const BUSINESS_TYPES = [
  "sole_proprietorship",
  "partnership",
  "limited_company",
  "cooperative",
  "nonprofit",
  "other",
] as const;

export const BUSINESS_SIZES = ["solo", "micro", "small", "medium", "large"] as const;

export const INDUSTRIES = [
  "retail",
  "food",
  "services",
  "construction",
  "transport",
  "technology",
  "health",
  "education",
  "other",
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];
export type BusinessSize = (typeof BUSINESS_SIZES)[number];
export type Industry = (typeof INDUSTRIES)[number];
