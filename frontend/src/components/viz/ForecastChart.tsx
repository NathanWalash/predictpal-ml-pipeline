"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import type { ForecastResults } from "@/lib/store";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui";

interface ForecastChartProps {
  results: ForecastResults;
}

export function ForecastChart({ results }: ForecastChartProps) {
  // Combine historical + forecast data into a single array
  const historicalData = results.historical.index.map((date, i) => ({
    date,
    Historical: results.historical.values[i],
  }));

  const baselineData = results.baseline.index.map((date, i) => ({
    date,
    Baseline: results.baseline.predictions[i],
  }));

  const multiData = results.multivariate.index.map((date, i) => ({
    date,
    Multivariate: results.multivariate.predictions[i],
  }));

  // Show last 30 points of history + all forecasts
  const recentHistory = historicalData.slice(-30);
  const merged: Record<string, unknown>[] = [];

  recentHistory.forEach((d) => merged.push({ ...d }));
  baselineData.forEach((d) => {
    const existing = merged.find((m) => m.date === d.date);
    if (existing) {
      existing.Baseline = d.Baseline;
    } else {
      merged.push({ ...d });
    }
  });
  multiData.forEach((d) => {
    const existing = merged.find((m) => m.date === d.date);
    if (existing) {
      existing.Multivariate = d.Multivariate;
    } else {
      merged.push({ ...d });
    }
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Forecast Results</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={merged}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickFormatter={(v) => {
                const d = new Date(v);
                return `${d.getMonth() + 1}/${d.getDate()}`;
              }}
            />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="Historical"
              stroke="#94a3b8"
              strokeWidth={2}
              dot={false}
              name="Historical"
            />
            <Line
              type="monotone"
              dataKey="Baseline"
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="8 4"
              dot={false}
              name="Baseline Forecast"
            />
            <Line
              type="monotone"
              dataKey="Multivariate"
              stroke="#14b8a6"
              strokeWidth={2.5}
              dot={false}
              name="Multivariate Forecast"
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

// ─── Feature Importance ───────────────────────────────────────────────────────

interface FeatureImportanceProps {
  importance: Record<string, number>;
}

const COLORS = ["#14b8a6", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

export function FeatureImportanceChart({ importance }: FeatureImportanceProps) {
  const data = Object.entries(importance)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([name, value]) => ({ name, importance: value }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Feature Importance</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis
              dataKey="name"
              type="category"
              tick={{ fontSize: 11 }}
              width={120}
            />
            <Tooltip />
            <Bar dataKey="importance" radius={[0, 4, 4, 0]}>
              {data.map((_, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={COLORS[index % COLORS.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
