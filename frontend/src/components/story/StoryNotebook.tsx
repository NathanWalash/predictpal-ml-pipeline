"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getSampleAnalysisBundle,
  type AnalysisBundle,
  type StoryDetail,
  type StoryNotebookBlock,
} from "@/lib/api";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import { AlertCircle, Loader2 } from "lucide-react";

type LooseRecord = Record<string, string | number | null | undefined>;

function parseTs(value: string) {
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
}
function getDateString(row: LooseRecord): string | null {
  const candidate = row.week_ending ?? row.date ?? row.index ?? row.period;
  return typeof candidate === "string" && candidate.trim() ? candidate : null;
}
function getPrimaryNumericValue(row: LooseRecord): number | null {
  for (const [key, raw] of Object.entries(row)) {
    if (key === "week_ending" || key === "date" || key === "index") continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}
function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((v) => (v == null ? "" : String(v).trim())).filter((v) => v.length > 0)
    : [];
}
function prettifyDriverLabel(key: string) {
  return key.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
function shouldUseBarForDriver(rows: Array<Record<string, unknown>>, key: string) {
  const values = rows.map((r) => Number(r[key])).filter((n) => Number.isFinite(n));
  if (values.length === 0) return false;
  const allIntegers = values.every((n) => Number.isInteger(n));
  const max = Math.max(...values);
  const unique = new Set(values).size;
  return allIntegers && max <= 20 && unique <= 10;
}

function fmtDate(ts: number) {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
}

function fmtLongDate(ts: number) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "2-digit" });
}

function axisNum(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toFixed(0);
}

function tooltipValue(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const abs = Math.abs(n);
  const maximumFractionDigits = abs >= 100 ? 0 : 2;
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits }).format(n);
}

function formatDecimal(value: number, maxFractionDigits = 2) {
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: maxFractionDigits }).format(value);
}

function computeDomain<T extends Record<string, unknown>>(
  rows: T[],
  keys: Array<keyof T>,
  clampZero = false
): [number, number] {
  const values: number[] = [];
  for (const row of rows) {
    for (const key of keys) {
      const raw = row[key];
      if (raw === null || raw === undefined || raw === "") continue;
      const n = Number(raw);
      if (Number.isFinite(n)) values.push(n);
    }
  }

  if (values.length === 0) return [0, 1];

  let min = Math.min(...values);
  let max = Math.max(...values);

  if (min === max) {
    const pad = Math.max(Math.abs(min) * 0.05, 1);
    min -= pad;
    max += pad;
  } else {
    const pad = (max - min) * 0.15;
    min -= pad;
    max += pad;
  }

  if (clampZero && min > 0) min = 0;

  return [min, max];
}

function filterWindow<T extends { ts: number }>(
  rows: T[],
  windowStartTs: number | null,
  windowEndTs: number | null
) {
  return rows.filter(
    (r) => (windowStartTs === null || r.ts >= windowStartTs) && (windowEndTs === null || r.ts <= windowEndTs)
  );
}

function textBlock(block: Extract<StoryNotebookBlock, { type: "text" }>) {
  if (block.style === "h1") return <h1 className="text-3xl font-bold text-white">{block.content}</h1>;
  if (block.style === "h2") return <h2 className="text-2xl font-semibold text-white">{block.content}</h2>;
  if (block.style === "h3") return <h3 className="text-xl font-semibold text-white">{block.content}</h3>;
  if (block.style === "bullets") {
    return (
      <ul className="list-disc pl-5 text-slate-300 text-sm space-y-1">
        {block.content
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item, idx) => (
            <li key={`${block.id}-${idx}`}>{item}</li>
          ))}
      </ul>
    );
  }
  return <p className="text-sm text-slate-300 whitespace-pre-line">{block.content}</p>;
}

function ChartWrap({ children, height = 320 }: { children: React.ReactNode; height?: number }) {
  return <ResponsiveContainer width="100%" height={height}>{children as React.ReactElement}</ResponsiveContainer>;
}

