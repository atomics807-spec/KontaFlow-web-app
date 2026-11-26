"use client";

import { motion, useReducedMotion } from "motion/react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoneyCompact, moneyLocale } from "@/lib/money";
import { useChartPalette } from "@/components/charts/use-chart-palette";

export type CashflowPoint = { month: string; income: number; expense: number };

export function CashflowChart({
  data,
  currency,
  locale,
  incomeLabel,
  expenseLabel,
  emptyLabel,
  monthLabel,
}: {
  data: CashflowPoint[];
  currency: string;
  locale: string;
  incomeLabel: string;
  expenseLabel: string;
  emptyLabel: string;
  monthLabel: string;
}) {
  const palette = useChartPalette();
  const reduceMotion = useReducedMotion();
  const hasData = data.some((point) => point.income > 0 || point.expense > 0);

  if (!hasData) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-line-strong bg-page/40 px-6 text-center text-sm text-muted">
        {emptyLabel}
      </div>
    );
  }

  const moneyFormat = (minor: number) =>
    formatMoneyCompact(BigInt(Math.round(minor)), currency, moneyLocale(locale, currency));

  return (
    <motion.figure
      className="m-0"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.5, ease: "easeOut" }}
    >
      <div className="h-64 w-full" role="img" aria-label={`${incomeLabel} / ${expenseLabel}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="income-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={palette.incomeFill} stopOpacity={0.28} />
                <stop offset="100%" stopColor={palette.incomeFill} stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expense-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={palette.expenseFill} stopOpacity={0.3} />
                <stop offset="100%" stopColor={palette.expenseFill} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={palette.grid} strokeDasharray="3 5" vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: palette.axis, fontSize: 11 }}
              dy={6}
            />
            <YAxis
              tickFormatter={(value: number) => moneyFormat(value)}
              tickLine={false}
              axisLine={false}
              width={70}
              tick={{ fill: palette.axis, fontSize: 11 }}
            />
            <Tooltip
              formatter={(value) => moneyFormat(Number(value ?? 0))}
              contentStyle={{
                borderRadius: 12,
                border: `1px solid ${palette.tooltipBorder}`,
                background: palette.tooltipBg,
                boxShadow: "0 12px 30px -18px rgba(8,20,15,0.35)",
                fontSize: 12,
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, paddingTop: 8, color: palette.axis }}
            />
            <Area
              type="monotone"
              dataKey="income"
              name={incomeLabel}
              stroke={palette.income}
              strokeWidth={2.2}
              fill="url(#income-fill)"
              isAnimationActive={!reduceMotion}
              animationDuration={700}
            />
            <Area
              type="monotone"
              dataKey="expense"
              name={expenseLabel}
              stroke={palette.expense}
              strokeWidth={2.2}
              fill="url(#expense-fill)"
              isAnimationActive={!reduceMotion}
              animationDuration={700}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        <table>
          <thead>
            <tr>
              <th scope="col">{monthLabel}</th>
              <th scope="col">{incomeLabel}</th>
              <th scope="col">{expenseLabel}</th>
            </tr>
          </thead>
          <tbody>
            {data.map((point) => (
              <tr key={point.month}>
                <td>{point.month}</td>
                <td>{moneyFormat(point.income)}</td>
                <td>{moneyFormat(point.expense)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </figcaption>
    </motion.figure>
  );
}
