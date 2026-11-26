"use client";

import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatMoneyCompact } from "@/lib/money";
import { moneyLocale } from "@/lib/money";

export type CashflowPoint = { month: string; income: number; expense: number };

export function CashflowChart({
  data,
  currency,
  locale,
  incomeLabel,
  expenseLabel,
  emptyLabel,
}: {
  data: CashflowPoint[];
  currency: string;
  locale: string;
  incomeLabel: string;
  expenseLabel: string;
  emptyLabel: string;
}) {
  const hasData = data.some((point) => point.income > 0 || point.expense > 0);

  if (!hasData) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-sand-300 bg-sand/40 px-6 text-center text-sm text-muted">
        {emptyLabel}
      </div>
    );
  }

  const moneyFormat = (minor: number) => formatMoneyCompact(BigInt(Math.round(minor)), currency, moneyLocale(locale, currency));

  return (
    <figure className="m-0">
      <div className="h-64 w-full" role="img" aria-label={`${incomeLabel} / ${expenseLabel}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 6, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="income-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#16A97E" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#16A97E" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="expense-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F2B64B" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#F2B64B" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#E5DFD1" strokeDasharray="3 5" vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#55675F", fontSize: 11 }}
              dy={6}
            />
            <YAxis
              tickFormatter={(value: number) => moneyFormat(value)}
              tickLine={false}
              axisLine={false}
              width={70}
              tick={{ fill: "#55675F", fontSize: 11 }}
            />
            <Tooltip
              formatter={(value) => moneyFormat(Number(value ?? 0))}
              contentStyle={{
                borderRadius: 12,
                border: "1px solid #E5DFD1",
                boxShadow: "0 12px 30px -18px rgba(8,20,15,0.35)",
                fontSize: 12,
              }}
            />
            <Legend
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ fontSize: 12, paddingTop: 8, color: "#55675F" }}
            />
            <Area
              type="monotone"
              dataKey="income"
              name={incomeLabel}
              stroke="#0B7A5A"
              strokeWidth={2.2}
              fill="url(#income-fill)"
            />
            <Area
              type="monotone"
              dataKey="expense"
              name={expenseLabel}
              stroke="#D2942A"
              strokeWidth={2.2}
              fill="url(#expense-fill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">
        <table>
          <thead>
            <tr>
              <th scope="col">Month</th>
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
    </figure>
  );
}
