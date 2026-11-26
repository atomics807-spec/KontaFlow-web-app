"use client";

import { useTheme } from "@/components/layout/theme-provider";

export type ChartPalette = {
  grid: string;
  axis: string;
  income: string;
  incomeFill: string;
  expense: string;
  expenseFill: string;
  tooltipBg: string;
  tooltipBorder: string;
};

/**
 * Recharts needs concrete colours, not CSS variables, for canvas-ready props
 * such as tick fills and gradients. Keeping both palettes in one place avoids
 * a measurement pass on every theme switch.
 */
const PALETTES: Record<"light" | "dark", ChartPalette> = {
  light: {
    grid: "#e5dfd1",
    axis: "#55675f",
    income: "#0b7a5a",
    incomeFill: "#16a97e",
    expense: "#d2942a",
    expenseFill: "#f2b64b",
    tooltipBg: "#ffffff",
    tooltipBorder: "#e5dfd1",
  },
  dark: {
    grid: "#22392f",
    axis: "#9db3a7",
    income: "#74c9aa",
    incomeFill: "#35b189",
    expense: "#f6c465",
    expenseFill: "#f2b64b",
    tooltipBg: "#13261e",
    tooltipBorder: "#22392f",
  },
};

export function useChartPalette(): ChartPalette {
  const { resolved } = useTheme();
  return PALETTES[resolved];
}
