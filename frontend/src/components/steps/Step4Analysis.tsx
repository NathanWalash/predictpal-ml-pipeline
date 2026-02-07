"use client";

import { useEffect, useMemo, useState } from "react";
import { useBuildStore } from "@/lib/store";
import { Button, Badge, Card, CardHeader, CardTitle, CardContent } from "@/components/ui";
import { getSampleAnalysisBundle, type AnalysisBundle } from "@/lib/api";
import { AlertCircle, CheckCircle2, FileText, Loader2 } from "lucide-react";
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

const CORE_SECTIONS = SECTION_OPTIONS.filter((s) => s.group === "core").map((s) => s.id);
const ALL_SECTIONS = SECTION_OPTIONS.map((s) => s.id);

function parseTimestamp(value: string) {
  const ts = Date.parse(value);
  return Number.isFinite(ts) ? ts : null;
}

function formatShortDateFromTs(value: number) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return `${d.getFullYear().toString().slice(2)}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
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
      const n = Number(row[key]);
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
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 }).format(n);
}

export default function Step4Analysis() {
  const { completeStep, nextStep, prevStep } = useBuildStore();

  const [analysis, setAnalysis] = useState<AnalysisBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selectedSections, setSelectedSections] = useState<string[]>(CORE_SECTIONS);

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
    const holidayMap = new Map(
      (analysis?.datasets.holiday_weekly || []).map((r) => [r.week_ending, Number(r.holiday_count)])
    );
    return (analysis?.datasets.temp_weekly || [])
      .map((r) => ({
        ts: parseTimestamp(r.date),
        week_ending: r.date,
        temp_mean: Number(r.temp_mean),
        holiday_count: holidayMap.get(r.date) || 0,
      }))
      .filter((r): r is { ts: number; week_ending: string; temp_mean: number; holiday_count: number } => r.ts !== null)
      .sort((a, b) => a.ts - b.ts);
  }, [analysis]);

  const testFitDomain = useMemo(
    () => computeDomain(testFitData, ["actual", "baseline", "multivariate"]),
    [testFitData]
  );
  const forecastDomain = useMemo(
    () => computeDomain(forecastData, ["baseline_forecast", "multivariate_forecast"]),
    [forecastData]
  );
  const errorDomain = useMemo(
    () => computeDomain(errorTrendData, ["baseline_error", "multivariate_error"], true),
    [errorTrendData]
  );
  const tempDomain = useMemo(() => computeDomain(driverData, ["temp_mean"]), [driverData]);
  const holidayDomain = useMemo(() => computeDomain(driverData, ["holiday_count"], true), [driverData]);

  const forecastTableRows = useMemo(() => forecastData.slice(0, 8), [forecastData]);

  const toggleSection = (id: string) => {
    setSelectedSections((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleContinue = () => {
    completeStep(4);
    nextStep();
  };

  const fmt = new Intl.NumberFormat("en-GB");
  const pct = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 2 });
  const targetLabel = analysis?.manifest.data_summary.target_name || "Target";

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white">Analysis View</h3>
        <p className="text-sm text-slate-400">
          Pick what to show below. Start with Core sections for a simple view, then add Advanced sections if needed.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => setSelectedSections(CORE_SECTIONS)}>
            Core only
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setSelectedSections(ALL_SECTIONS)}>
            Show all
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedSections([])}>
            Clear
          </Button>
          <Badge variant={loadError ? "warning" : "success"}>
            {loadError ? "Partial data" : "Data loaded"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {SECTION_OPTIONS.map((section) => {
            const active = selectedSections.includes(section.id);
            return (
              <button
                key={section.id}
                type="button"
                onClick={() => toggleSection(section.id)}
                className={`text-left rounded-xl border px-4 py-3 transition-all cursor-pointer ${
                  active
                    ? "border-teal-500 bg-teal-500/10"
                    : "border-slate-700 bg-slate-800/40 hover:border-slate-600"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{section.label}</p>
                    <p className="text-xs text-slate-400 mt-1">{section.description}</p>
                  </div>
                  <div className="shrink-0">
                    {active ? (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal-500 text-black text-xs">
                        <CheckCircle2 className="w-4 h-4" />
                      </span>
                    ) : (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-700 text-slate-400 text-xs">
                        {section.group === "core" ? "C" : "A"}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
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
          {selectedSections.includes("summary") && (
            <Card>
              <CardHeader>
                <CardTitle>Run Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
                  <InfoCard label="Target" value={analysis.manifest.data_summary.target_name} />
                  <InfoCard
                    label="Date range"
                    value={`${analysis.manifest.data_summary.start} to ${analysis.manifest.data_summary.end}`}
                  />
                  <InfoCard
                    label="Rows and freq"
                    value={`${analysis.manifest.data_summary.rows} rows, ${analysis.manifest.data_summary.freq}`}
                  />
                  <InfoCard
                    label="Models"
                    value={`${String(analysis.manifest.settings.baseline_model)} + ${String(
                      analysis.manifest.settings.multi_model
                    )}`}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {selectedSections.includes("metrics") && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <KpiCard title="Baseline RMSE" value={fmt.format(analysis.manifest.metrics.baseline_rmse)} tone="neutral" />
              <KpiCard
                title="Multivariate RMSE"
                value={fmt.format(analysis.manifest.metrics.multivariate_rmse)}
                tone="success"
              />
              <KpiCard title="Improvement" value={`${pct.format(analysis.manifest.metrics.improvement_pct)}%`} tone="success" />
            </div>
          )}

          {selectedSections.includes("test-fit") && (
            <Card>
              <CardHeader>
                <CardTitle>Test Window Fit</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 mb-1">
                  X-axis: week ending dates from `artifacts/test_predictions.csv` (sorted chronologically).
                </p>
                <p className="text-xs text-slate-500 mb-3">
                  Y-axis: {targetLabel} count, sourced from `actual`, `baseline`, and `multivariate` columns.
                </p>
                {testFitData.length === 0 ? (
                  <EmptyState text="No test_predictions data found." />
                ) : (
                  <ChartWrap>
                    <LineChart data={testFitData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis
                        dataKey="ts"
                        type="number"
                        scale="time"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) => formatShortDateFromTs(Number(v))}
                        minTickGap={28}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis domain={testFitDomain} tickFormatter={formatAxisNumber} tick={{ fontSize: 11 }} />
                      <Tooltip
                        labelFormatter={(label) => formatLongDateFromTs(Number(label))}
                        formatter={tooltipValue}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="actual" stroke="#cbd5e1" dot={false} strokeWidth={2} />
                      <Line type="monotone" dataKey="baseline" stroke="#3b82f6" dot={false} />
                      <Line type="monotone" dataKey="multivariate" stroke="#14b8a6" dot={false} />
                    </LineChart>
                  </ChartWrap>
                )}
              </CardContent>
            </Card>
          )}

          {selectedSections.includes("future-forecast") && (
            <Card>
              <CardHeader>
                <CardTitle>Future Forecast</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 mb-1">
                  X-axis: future week ending dates from `forecasts/forecast.csv` (sorted chronologically).
                </p>
                <p className="text-xs text-slate-500 mb-3">
                  Y-axis: predicted {targetLabel} count from `baseline_forecast` and `multivariate_forecast`.
                </p>
                {forecastData.length === 0 ? (
                  <EmptyState text="No forecast data found." />
                ) : (
                  <ChartWrap>
                    <LineChart data={forecastData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis
                        dataKey="ts"
                        type="number"
                        scale="time"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) => formatShortDateFromTs(Number(v))}
                        minTickGap={28}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis domain={forecastDomain} tickFormatter={formatAxisNumber} tick={{ fontSize: 11 }} />
                      <Tooltip
                        labelFormatter={(label) => formatLongDateFromTs(Number(label))}
                        formatter={tooltipValue}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="baseline_forecast" name="baseline" stroke="#3b82f6" dot={false} />
                      <Line
                        type="monotone"
                        dataKey="multivariate_forecast"
                        name="multivariate"
                        stroke="#14b8a6"
                        dot={false}
                        strokeWidth={2}
                      />
                    </LineChart>
                  </ChartWrap>
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
                  Y-axis: absolute error in {targetLabel} units, computed from test predictions.
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

          {selectedSections.includes("driver-series") && (
            <Card>
              <CardHeader>
                <CardTitle>Driver Signals</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-slate-500 mb-3">
                  Left Y-axis: weekly mean temperature from `artifacts/temp_weekly.csv`. Right Y-axis: holiday count
                  from `artifacts/holiday_weekly.csv`.
                </p>
                {driverData.length === 0 ? (
                  <EmptyState text="No driver data found." />
                ) : (
                  <ChartWrap>
                    <LineChart data={driverData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis
                        dataKey="ts"
                        type="number"
                        scale="time"
                        domain={["dataMin", "dataMax"]}
                        tickFormatter={(v) => formatShortDateFromTs(Number(v))}
                        minTickGap={28}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis yAxisId="left" domain={tempDomain} tick={{ fontSize: 11 }} />
                      <YAxis yAxisId="right" orientation="right" domain={holidayDomain} tick={{ fontSize: 11 }} />
                      <Tooltip
                        labelFormatter={(label) => formatLongDateFromTs(Number(label))}
                        formatter={tooltipValue}
                      />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="temp_mean" stroke="#22d3ee" dot={false} />
                      <Line yAxisId="right" type="monotone" dataKey="holiday_count" stroke="#f59e0b" dot={false} />
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
                  Y-axis lists feature names. X-axis is relative model importance from
                  `artifacts/feature_importance.csv`.
                </p>
                {featureImportanceData.length === 0 ? (
                  <EmptyState text="No feature importance data found." />
                ) : (
                  <ChartWrap height={340}>
                    <BarChart data={featureImportanceData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="feature" width={160} tick={{ fontSize: 11 }} />
                      <Tooltip formatter={tooltipValue} />
                      <Bar dataKey="importance" fill="#14b8a6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ChartWrap>
                )}
              </CardContent>
            </Card>
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
                            <td className="py-2 text-slate-300">{row.week_ending}</td>
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

          {selectedSections.length === 0 && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-center text-slate-500">
              <FileText className="w-10 h-10 mx-auto mb-3 text-slate-600" />
              <p>Select at least one section to populate the analysis view.</p>
            </div>
          )}
        </div>
      )}

      {!loading && !analysis && !loadError && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-slate-400">
          <EmptyState text="No analysis data available." />
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={prevStep}>
          {"<- Back"}
        </Button>
        <Button onClick={handleContinue} disabled={selectedSections.length === 0} size="lg">
          {"Continue to Showcase ->"}
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

function KpiCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
  tone: "neutral" | "success";
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
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/40 px-4 py-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm text-slate-200 mt-1">{value}</p>
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