export function StoryNotebook({ story }: { story: StoryDetail }) {
  const [analysis, setAnalysis] = useState<AnalysisBundle | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [analysisError, setAnalysisError] = useState("");

  useEffect(() => {
    let mounted = true;
    (async () => {
      setAnalysisLoading(true);
      setAnalysisError("");
      try {
        const bundle = await getSampleAnalysisBundle();
        if (!mounted) return;
        setAnalysis(bundle);
      } catch {
        if (!mounted) return;
        setAnalysisError("Could not load analysis data for chart blocks.");
      } finally {
        if (mounted) setAnalysisLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  const historical = useMemo(
    () =>
      (analysis?.datasets.target_series || [])
        .map((r) => {
          const row = r as LooseRecord;
          const date = (row.week_ending ?? row.date ?? row.index) as string | undefined;
          if (!date) return null;
          const ts = parseTs(date);
          if (ts === null) return null;
          const key = Object.keys(row).find((k) => !["week_ending", "date", "index"].includes(k));
          const val = key ? Number(row[key]) : NaN;
          if (!Number.isFinite(val)) return null;
          return { ts, actual: val };
        })
        .filter((x): x is { ts: number; actual: number } => x !== null)
        .sort((a, b) => a.ts - b.ts),
    [analysis]
  );

  const testPred = useMemo(
    () =>
      (analysis?.datasets.test_predictions || [])
        .map((r) => ({
          ts: parseTs(r.week_ending),
          actual: Number(r.actual),
          baseline: Number(r.baseline),
          multivariate: Number(r.multivariate),
        }))
        .filter(
          (x): x is { ts: number; actual: number; baseline: number; multivariate: number } =>
            x.ts !== null
        )
        .sort((a, b) => a.ts - b.ts),
    [analysis]
  );

  const testData = useMemo(() => {
    const predMap = new Map(testPred.map((r) => [r.ts, r]));
    return historical.map((h) => ({
      ts: h.ts,
      actual: h.actual,
      baseline: predMap.get(h.ts)?.baseline ?? null,
      multivariate: predMap.get(h.ts)?.multivariate ?? null,
      actual_test: predMap.get(h.ts)?.actual ?? null,
    }));
  }, [historical, testPred]);

  const forecastData = useMemo(
    () =>
      (analysis?.datasets.forecast || [])
        .map((r) => ({
          ts: parseTs(r.week_ending),
          baseline_forecast: Number(r.baseline_forecast),
          multivariate_forecast: Number(r.multivariate_forecast),
        }))
        .filter(
          (x): x is { ts: number; baseline_forecast: number; multivariate_forecast: number } =>
            x.ts !== null
        )
        .sort((a, b) => a.ts - b.ts),
    [analysis]
  );

  const forecastCombined = useMemo(() => {
    const map = new Map<
      number,
      {
        ts: number;
        actual: number | null;
        baseline_forecast: number | null;
        multivariate_forecast: number | null;
        handoff_baseline: number | null;
        handoff_multivariate: number | null;
      }
    >();

    for (const h of historical) {
      map.set(h.ts, {
        ts: h.ts,
        actual: h.actual,
        baseline_forecast: null,
        multivariate_forecast: null,
        handoff_baseline: null,
        handoff_multivariate: null,
      });
    }

    for (const f of forecastData) {
      const row = map.get(f.ts);
      if (row) {
        row.baseline_forecast = f.baseline_forecast;
        row.multivariate_forecast = f.multivariate_forecast;
      } else {
        map.set(f.ts, {
          ts: f.ts,
          actual: null,
          baseline_forecast: f.baseline_forecast,
          multivariate_forecast: f.multivariate_forecast,
          handoff_baseline: null,
          handoff_multivariate: null,
        });
      }
    }

    const sorted = Array.from(map.values()).sort((a, b) => a.ts - b.ts);
    const lastHistorical = historical[historical.length - 1];
    const firstForecast = forecastData[0];

    if (lastHistorical && firstForecast && firstForecast.ts > lastHistorical.ts) {
      const left = sorted.find((r) => r.ts === lastHistorical.ts);
      const right = sorted.find((r) => r.ts === firstForecast.ts);
      if (left && right) {
        if (right.baseline_forecast !== null) {
          left.handoff_baseline = left.actual;
          right.handoff_baseline = right.baseline_forecast;
        }
        left.handoff_multivariate = left.actual;
        right.handoff_multivariate = right.multivariate_forecast ?? null;
      }
    }

    return sorted;
  }, [forecastData, historical]);

  const errorData = useMemo(
    () =>
      testPred.map((r) => ({
        ts: r.ts,
        baseline_error: Math.abs(r.actual - r.baseline),
        multivariate_error: Math.abs(r.actual - r.multivariate),
      })),
    [testPred]
  );

  const driverData = useMemo(() => {
    type DriverRow = { ts: number; week_ending: string } & Record<string, number | string | null>;
    const merged = new Map<number, DriverRow>();
    const settings = analysis?.manifest?.settings || {};
    const preferredDriverKeys = Array.from(
      new Set([
        ...getStringArray(settings["selected_drivers"]),
        ...getStringArray(settings["driver_columns_used"]),
      ])
    );

    const genericSeries = analysis?.datasets.driver_series || [];
    if (genericSeries.length > 0) {
      for (const row of genericSeries) {
        const asRecord = row as LooseRecord;
        const date = getDateString(asRecord);
        if (!date) continue;
        const ts = parseTs(date);
        if (ts === null) continue;

        const existing = merged.get(ts) || { ts, week_ending: date };
        const next: DriverRow = { ...existing, ts, week_ending: existing.week_ending || date };
        for (const [key, raw] of Object.entries(asRecord)) {
          if (key === "week_ending" || key === "date" || key === "index") continue;
          const n = Number(raw);
          next[key] = Number.isFinite(n) ? n : null;
        }
        merged.set(ts, next);
      }

      return Array.from(merged.values()).sort((a, b) => a.ts - b.ts);
    }

    const featureRows = analysis?.datasets.feature_frame || [];
    if (featureRows.length > 0) {
      const candidateKeys = new Set<string>();
      if (preferredDriverKeys.length > 0) {
        for (const key of preferredDriverKeys) candidateKeys.add(key);
      } else {
        const sample = featureRows[0] as LooseRecord;
        for (const key of Object.keys(sample)) {
          if (["week_ending", "date", "index", "period", "y"].includes(key)) continue;
          if (key.startsWith("target_lag_") || key.endsWith("_lag_1") || key.endsWith("_lag_2")) continue;
          candidateKeys.add(key);
        }
      }

      for (const row of featureRows) {
        const asRecord = row as LooseRecord;
        const date = getDateString(asRecord);
        if (!date) continue;
        const ts = parseTs(date);
        if (ts === null) continue;

        const existing = merged.get(ts) || { ts, week_ending: date };
        const next: DriverRow = { ...existing, ts, week_ending: existing.week_ending || date };
        let assigned = false;
        for (const key of candidateKeys) {
          if (!(key in asRecord)) continue;
          const n = Number(asRecord[key]);
          if (Number.isFinite(n)) {
            next[key] = n;
            assigned = true;
          }
        }
        if (assigned) merged.set(ts, next);
      }

      if (merged.size > 0) {
        return Array.from(merged.values()).sort((a, b) => a.ts - b.ts);
      }
    }

    for (const row of analysis?.datasets.temp_weekly || []) {
      const asRecord = row as LooseRecord;
      const date = getDateString(asRecord);
      if (!date) continue;
      const ts = parseTs(date);
      if (ts === null) continue;

      const tempRaw =
        asRecord.temp_mean ??
        asRecord.value ??
        asRecord.temp ??
        getPrimaryNumericValue(asRecord);
      const temp = Number(tempRaw);
      const existing = merged.get(ts) || { ts, week_ending: date };
      merged.set(ts, {
        ...existing,
        ts,
        week_ending: existing.week_ending || date,
        temp_mean: Number.isFinite(temp) ? temp : null,
      });
    }

    for (const row of analysis?.datasets.holiday_weekly || []) {
      const asRecord = row as LooseRecord;
      const date = getDateString(asRecord);
      if (!date) continue;
      const ts = parseTs(date);
      if (ts === null) continue;

      const countRaw = asRecord.holiday_count ?? asRecord.value ?? getPrimaryNumericValue(asRecord);
      const count = Number(countRaw);
      const existing = merged.get(ts) || { ts, week_ending: date };
      merged.set(ts, {
        ...existing,
        ts,
        week_ending: existing.week_ending || date,
        holiday_count: Number.isFinite(count) ? count : null,
      });
    }

    return Array.from(merged.values()).sort((a, b) => a.ts - b.ts);
  }, [analysis]);

  const driverSeriesKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const row of driverData as Array<Record<string, unknown>>) {
      for (const key of Object.keys(row)) {
        if (key === "ts" || key === "week_ending") continue;
        keys.add(key);
      }
    }
    const settings = analysis?.manifest?.settings || {};
    const preferred = [
      ...getStringArray(settings["selected_drivers"]),
      ...getStringArray(settings["driver_columns_used"]),
    ];
    const ordered: string[] = [];
    for (const key of preferred) {
      if (keys.has(key) && !ordered.includes(key)) ordered.push(key);
    }
    for (const key of keys) {
      if (!ordered.includes(key)) ordered.push(key);
    }
    return ordered;
  }, [analysis, driverData]);

  const importanceData = useMemo(
    () =>
      (analysis?.datasets.feature_importance || [])
        .map((r) => ({ feature: r.feature, importance: Number(r.importance) }))
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 10),
    [analysis]
  );

  const testWindowStartTs = testPred.length > 0 ? testPred[0].ts : null;
  const testWindowEndTs = testPred.length > 0 ? testPred[testPred.length - 1].ts : null;
  const forecastWindowStartTs = forecastData.length > 0 ? forecastData[0].ts : null;
  const forecastWindowEndTs = forecastData.length > 0 ? forecastData[forecastData.length - 1].ts : null;

  const renderGraph = (block: Extract<StoryNotebookBlock, { type: "graph" }>) => {
    if (analysisLoading) {
      return (
        <div className="rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-10 text-sm text-slate-400 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin text-teal-300" />
          Loading chart data...
        </div>
      );
    }
    if (analysisError) {
      return (
        <div className="rounded-xl border border-amber-800 bg-amber-950/20 px-4 py-4 text-xs text-amber-300 inline-flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {analysisError}
        </div>
      );
    }

    const sharedXAxisProps = {
      dataKey: "ts" as const,
      type: "number" as const,
      scale: "time" as const,
      domain: ["dataMin", "dataMax"] as [string, string],
      tickFormatter: (v: number) => fmtDate(Number(v)),
      minTickGap: 28,
      angle: -25,
      textAnchor: "end" as const,
      height: 56,
      tick: { fontSize: 11 },
    };

    if (block.assetId === "future-forecast") {
      const rows = filterWindow(forecastCombined, block.windowStartTs, block.windowEndTs);
      const domain = computeDomain(rows, ["actual", "baseline_forecast", "multivariate_forecast"]);

      return (
        <ChartWrap>
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis {...sharedXAxisProps} />
            <YAxis domain={domain} tickFormatter={axisNum} tick={{ fontSize: 11 }} />
            <Tooltip labelFormatter={(label) => fmtLongDate(Number(label))} formatter={tooltipValue} />
            <Legend />
            {forecastWindowStartTs !== null && forecastWindowEndTs !== null && (
              <ReferenceArea
                x1={forecastWindowStartTs}
                x2={forecastWindowEndTs}
                fill="#022c22"
                fillOpacity={0.22}
                ifOverflow="extendDomain"
              />
            )}
            {forecastWindowStartTs !== null && (
              <ReferenceLine
                x={forecastWindowStartTs}
                stroke="#22c55e"
                strokeDasharray="5 4"
                ifOverflow="extendDomain"
                label={{
                  value: "forecast starts",
                  fill: "#86efac",
                  fontSize: 10,
                  position: "insideTopRight",
                }}
              />
            )}
            <Line type="monotone" dataKey="actual" name="historical actual" stroke="#cbd5e1" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="baseline_forecast" name="baseline" stroke="#3b82f6" dot={false} />
            <Line
              type="monotone"
              dataKey="multivariate_forecast"
              name="multivariate"
              stroke="#14b8a6"
              dot={false}
              strokeWidth={2}
            />
            <Line
              type="monotone"
              dataKey="handoff_multivariate"
              name="handoff multivariate"
              stroke="#22c55e"
              dot={false}
              strokeDasharray="4 4"
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="handoff_baseline"
              name="handoff baseline"
              stroke="#60a5fa"
              dot={false}
              strokeDasharray="4 4"
              connectNulls
            />
          </LineChart>
        </ChartWrap>
      );
    }

    if (block.assetId === "test-fit") {
      const rows = filterWindow(testData, block.windowStartTs, block.windowEndTs);
      const domain = computeDomain(rows, ["actual", "actual_test", "baseline", "multivariate"]);
      return (
        <ChartWrap>
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis {...sharedXAxisProps} />
            <YAxis domain={domain} tickFormatter={axisNum} tick={{ fontSize: 11 }} />
            <Tooltip labelFormatter={(label) => fmtLongDate(Number(label))} formatter={tooltipValue} />
            <Legend />
            {testWindowStartTs !== null && testWindowEndTs !== null && (
              <ReferenceArea
                x1={testWindowStartTs}
                x2={testWindowEndTs}
                fill="#14532d"
                fillOpacity={0.22}
                ifOverflow="extendDomain"
              />
            )}
            <Line type="monotone" dataKey="actual" name="historical actual" stroke="#cbd5e1" dot={false} strokeWidth={2} />
            <Line
              type="monotone"
              dataKey="actual_test"
              name="actual (test)"
              stroke="#22c55e"
              dot={false}
              strokeDasharray="4 3"
            />
            <Line type="monotone" dataKey="baseline" name="baseline" stroke="#3b82f6" dot={false} />
            <Line type="monotone" dataKey="multivariate" name="multivariate" stroke="#14b8a6" dot={false} />
          </LineChart>
        </ChartWrap>
      );
    }

    if (block.assetId === "error-trend") {
      const rows = filterWindow(errorData, block.windowStartTs, block.windowEndTs);
      const domain = computeDomain(rows, ["baseline_error", "multivariate_error"], true);
      return (
        <ChartWrap>
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis {...sharedXAxisProps} />
            <YAxis domain={domain} tickFormatter={axisNum} tick={{ fontSize: 11 }} />
            <Tooltip labelFormatter={(label) => fmtLongDate(Number(label))} formatter={tooltipValue} />
            <Legend />
            <Line type="monotone" dataKey="baseline_error" name="baseline error" stroke="#3b82f6" dot={false} />
            <Line type="monotone" dataKey="multivariate_error" name="multivariate error" stroke="#14b8a6" dot={false} />
          </LineChart>
        </ChartWrap>
      );
    }

    if (block.assetId === "driver-series") {
      const rows = filterWindow(driverData, block.windowStartTs, block.windowEndTs);
      if (rows.length === 0 || driverSeriesKeys.length === 0) {
        return (
          <div className="rounded-xl border border-slate-700 bg-slate-900/30 p-3 text-xs text-slate-400">
            No driver data available for this chart.
          </div>
        );
      }

      return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {driverSeriesKeys.map((key) => {
            const isBar = shouldUseBarForDriver(rows as Array<Record<string, unknown>>, key);
            const domain = computeDomain(rows as Array<Record<string, unknown>>, [key], isBar);
            return (
              <div key={key} className="rounded-xl border border-slate-700 bg-slate-900/30 p-3">
                <p className="text-xs text-slate-400 mb-2">{prettifyDriverLabel(key)}</p>
                <ChartWrap height={260}>
                  {isBar ? (
                    <BarChart data={rows}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis {...sharedXAxisProps} />
                      <YAxis domain={domain} tickFormatter={axisNum} tick={{ fontSize: 11 }} />
                      <Tooltip labelFormatter={(label) => fmtLongDate(Number(label))} formatter={tooltipValue} />
                      <Legend />
                      <Bar dataKey={key} name={prettifyDriverLabel(key)} fill="#f59e0b" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  ) : (
                    <LineChart data={rows}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis {...sharedXAxisProps} />
                      <YAxis
                        domain={domain}
                        tickFormatter={(v) => formatDecimal(Number(v), 2)}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip labelFormatter={(label) => fmtLongDate(Number(label))} formatter={tooltipValue} />
                      <Legend />
                      <Line type="monotone" dataKey={key} name={prettifyDriverLabel(key)} stroke="#22d3ee" dot={false} />
                    </LineChart>
                  )}
                </ChartWrap>
              </div>
            );
          })}
        </div>
      );
    }

    return (
      <ChartWrap>
        <BarChart data={importanceData} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis type="number" tickFormatter={(v) => formatDecimal(Number(v), 2)} tick={{ fontSize: 11 }} />
          <YAxis type="category" dataKey="feature" width={160} tick={{ fontSize: 11 }} />
          <Tooltip formatter={tooltipValue} />
          <Bar dataKey="importance" fill="#14b8a6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ChartWrap>
    );
  };

  return (
    <div className="space-y-4">
      {story.notebook_blocks.map((block) => (
        <div key={block.id} className="rounded-xl border border-slate-700 bg-slate-900/50 p-4 space-y-2">
          {block.type === "text" ? (
            textBlock(block)
          ) : (
            <>
              <p className="text-sm font-semibold text-white">{block.title}</p>
              {block.caption && <p className="text-xs text-slate-400">{block.caption}</p>}
              {renderGraph(block)}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
