"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface TrendPoint { label: string; value: number | null }

export function TrendChart({ data, name }: { data: TrendPoint[]; name: string }) {
  return (
    <div className="h-[170px] w-full" role="img" aria-label={`${name} over time: ${data.map((d) => `${d.label} ${d.value ?? "n/a"}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="trend" x1="0" x2="0" y1="0" y2="1">
              <stop stopColor="#18a28c" stopOpacity={0.25} />
              <stop offset="1" stopColor="#18a28c" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e9eef0" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#8a9aa3" }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "#8a9aa3" }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Area type="monotone" dataKey="value" name={name} stroke="#138a76" strokeWidth={3} fill="url(#trend)" dot={{ r: 3, fill: "#138a76" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
