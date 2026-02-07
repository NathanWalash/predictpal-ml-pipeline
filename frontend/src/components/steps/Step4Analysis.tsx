"use client";

import { useEffect, useMemo, useState } from "react";
import { useBuildStore } from "@/lib/store";
import { Button, Badge, Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { getSampleAnalysisBundle, type AnalysisBundle } from "@/lib/api";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
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

type SectionOption = {
  id: string;
  label: string;
  description: string;
  group: "core" | "advanced";
};

const SECTION_OPTIONS: SectionOption[] = [
  { id: "summary", label: "Run Summary", description: "What data and models were used", group: "core" },
  { id: "metrics", label: "Model Metrics", description: "RMSE, MAE, and improvement", group: "core" },
  { id: "test-fit", label: "Test Fit", description: "Actual vs baseline vs multivariate", group: "core" },
  { id: "future-forecast", label: "Future Forecast", description: "Forecast horizon comparison", group: "core" },
  {
    id: "feature-importance",
    label: "Feature Importance",
    description: "Top model features",
    group: "core",
  },
  {
    id: "error-trend",
    label: "Error Trend",
    description: "Absolute error over the test window",
    group: "advanced",
  },
  {
    id: "driver-series",
    label: "Driver Signals",
    description: "Temperature and holiday pattern",
    group: "advanced",
  },
  { id: "forecast-table", label: "Forecast Table", description: "Raw forecast values", group: "advanced" },
];

const ALL_SECTIONS = SECTION_OPTIONS.map((s) => s.id);

type LooseRecord = Record<string, string | number | null | undefined>;

function parseTimestamp(value: string) {
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
}

function formatShortDateFromTs(value: number) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = String(d.getFullYear());
  return `${day}-${month}-${year}`;
}

function formatLongDateFromTs(value: number) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatDateString(value: string) {
  const ts = parseTimestamp(value);
  return ts === null ? value : formatShortDateFromTs(ts);
}

function formatAxisNumber(value: number) {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toFixed(0);
}

