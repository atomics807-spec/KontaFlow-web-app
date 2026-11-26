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
  monthLabel,
  incomeLabel,
  expenseLabel,
  emptyLabel,
}: {
  data: { date: string; income: number; expense: number }[];
  currency: string;
  locale: string;
  label: string;
  monthLabel: string;
  incomeLabel: string;
  expenseLabel: string;
  emptyLabel: string;
}) {
  const palette = useChartPalette();
  const reduceMotion = useReducedMotion();
  const money = (value: number) =>
    formatMoneyCompact(BigInt(Math.round(value)), currency, moneyLocale(locale, currency));

  if (data.length === 0) {
    return (
      <div className="flex h-60 items-center justify-center rounded-xl border border-dashed border-line-strong bg-page/40 px-6 text-center text-sm text-muted">
        {emptyLabel}
      </div>
    );
  }

  return (
    <motion.figure
      className="m-0"
      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
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
              name={incomeLabel}
              fill={palette.incomeFill}
              radius={[3, 3, 0, 0]}
              maxBarSize={14}
              isAnimationActive={!reduceMotion}
            />
            <Bar
              dataKey="expense"
              name={expenseLabel}
              fill={palette.expenseFill}
              radius={[3, 3, 0, 0]}
              maxBarSize={14}
              isAnimationActive={!reduceMotion}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        <table>
          <caption>{label}</caption>
          <thead>
            <tr>
              <th scope="col">{monthLabel}</th>
              <th scope="col">{incomeLabel}</th>
              <th scope="col">{expenseLabel}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((point) => (
              <tr key={point.date}>
                <td>{point.date}</td>
                <td>{money(point.income)}</td>
                <td>{money(point.expense)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </motion.figure>
  );
}
