"use client";

import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface SeverityByLocale { locale: string; critical: number; high: number; medium: number; low: number }
export interface TypeCoverage { type: string; coverage: number | null }

export function IssuesByLocaleChart({ data }: { data: SeverityByLocale[] }) {
  return (
    <div className="h-[260px]" role="img" aria-label={`Open issues by locale and severity: ${data.map((d) => `${d.locale} ${d.critical + d.high + d.medium + d.low}`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
          <CartesianGrid stroke="#e9eef0" strokeDasharray="4 4" vertical={false} />
          <XAxis dataKey="locale" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="critical" stackId="a" fill="#b94b46" />
          <Bar dataKey="high" stackId="a" fill="#d48a36" />
          <Bar dataKey="medium" stackId="a" fill="#7d8fc4" />
          <Bar dataKey="low" stackId="a" fill="#5fb89d" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CoverageByTypeChart({ data }: { data: TypeCoverage[] }) {
  const rows = data.map((d) => ({ ...d, coverage: d.coverage ?? 0 }));
  return (
    <div className="h-[260px]" role="img" aria-label={`Coverage by content type: ${data.map((d) => `${d.type} ${d.coverage ?? "N/A"}%`).join(", ")}`}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={rows} layout="vertical" margin={{ top: 8, right: 16, left: 24, bottom: 0 }}>
          <CartesianGrid stroke="#e9eef0" strokeDasharray="4 4" horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} unit="%" />
          <YAxis type="category" dataKey="type" width={120} tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => `${v}%`} />
          <Bar dataKey="coverage" fill="#138778" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
