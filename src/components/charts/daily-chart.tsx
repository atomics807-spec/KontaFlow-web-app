"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoneyCompact, moneyLocale } from "@/lib/money";

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
  const money = (value: number) => formatMoneyCompact(BigInt(Math.round(value)), currency, moneyLocale(locale, currency));

  return (
    <figure className="m-0">
      <div className="h-60 w-full" role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 6, left: 0, bottom: 0 }} barGap={2}>
            <CartesianGrid stroke="#E5DFD1" strokeDasharray="3 5" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(value: string) => value.slice(8)}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#55675F", fontSize: 11 }}
              dy={6}
              interval="preserveStartEnd"
              minTickGap={12}
            />
            <YAxis
              tickFormatter={(value: number) => money(value)}
              tickLine={false}
              axisLine={false}
              width={70}
              tick={{ fill: "#55675F", fontSize: 11 }}
            />
            <Tooltip
              formatter={(value) => money(Number(value ?? 0))}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #E5DFD1",
                fontSize: 12,
              }}
            />
            <Bar dataKey="income" fill="#16A97E" radius={[3, 3, 0, 0]} maxBarSize={14} />
            <Bar dataKey="expense" fill="#F2B64B" radius={[3, 3, 0, 0]} maxBarSize={14} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
