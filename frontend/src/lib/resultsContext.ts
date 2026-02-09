import type { AnalysisBundle } from "@/lib/api";
import type { ResultsPageContextData } from "@/lib/store";

type TimeValue = { ts: number; value: number };

function monthLabel(ts: number): string {
  return new Date(ts).toLocaleDateString("en-GB", { month: "short" });
}

function toTs(value: string | undefined): number | null {
  if (!value) return null;
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
}

function firstFiniteNumeric(record: Record<string, string | number | null>): number | null {
  for (const [key, raw] of Object.entries(record)) {
    if (key === "period_ending" || key === "date" || key === "index") continue;
    const num = Number(raw);
    if (Number.isFinite(num)) return num;
  }
  return null;
}

function roundValue(n: number): number {
  const abs = Math.abs(n);
  if (abs >= 1000) return Math.round(n);
  return Math.round(n * 100) / 100;
}

function normalizeFeatureName(name: string): string {
  return name.replace(/_/g, " ");
}

function buildTrendSummary(analysis: AnalysisBundle): ResultsPageContextData["trend_summary"] {
  const series: TimeValue[] = [];

  for (const row of analysis.datasets.target_series || []) {
    const ts = toTs(
      String(
        row.period_ending ?? row.date ?? row.index ?? ""
      )
    );
    if (ts === null) continue;
    const value = firstFiniteNumeric(row);
    if (value === null) continue;
    series.push({ ts, value });
  }

  for (const row of analysis.datasets.forecast || []) {
    const ts = toTs(row.period_ending ?? row.date ?? row.index ?? "");
    const value = Number(row.multivariate_forecast);
    if (ts === null || !Number.isFinite(value)) continue;
    series.push({ ts, value });
  }

  if (series.length === 0) return [];

  series.sort((a, b) => a.ts - b.ts);
  const monthBuckets = new Map<string, TimeValue>();
  for (const point of series) {
    const d = new Date(point.ts);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    monthBuckets.set(key, point);
  }

  const monthly = Array.from(monthBuckets.values()).sort((a, b) => a.ts - b.ts).slice(-6);
  const trend: ResultsPageContextData["trend_summary"] = monthly.map((point) => ({
    month: monthLabel(point.ts),
    val: roundValue(point.value),
  }));

  for (let i = 1; i < trend.length; i += 1) {
    const prev = trend[i - 1].val;
    const curr = trend[i].val;
    if (prev > 0 && curr < prev * 0.95) {
      trend[i] = { ...trend[i], note: "Dip vs previous month" };
      break;
    }
  }

  return trend;
}

function deriveErrorLevel(nrmsePct: number | null): string {
  if (nrmsePct === null) return "Unknown";
  if (nrmsePct <= 10) return "Low";
  if (nrmsePct <= 20) return "Medium";
  return "High";
}

function deriveAccuracyPct(analysis: AnalysisBundle): number | null {
  const multiRmse = Number(analysis.manifest.metrics?.multivariate_rmse);
  if (!Number.isFinite(multiRmse)) return null;

  const targetVals = (analysis.datasets.target_series || [])
    .map((row) => firstFiniteNumeric(row))
    .filter((value): value is number => value !== null);

  if (targetVals.length === 0) return null;
  const meanTarget =
    targetVals.reduce((acc, value) => acc + Math.abs(value), 0) / targetVals.length;
  if (!Number.isFinite(meanTarget) || meanTarget <= 0) return null;

  const nrmsePct = (multiRmse / meanTarget) * 100;
  return Math.max(0, Math.min(100, 100 - nrmsePct));
}

function deriveNrmsePct(analysis: AnalysisBundle): number | null {
  const multiRmse = Number(analysis.manifest.metrics?.multivariate_rmse);
  if (!Number.isFinite(multiRmse)) return null;
  const targetVals = (analysis.datasets.target_series || [])
    .map((row) => firstFiniteNumeric(row))
    .filter((value): value is number => value !== null);
  if (targetVals.length === 0) return null;
  const meanTarget =
    targetVals.reduce((acc, value) => acc + Math.abs(value), 0) / targetVals.length;
  if (!Number.isFinite(meanTarget) || meanTarget <= 0) return null;
  return (multiRmse / meanTarget) * 100;
}

export function buildResultsPageContext(analysis: AnalysisBundle | null): ResultsPageContextData | null {
  if (!analysis) return null;

  const accuracy = deriveAccuracyPct(analysis);
  const nrmsePct = deriveNrmsePct(analysis);
  const topDrivers = (analysis.datasets.feature_importance || [])
    .slice()
    .sort((a, b) => Number(b.importance) - Number(a.importance))
    .slice(0, 3)
    .map((row) => normalizeFeatureName(String(row.feature)));

  return {
    metrics: {
      accuracy: accuracy === null ? "N/A" : `${Math.round(accuracy)}%`,
      error: deriveErrorLevel(nrmsePct),
    },
    top_drivers: topDrivers,
    trend_summary: buildTrendSummary(analysis),
  };
}

export function stringifyResultsPageContext(ctx: ResultsPageContextData | null): string {
  if (!ctx) return "";
  try {
    return JSON.stringify(ctx, null, 2);
  } catch {
    return "";
  }
}
