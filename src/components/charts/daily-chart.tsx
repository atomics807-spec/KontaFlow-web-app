"use client";

import { motion, useReducedMotion } from "motion/react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoneyCompact, moneyLocale } from "@/lib/money";
import { useChartPalette } from "@/components/charts/use-chart-palette";

export function DailyChart({
  data,
  currency,
  locale,
  label,
}: {
  data: { date: string; income: number; expense: number }[];
  currency: string;
  locale: string;
  label: string;
}) {
  const palette = useChartPalette();
  const reduceMotion = useReducedMotion();
  const money = (value: number) => formatMoneyCompact(BigInt(Math.round(value)), currency, moneyLocale(locale, currency));

  return (
    <motion.figure
      className="m-0"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="h-60 w-full" role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 6, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid stroke={palette.grid} strokeDasharray="3 5" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(value: string) => value.slice(8)}
              tickLine={false}
              axisLine={false}
              tick={{ fill: palette.axis, fontSize: 11 }}
              dy={6}
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis
              tickFormatter={(value: number) => money(value)}
              tickLine={false}
              axisLine={false}
              width={70}
              tick={{ fill: palette.axis, fontSize: 11 }}
            />
            <Tooltip
              cursor={{ fill: palette.grid, opacity: 0.25 }}
              formatter={(value) => money(Number(value ?? 0))}
              contentStyle={{
                borderRadius: 12,
                border: `1px solid ${palette.tooltipBorder}`,
                background: palette.tooltipBg,
                color: palette.axis,
                fontSize: 12,
              }}
            />
            <Bar
              dataKey="income"
              fill={palette.incomeFill}
              radius={[3, 3, 0, 0]}
              maxBarSize={14}
              isAnimationActive={!reduceMotion}
            />
            <Bar
              dataKey="expense"
              fill={palette.expenseFill}
              radius={[3, 3, 0, 0]}
              maxBarSize={14}
              isAnimationActive={!reduceMotion}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </motion.figure>
  );
}