function computeDomain<T extends Record<string, unknown>>(
  data: T[],
  keys: Array<keyof T>,
  clampZero = false
): [number, number] {
  const values: number[] = [];
  for (const row of data) {
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

  if (clampZero && min > 0) {
    min = 0;
  }

  return [min, max];
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

function getDateString(row: LooseRecord): string | null {
  const candidate = row.week_ending ?? row.date ?? row.index;
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

function getFullRangeFromTimestamps(timestamps: number[]) {
  if (timestamps.length === 0) return { startTs: null as number | null, endTs: null as number | null };
  return { startTs: timestamps[0], endTs: timestamps[timestamps.length - 1] };
}

function normalizeRange<T extends { ts: number }>(
  rows: T[],
  range: { startTs: number | null; endTs: number | null }
) {
  if (rows.length === 0) return { startTs: null as number | null, endTs: null as number | null };
  const minTs = rows[0].ts;
  const maxTs = rows[rows.length - 1].ts;
  const startTs = range.startTs ?? minTs;
  const endTs = range.endTs ?? maxTs;
  if (startTs > endTs) return { startTs: minTs, endTs: maxTs };
  return {
    startTs: Math.max(minTs, Math.min(maxTs, startTs)),
    endTs: Math.max(minTs, Math.min(maxTs, endTs)),
  };
}

function filterRowsByRange<T extends { ts: number }>(
  rows: T[],
  range: { startTs: number | null; endTs: number | null }
) {
  if (rows.length === 0) return [] as T[];
  const normalized = normalizeRange(rows, range);
  if (normalized.startTs === null || normalized.endTs === null) return rows;
  return rows.filter((r) => r.ts >= normalized.startTs! && r.ts <= normalized.endTs!);
}

export default function Step4Analysis() {
  const { completeStep, nextStep, prevStep, setWidgets } = useBuildStore();

  const [analysis, setAnalysis] = useState<AnalysisBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const selectedSections = ALL_SECTIONS;
  const [testRange, setTestRange] = useState<{ startTs: number | null; endTs: number | null }>({
    startTs: null,
    endTs: null,
  });
  const [forecastRange, setForecastRange] = useState<{ startTs: number | null; endTs: number | null }>({
    startTs: null,
    endTs: null,
  });
  const [driverRange, setDriverRange] = useState<{ startTs: number | null; endTs: number | null }>({
    startTs: null,
    endTs: null,
  });

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const bundle = await getSampleAnalysisBundle();
        if (!mounted) return;
        setAnalysis(bundle);
      } catch (err: unknown) {
        if (!mounted) return;
        const detail =
          typeof err === "object" &&
          err !== null &&
          "response" in err &&
          typeof (err as { response?: { data?: { detail?: string } } }).response?.data?.detail === "string"
            ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
            : null;
        setLoadError(detail || "Could not load analysis bundle from backend.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const testFitData = useMemo(
    () =>
      (analysis?.datasets.test_predictions || [])
        .map((r) => ({
          ts: parseTimestamp(r.week_ending),
          week_ending: r.week_ending,
          actual: Number(r.actual),
          baseline: Number(r.baseline),
          multivariate: Number(r.multivariate),
        }))
        .filter((r): r is { ts: number; week_ending: string; actual: number; baseline: number; multivariate: number } => r.ts !== null)
        .sort((a, b) => a.ts - b.ts),
    [analysis]
  );

  const historicalTargetData = useMemo(
    () =>
      (analysis?.datasets.target_series || [])
        .map((row) => {
          const asRecord = row as LooseRecord;
          const dateString = getDateString(asRecord);
          if (!dateString) return null;
          const ts = parseTimestamp(dateString);
          const actual = getPrimaryNumericValue(asRecord);
          if (ts === null || actual === null) return null;
          return {
            ts,
            week_ending: dateString,
            actual,
          };
        })
        .filter((r): r is { ts: number; week_ending: string; actual: number } => r !== null)
        .sort((a, b) => a.ts - b.ts),
    [analysis]
  );

  const testFitCombinedData = useMemo(() => {
    const predMap = new Map(
      testFitData.map((r) => [
        r.ts,
        {
          baseline: r.baseline,
          multivariate: r.multivariate,
          actual_test: r.actual,
        },
      ])
    );

    return historicalTargetData.map((r) => {
      const pred = predMap.get(r.ts);
      return {
        ts: r.ts,
        week_ending: r.week_ending,
        actual: r.actual,
        baseline: pred ? pred.baseline : null,
        multivariate: pred ? pred.multivariate : null,
        actual_test: pred ? pred.actual_test : null,
      };
    });
  }, [historicalTargetData, testFitData]);

  const forecastData = useMemo(
    () =>
      (analysis?.datasets.forecast || [])
        .map((r) => ({
          ts: parseTimestamp(r.week_ending),
          week_ending: r.week_ending,
          baseline_forecast: Number(r.baseline_forecast),
          multivariate_forecast: Number(r.multivariate_forecast),
        }))
        .filter(
          (r): r is { ts: number; week_ending: string; baseline_forecast: number; multivariate_forecast: number } =>
            r.ts !== null
        )
        .sort((a, b) => a.ts - b.ts),
    [analysis]
  );

  const forecastCombinedData = useMemo(() => {
    const rows = new Map<
      number,
      {
        ts: number;
        week_ending: string;
        actual: number | null;
        baseline_forecast: number | null;
        multivariate_forecast: number | null;
        handoff_baseline: number | null;
        handoff_multivariate: number | null;
      }
    >();

    for (const row of historicalTargetData) {
      rows.set(row.ts, {
        ts: row.ts,
        week_ending: row.week_ending,
        actual: row.actual,
        baseline_forecast: null,
        multivariate_forecast: null,
        handoff_baseline: null,
        handoff_multivariate: null,
      });
    }

    for (const row of forecastData) {
      const existing = rows.get(row.ts);
      if (existing) {
        existing.baseline_forecast = row.baseline_forecast;
        existing.multivariate_forecast = row.multivariate_forecast;
      } else {
        rows.set(row.ts, {
          ts: row.ts,
          week_ending: row.week_ending,
          actual: null,
          baseline_forecast: row.baseline_forecast,
          multivariate_forecast: row.multivariate_forecast,
          handoff_baseline: null,
          handoff_multivariate: null,
        });
      }
    }

    const sorted = Array.from(rows.values()).sort((a, b) => a.ts - b.ts);

    const lastHistorical = historicalTargetData[historicalTargetData.length - 1];
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
  }, [historicalTargetData, forecastData]);

  const featureImportanceData = useMemo(
    () =>
      (analysis?.datasets.feature_importance || [])
        .map((r) => ({ feature: r.feature, importance: Number(r.importance) }))
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 10),
    [analysis]
  );

  const errorTrendData = useMemo(
    () =>
      testFitData.map((r) => ({
        ts: r.ts,
        week_ending: r.week_ending,
        baseline_error: Math.abs(r.actual - r.baseline),
        multivariate_error: Math.abs(r.actual - r.multivariate),
      })),
    [testFitData]
  );

  const driverData = useMemo(() => {
    const holidayMap = new Map<number, number>();
    for (const row of analysis?.datasets.holiday_weekly || []) {
      const asRecord = row as LooseRecord;
      const dateString = getDateString(asRecord);
      if (!dateString) continue;
      const ts = parseTimestamp(dateString);
      if (ts === null) continue;
      const count = Number(asRecord.holiday_count);
      holidayMap.set(ts, Number.isFinite(count) ? count : 0);
    }

    return (analysis?.datasets.temp_weekly || [])
      .map((row) => {
        const asRecord = row as LooseRecord;
        const dateString = getDateString(asRecord);
        if (!dateString) {
          return null;
        }
        const tempRaw =
          asRecord.temp_mean ??
          asRecord.value ??
          asRecord.temp ??
          getPrimaryNumericValue(asRecord);
        const temp = Number(tempRaw);
        return {
          ts: parseTimestamp(dateString),
          week_ending: dateString,
          temp_mean: Number.isFinite(temp) ? temp : 0,
          holiday_count: 0,
        };
      })
      .filter((r): r is { ts: number | null; week_ending: string; temp_mean: number; holiday_count: number } => r !== null)
      .filter((r): r is { ts: number; week_ending: string; temp_mean: number; holiday_count: number } => r.ts !== null)
      .map((r) => ({
        ...r,
        holiday_count: holidayMap.get(r.ts) || 0,
      }))
      .sort((a, b) => a.ts - b.ts);
  }, [analysis]);

  useEffect(() => {
    setTestRange((prev) => normalizeRange(testFitCombinedData, prev));
  }, [testFitCombinedData]);

  useEffect(() => {
    setForecastRange((prev) => normalizeRange(forecastCombinedData, prev));
  }, [forecastCombinedData]);

  useEffect(() => {
    setDriverRange((prev) => normalizeRange(driverData, prev));
  }, [driverData]);

  const testFitVisibleRows = useMemo(
    () => filterRowsByRange(testFitCombinedData, testRange),
    [testFitCombinedData, testRange]
  );
  const forecastVisibleRows = useMemo(
    () => filterRowsByRange(forecastCombinedData, forecastRange),
    [forecastCombinedData, forecastRange]
  );
  const driverVisibleRows = useMemo(() => filterRowsByRange(driverData, driverRange), [driverData, driverRange]);

  const testFitDomain = useMemo(
    () => computeDomain(testFitVisibleRows, ["actual", "baseline", "multivariate"]),
    [testFitVisibleRows]
  );
  const forecastDomain = useMemo(
    () => computeDomain(forecastVisibleRows, ["actual", "baseline_forecast", "multivariate_forecast"]),
    [forecastVisibleRows]
  );
  const errorDomain = useMemo(
    () => computeDomain(errorTrendData, ["baseline_error", "multivariate_error"], true),
    [errorTrendData]
  );
  const tempDomain = useMemo(() => computeDomain(driverVisibleRows, ["temp_mean"]), [driverVisibleRows]);
  const holidayDomain = useMemo(() => computeDomain(driverVisibleRows, ["holiday_count"], true), [driverVisibleRows]);
  const testWindowStartTs = testFitData.length > 0 ? testFitData[0].ts : null;
  const testWindowEndTs = testFitData.length > 0 ? testFitData[testFitData.length - 1].ts : null;
  const forecastWindowStartTs = forecastData.length > 0 ? forecastData[0].ts : null;
  const forecastWindowEndTs = forecastData.length > 0 ? forecastData[forecastData.length - 1].ts : null;

  const forecastTableRows = useMemo(() => forecastData.slice(0, 8), [forecastData]);

  const handleContinue = () => {
    const selectedWidgets = ALL_SECTIONS
      .map((id) => {
        const section = SECTION_OPTIONS.find((s) => s.id === id);
        if (!section) return null;
        return {
          type: section.id,
          title: section.label,
          caption: section.description,
        };
      })
      .filter((item): item is { type: string; title: string; caption: string } => item !== null);

    setWidgets(selectedWidgets);
    completeStep(4);
    nextStep();
  };

  const fmt = new Intl.NumberFormat("en-GB");
  const pct = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
  const dataSummary = analysis?.manifest?.data_summary;
  const settings = analysis?.manifest?.settings || {};
  const metrics = analysis?.manifest?.metrics;
  const targetLabel = dataSummary?.target_name || "Target";
  const startLabel = dataSummary?.start || "N/A";
  const endLabel = dataSummary?.end || "N/A";
  const rowsLabel = typeof dataSummary?.rows === "number" ? dataSummary.rows : 0;
  const freqLabel = dataSummary?.freq || "N/A";
  const baselineModelLabel = settings.baseline_model ? String(settings.baseline_model) : "N/A";
  const multivariateModelLabel = settings.multi_model ? String(settings.multi_model) : "N/A";
  const baselineRmse = Number(metrics?.baseline_rmse);
  const multivariateRmse = Number(metrics?.multivariate_rmse);
  const improvementPct = Number(metrics?.improvement_pct);
  const evaluationSectionIds = ["summary", "metrics", "test-fit", "error-trend", "feature-importance"];
  const predictionSectionIds = ["future-forecast", "driver-series", "forecast-table"];
  const showEvaluation = selectedSections.some((id) => evaluationSectionIds.includes(id));
  const showPrediction = selectedSections.some((id) => predictionSectionIds.includes(id));

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Analysis & Results</h3>
            <p className="text-sm text-slate-400 mt-1">
              Follow this in order: first check model quality, then review future forecasts.
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <Badge variant={loadError ? "warning" : "success"}>
                {loadError ? "Partial data loaded" : "Data loaded"}
              </Badge>
              <Badge variant="default">Guided flow</Badge>
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3 min-w-[250px]">
            <p className="text-xs font-semibold text-slate-300">Flow</p>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              <span className="text-slate-200 font-semibold">1.</span> Check model quality
            </p>
            <p className="text-xs text-slate-400 leading-relaxed">
              <span className="text-slate-200 font-semibold">2.</span> Review future forecast
            </p>
          </div>
        </div>

        
      </div>

      {loading && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-slate-300 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
          Loading analysis outputs...
        </div>
      )}

      {!loading && loadError && (
        <div className="rounded-2xl border border-amber-800 bg-amber-950/20 p-6 text-amber-300 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Analysis bundle issue</p>
            <p className="text-sm opacity-90">{loadError}</p>
          </div>
        </div>
      )}

      {!loading && analysis && (
        <div className="space-y-6">
          {showEvaluation && (
            <div className="rounded-2xl border border-sky-800/60 bg-sky-950/20 px-4 py-3">
              <p className="text-sm font-semibold text-sky-300">Phase 1: Check Model Quality</p>
              <p className="text-xs text-sky-200/80 mt-1">
                These charts show how well the model performed on the held-out test period.
              </p>
            </div>
          )}

          {selectedSections.includes("summary") && (
            <Card>
              <CardHeader>
                <CardTitle>Run Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                  <InfoCard
                    label="Target"
                    value={targetLabel}
                    help="This is the thing we are trying to predict each week."
                  />
                  <InfoCard
                    label="Date range"
                    value={`${startLabel} to ${endLabel}`}
                    help="This is the period used for training and evaluation."
                  />
                  <InfoCard
                    label="Rows and freq"
                    value={`${rowsLabel} rows, ${freqLabel}`}
                    help="Rows are weekly points. More rows generally means more stable training."
                  />
                  <InfoCard
                    label="Models"
                    value={`${baselineModelLabel} + ${multivariateModelLabel}`}
                    help="Baseline is the simpler reference model. Multivariate uses extra driver signals."
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {selectedSections.includes("metrics") && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <KpiCard
                  title="Baseline RMSE"
                  value={Number.isFinite(baselineRmse) ? fmt.format(baselineRmse) : "N/A"}
                  tone="neutral"
                  explanation="Average prediction error size for the baseline model. Lower is better."
                />
                <KpiCard
                  title="Multivariate RMSE"
                  value={Number.isFinite(multivariateRmse) ? fmt.format(multivariateRmse) : "N/A"}
                  tone="success"
                  explanation="Average prediction error size for the advanced model. Lower is better."
                />
                <KpiCard
                  title="Improvement"
                  value={Number.isFinite(improvementPct) ? `${pct.format(improvementPct)}%` : "N/A"}
                  tone="success"
                  explanation="How much the multivariate model reduced RMSE compared with baseline."
                />
              </div>
              <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3">
                <p className="text-xs font-semibold text-slate-300">Simple reading guide</p>
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Lower RMSE means the model is usually closer to the real weekly value. A positive improvement means
                  the multivariate model performed better than baseline on the test period.
                </p>
              </div>
            </div>
          )}

          {selectedSections.includes("test-fit") && (
            <Card>
              <CardHeader>
                <CardTitle>Test Window Fit</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 mb-1">
                  X-axis: full timeline, with the final test period highlighted.
                </p>
                <p className="text-xs text-slate-500 mb-3">
                  Y-axis: {targetLabel} values. Model prediction lines appear in the test period.
                </p>
                <p className="text-xs text-slate-500 mb-3">
                  Use Start and End to zoom into the period you want to inspect.
                </p>
                {testFitCombinedData.length === 0 ? (
                  <EmptyState text="No test_predictions data found." />
                ) : (
                  <div className="space-y-3">
                    <ChartWrap>
                      <LineChart data={testFitVisibleRows}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis
                          dataKey="ts"
                          type="number"
                          scale="time"
                          domain={["dataMin", "dataMax"]}
                          tickFormatter={(v) => formatShortDateFromTs(Number(v))}
                          minTickGap={28}
                          angle={-25}
                          textAnchor="end"
                          height={56}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis domain={testFitDomain} tickFormatter={formatAxisNumber} tick={{ fontSize: 11 }} />
                        <Tooltip
                          labelFormatter={(label) => formatLongDateFromTs(Number(label))}
                          formatter={tooltipValue}
                        />
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
                        <Line type="monotone" dataKey="actual" stroke="#cbd5e1" dot={false} strokeWidth={2} />
                        <Line
                          type="monotone"
                          dataKey="actual_test"
                          stroke="#22c55e"
                          dot={false}
                          strokeDasharray="4 3"
                          name="actual (test)"
                        />
                        <Line type="monotone" dataKey="baseline" stroke="#3b82f6" dot={false} />
                        <Line type="monotone" dataKey="multivariate" stroke="#14b8a6" dot={false} />
                      </LineChart>
                    </ChartWrap>
                    <TimelineControls
                      title="View Window"
                      timestamps={testFitCombinedData.map((r) => r.ts)}
                      range={testRange}
                      onRangeChange={setTestRange}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {selectedSections.includes("error-trend") && (
            <Card>
              <CardHeader>
                <CardTitle>Absolute Error Trend</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 mb-3">
                  Y-axis: prediction error size (lower is better).
                </p>
                {errorTrendData.length === 0 ? (
                  <EmptyState text="No test data available for error trend." />
                ) : (
                  <ChartWrap>
                    <LineChart data={errorTrendData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis
                        dataKey="ts"
                        type="number"
                        scale="time"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) => formatShortDateFromTs(Number(v))}
                        minTickGap={28}
                        angle={-25}
                        textAnchor="end"
                        height={56}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis domain={errorDomain} tickFormatter={formatAxisNumber} tick={{ fontSize: 11 }} />
                      <Tooltip
                        labelFormatter={(label) => formatLongDateFromTs(Number(label))}
                        formatter={tooltipValue}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="baseline_error" stroke="#3b82f6" dot={false} />
                      <Line type="monotone" dataKey="multivariate_error" stroke="#14b8a6" dot={false} />
                    </LineChart>
                  </ChartWrap>
                )}
              </CardContent>
            </Card>
          )}

          {selectedSections.includes("feature-importance") && (
            <Card>
              <CardHeader>
                <CardTitle>Feature Importance</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 mb-3">
                  This shows which input features influenced the multivariate model most.
                </p>
                {featureImportanceData.length === 0 ? (
                  <EmptyState text="No feature importance data found." />
                ) : (
                  <ChartWrap height={340}>
                    <BarChart data={featureImportanceData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis type="number" tickFormatter={(v) => formatDecimal(Number(v), 2)} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="feature" width={160} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={tooltipValue} />
                      <Bar dataKey="importance" fill="#14b8a6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartWrap>
                )}
              </CardContent>
            </Card>
          )}

          {showPrediction && (
            <div className="rounded-2xl border border-emerald-800/60 bg-emerald-950/20 px-4 py-3">
              <p className="text-sm font-semibold text-emerald-300">Phase 2: Review Future Forecast</p>
              <p className="text-xs text-emerald-200/80 mt-1">
                These charts show what the model predicts for upcoming weeks.
              </p>
            </div>
          )}

          {selectedSections.includes("future-forecast") && (
            <Card>
              <CardHeader>
                <CardTitle>Future Forecast</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 mb-1">
                  X-axis: full timeline, including historical data and future forecast weeks.
                </p>
                <p className="text-xs text-slate-500 mb-3">
                  Y-axis: {targetLabel} values. Actual history is shown first, then forecast lines continue.
                </p>
                <p className="text-xs text-slate-500 mb-3">
                  Use Start and End to focus on the forecast part or view the full timeline.
                </p>
                {forecastCombinedData.length === 0 ? (
                  <EmptyState text="No forecast data found." />
                ) : (
                  <div className="space-y-3">
                    <ChartWrap>
                      <LineChart data={forecastVisibleRows}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis
                          dataKey="ts"
                          type="number"
                          scale="time"
                          domain={["dataMin", "dataMax"]}
                          tickFormatter={(v) => formatShortDateFromTs(Number(v))}
                          minTickGap={28}
                          angle={-25}
                          textAnchor="end"
                          height={56}
                          tick={{ fontSize: 11 }}
                        />
                        <YAxis domain={forecastDomain} tickFormatter={formatAxisNumber} tick={{ fontSize: 11 }} />
                        <Tooltip
                          labelFormatter={(label) => formatLongDateFromTs(Number(label))}
                          formatter={tooltipValue}
                        />
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
                        <Line
                          type="monotone"
                          dataKey="actual"
                          name="historical actual"
                          stroke="#cbd5e1"
                          dot={false}
                          strokeWidth={2}
                        />
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
                    <TimelineControls
                      title="View Window"
                      timestamps={forecastCombinedData.map((r) => r.ts)}
                      range={forecastRange}
                      onRangeChange={setForecastRange}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {selectedSections.includes("driver-series") && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Driver Signal: Temperature</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-500 mb-3">
                    Y-axis: weekly average temperature.
                  </p>
                  {driverData.length === 0 ? (
                    <EmptyState text="No temperature driver data found." />
                  ) : (
                    <div className="space-y-3">
                      <ChartWrap>
                        <LineChart data={driverVisibleRows}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis
                            dataKey="ts"
                            type="number"
                            scale="time"
                            domain={["dataMin", "dataMax"]}
                            tickFormatter={(v) => formatShortDateFromTs(Number(v))}
                            minTickGap={28}
                            angle={-25}
                            textAnchor="end"
                            height={56}
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis
                            domain={tempDomain}
                            tickFormatter={(v) => formatDecimal(Number(v), 1)}
                            tick={{ fontSize: 11 }}
                          />
                          <Tooltip
                            labelFormatter={(label) => formatLongDateFromTs(Number(label))}
                            formatter={tooltipValue}
                          />
                          <Legend />
                          <Line type="monotone" dataKey="temp_mean" stroke="#22d3ee" dot={false} />
                        </LineChart>
                      </ChartWrap>
                      <TimelineControls
                        title="View Window"
                        timestamps={driverData.map((r) => r.ts)}
                        range={driverRange}
                        onRangeChange={setDriverRange}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Driver Signal: Holidays</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-slate-500 mb-3">
                    Y-axis: number of holidays each week.
                  </p>
                  {driverData.length === 0 ? (
                    <EmptyState text="No holiday driver data found." />
                  ) : (
                    <div className="space-y-3">
                      <ChartWrap>
                        <BarChart data={driverVisibleRows}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis
                            dataKey="ts"
                            type="number"
                            scale="time"
                            domain={["dataMin", "dataMax"]}
                            tickFormatter={(v) => formatShortDateFromTs(Number(v))}
                            minTickGap={28}
                            angle={-25}
                            textAnchor="end"
                            height={56}
                            tick={{ fontSize: 11 }}
                          />
                          <YAxis domain={holidayDomain} tickFormatter={formatAxisNumber} tick={{ fontSize: 11 }} />
                          <Tooltip
                            labelFormatter={(label) => formatLongDateFromTs(Number(label))}
                            formatter={tooltipValue}
                          />
                          <Legend />
                          <Bar dataKey="holiday_count" name="holiday count" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ChartWrap>
                      <TimelineControls
                        title="View Window"
                        timestamps={driverData.map((r) => r.ts)}
                        range={driverRange}
                        onRangeChange={setDriverRange}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

          {selectedSections.includes("forecast-table") && (
            <Card>
              <CardHeader>
                <CardTitle>Forecast Table</CardTitle>
              </CardHeader>
              <CardContent>
                {forecastTableRows.length === 0 ? (
                  <EmptyState text="No rows to display." />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-slate-400 border-b border-slate-700">
                          <th className="py-2">Week Ending</th>
                          <th className="py-2">Baseline</th>
                          <th className="py-2">Multivariate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {forecastTableRows.map((row) => (
                          <tr key={row.week_ending} className="border-b border-slate-800/70">
                            <td className="py-2 text-slate-300">{formatDateString(row.week_ending)}</td>
                            <td className="py-2 text-slate-300">{fmt.format(row.baseline_forecast)}</td>
                            <td className="py-2 text-slate-200">{fmt.format(row.multivariate_forecast)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        </div>
      )}

      {!loading && !analysis && !loadError && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-slate-400">
          <EmptyState text="No analysis data available." />
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={prevStep} size="lg">
          {"Back to Training"}
        </Button>
        <Button onClick={handleContinue} size="lg">
          {"Continue to Publish Story"}
        </Button>
      </div>
    </div>
  );
}

function ChartWrap({ children, height = 320 }: { children: React.ReactNode; height?: number }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      {children as React.ReactElement}
    </ResponsiveContainer>
  );
}

function TimelineControls({
  title,
  timestamps,
  range,
  onRangeChange,
}: {
  title: string;
  timestamps: number[];
  range: { startTs: number | null; endTs: number | null };
  onRangeChange: (next: { startTs: number | null; endTs: number | null }) => void;
}) {
  const options = useMemo(
    () => timestamps.map((ts) => ({ value: ts, label: formatShortDateFromTs(ts) })),
    [timestamps]
  );
  const startTs = range.startTs ?? (timestamps.length > 0 ? timestamps[0] : null);
  const endTs = range.endTs ?? (timestamps.length > 0 ? timestamps[timestamps.length - 1] : null);

  const setStart = (nextStart: number) => {
    if (endTs !== null && nextStart > endTs) {
      onRangeChange({ startTs: nextStart, endTs: nextStart });
      return;
    }
    onRangeChange({ startTs: nextStart, endTs });
  };

  const setEnd = (nextEnd: number) => {
    if (startTs !== null && nextEnd < startTs) {
      onRangeChange({ startTs: nextEnd, endTs: nextEnd });
      return;
    }
    onRangeChange({ startTs, endTs: nextEnd });
  };

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold text-slate-300">{title}</p>
        <p className="text-xs text-slate-400">
          {startTs !== null && endTs !== null
            ? `${formatShortDateFromTs(startTs)} to ${formatShortDateFromTs(endTs)}`
            : "No range"}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <label className="text-xs text-slate-400 flex flex-col gap-1">
          Start
          <select
            value={startTs !== null ? String(startTs) : ""}
            onChange={(e) => setStart(Number(e.target.value))}
            className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-slate-200"
          >
            {options.map((opt) => (
              <option key={`start-${opt.value}`} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs text-slate-400 flex flex-col gap-1">
          End
          <select
            value={endTs !== null ? String(endTs) : ""}
            onChange={(e) => setEnd(Number(e.target.value))}
            className="rounded-lg border border-slate-600 bg-slate-800 px-2 py-1.5 text-xs text-slate-200"
          >
            {options.map((opt) => (
              <option key={`end-${opt.value}`} value={String(opt.value)}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex justify-end">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onRangeChange(getFullRangeFromTimestamps(timestamps))}
        >
          Reset to Full Range
        </Button>
      </div>
    </div>
  );
}

function KpiCard({
  title,
  value,
  tone,
  explanation,
}: {
  title: string;
  value: string;
  tone: "neutral" | "success";
  explanation?: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        tone === "success"
          ? "border-emerald-800 bg-emerald-900/20"
          : "border-slate-800 bg-slate-900/60"
      }`}
    >
      <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
      <p className="text-2xl font-semibold text-white mt-1">{value}</p>
      <div className="mt-2 text-xs">
        {tone === "success" ? (
          <span className="inline-flex items-center gap-1 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Improved over baseline
          </span>
        ) : (
          <span className="text-slate-500">Reference metric</span>
        )}
      </div>
      {explanation && <p className="text-xs text-slate-400 mt-2 leading-relaxed">{explanation}</p>}
    </div>
  );
}

function InfoCard({ label, value, help }: { label: string; value: string; help?: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm text-slate-200 mt-1">{value}</p>
      {help && <p className="text-xs text-slate-500 mt-2 leading-relaxed">{help}</p>}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-6 text-center text-sm text-slate-500">
      {text}
    </div>
  );
}
