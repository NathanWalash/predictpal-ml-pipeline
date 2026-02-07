"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useBuildStore, useAuthStore } from "@/lib/store";
import {
  createProject,
  getSampleAnalysisBundle,
  type AnalysisBundle,
  updateProject,
} from "@/lib/api";
import { Badge, Button, Input, Textarea } from "@/components/ui";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  Briefcase,
  CalendarDays,
  Check,
  CircleDollarSign,
  Eye,
  GripVertical,
  HeartPulse,
  Lightbulb,
  Loader2,
  PartyPopper,
  PenSquare,
  Plus,
  Send,
  ShoppingCart,
  Sparkles,
  Trash2,
  TrendingUp,
  UserRound,
  Zap,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type StageId = "setup" | "compose" | "preview";
type TextStyle = "h1" | "h2" | "h3" | "body" | "bullets";
type GraphAssetId = "future-forecast" | "test-fit" | "error-trend" | "driver-series" | "feature-importance";
type LooseRecord = Record<string, string | number | null | undefined>;
type TextBlock = { id: string; type: "text"; style: TextStyle; content: string };
type GraphBlock = {
  id: string;
  type: "graph";
  assetId: GraphAssetId;
  title: string;
  caption: string;
  windowStartTs: number | null;
  windowEndTs: number | null;
};
type NotebookBlock = TextBlock | GraphBlock;

const STAGES = [
  { id: "setup" as StageId, label: "Story Setup", icon: <Lightbulb className="w-4 h-4" /> },
  { id: "compose" as StageId, label: "Notebook Builder", icon: <PenSquare className="w-4 h-4" /> },
  { id: "preview" as StageId, label: "Preview & Publish", icon: <Eye className="w-4 h-4" /> },
];

const GRAPH_ASSETS: Array<{ id: GraphAssetId; title: string; caption: string }> = [
  { id: "future-forecast", title: "Future Forecast", caption: "Forward-looking forecast view" },
  { id: "test-fit", title: "Test Window Fit", caption: "Actual vs predictions on test split" },
  { id: "error-trend", title: "Error Trend", caption: "Absolute error over time" },
  { id: "driver-series", title: "Driver Signals", caption: "Temperature and holiday movement" },
  { id: "feature-importance", title: "Feature Importance", caption: "Most influential features" },
];

const TEXT_PRESETS: Array<{ value: TextStyle; label: string }> = [
  { value: "h1", label: "Heading 1" },
  { value: "h2", label: "Heading 2" },
  { value: "h3", label: "Heading 3" },
  { value: "body", label: "Body Text" },
  { value: "bullets", label: "Bullet List" },
];

const CATEGORY_OPTIONS = [
  { id: "business", label: "Business", icon: <Briefcase className="w-4 h-4" /> },
  { id: "retail", label: "Retail", icon: <ShoppingCart className="w-4 h-4" /> },
  { id: "operations", label: "Operations", icon: <UserRound className="w-4 h-4" /> },
  { id: "demand", label: "Demand", icon: <TrendingUp className="w-4 h-4" /> },
  { id: "finance", label: "Finance", icon: <CircleDollarSign className="w-4 h-4" /> },
  { id: "health", label: "Health", icon: <HeartPulse className="w-4 h-4" /> },
  { id: "energy", label: "Energy", icon: <Zap className="w-4 h-4" /> },
  { id: "weekly", label: "Weekly", icon: <CalendarDays className="w-4 h-4" /> },
];

const parseTs = (v: string) => {
  const ts = Date.parse(v);
  return Number.isFinite(ts) ? ts : null;
};
const fmtDate = (ts: number) => {
  const d = new Date(ts);
  return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
};
const fmtLongDate = (ts: number) => {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "2-digit" });
};
const axisNum = (value: number) => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return value.toFixed(0);
};
const tooltipValue = (value: unknown) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const abs = Math.abs(n);
  const maxFraction = abs >= 100 ? 0 : 2;
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: maxFraction }).format(n);
};
const computeDomain = <T extends Record<string, unknown>>(rows: T[], keys: Array<keyof T>, clampZero = false): [number, number] => {
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
};
const formatDecimal = (value: number, maxFractionDigits = 2) =>
  new Intl.NumberFormat("en-GB", { maximumFractionDigits: maxFractionDigits }).format(value);
const id = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const styleLabel = (style: TextStyle) => TEXT_PRESETS.find((p) => p.value === style)?.label || "Text";
const categoryMeta = (id: string) => CATEGORY_OPTIONS.find((opt) => opt.id === id);

export default function Step5Showcase() {
  const {
    projectId,
    setProjectId,
    projectTitle,
    projectDescription,
    useCase,
    summary,
    setSummary,
    tags,
    setTags,
    completeStep,
    prevStep,
    isLoading,
    setLoading,
    horizon,
    baselineModel,
    multivariateModel,
    selectedDrivers,
  } = useBuildStore();
  const user = useAuthStore((s) => s.user);

  const [analysis, setAnalysis] = useState<AnalysisBundle | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [analysisError, setAnalysisError] = useState("");
  const [stage, setStage] = useState<StageId>("setup");
  const [headline, setHeadline] = useState("");
  const [blocks, setBlocks] = useState<NotebookBlock[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [publishError, setPublishError] = useState("");
  const [published, setPublished] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setAnalysisLoading(true);
      setAnalysisError("");
      try {
        const bundle = await getSampleAnalysisBundle();
        if (mounted) setAnalysis(bundle);
      } catch {
        if (mounted) setAnalysisError("Could not load analysis bundle.");
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
        .map((r) => ({ ts: parseTs(r.week_ending), actual: Number(r.actual), baseline: Number(r.baseline), multivariate: Number(r.multivariate) }))
        .filter((x): x is { ts: number; actual: number; baseline: number; multivariate: number } => x.ts !== null)
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
        .map((r) => ({ ts: parseTs(r.week_ending), baseline_forecast: Number(r.baseline_forecast), multivariate_forecast: Number(r.multivariate_forecast) }))
        .filter((x): x is { ts: number; baseline_forecast: number; multivariate_forecast: number } => x.ts !== null)
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
    () => testPred.map((r) => ({ ts: r.ts, baseline_error: Math.abs(r.actual - r.baseline), multivariate_error: Math.abs(r.actual - r.multivariate) })),
    [testPred]
  );

  const driverData = useMemo(() => {
    const holidayMap = new Map<number, number>();
    for (const row of analysis?.datasets.holiday_weekly || []) {
      const d = (row.week_ending ?? row.index ?? row.date) as string | undefined;
      const ts = d ? parseTs(d) : null;
      if (ts !== null) holidayMap.set(ts, Number(row.holiday_count) || 0);
    }
    return (analysis?.datasets.temp_weekly || [])
      .map((r) => ({ ts: parseTs(r.date), temp_mean: Number(r.temp_mean), holiday_count: 0 }))
      .filter((x): x is { ts: number; temp_mean: number; holiday_count: number } => x.ts !== null)
      .map((x) => ({ ...x, holiday_count: holidayMap.get(x.ts) || 0 }))
      .sort((a, b) => a.ts - b.ts);
  }, [analysis]);

  const importanceData = useMemo(
    () => (analysis?.datasets.feature_importance || []).map((r) => ({ feature: r.feature, importance: Number(r.importance) })).sort((a, b) => b.importance - a.importance).slice(0, 10),
    [analysis]
  );
  const testWindowStartTs = testPred.length > 0 ? testPred[0].ts : null;
  const testWindowEndTs = testPred.length > 0 ? testPred[testPred.length - 1].ts : null;
  const forecastWindowStartTs = forecastData.length > 0 ? forecastData[0].ts : null;
  const forecastWindowEndTs = forecastData.length > 0 ? forecastData[forecastData.length - 1].ts : null;

  const timelineForAsset = (assetId: GraphAssetId) => {
    if (assetId === "future-forecast") return forecastCombined.map((r) => r.ts);
    if (assetId === "test-fit") return testData.map((r) => r.ts);
    if (assetId === "error-trend") return errorData.map((r) => r.ts);
    if (assetId === "driver-series") return driverData.map((r) => r.ts);
    return [];
  };

  const defaultWindow = (assetId: GraphAssetId) => {
    const t = timelineForAsset(assetId);
    return { start: t.length ? t[0] : null, end: t.length ? t[t.length - 1] : null };
  };

  useEffect(() => {
    if (!headline.trim()) setHeadline(projectTitle?.trim() ? `${projectTitle} Forecast Notebook` : "Forecast Notebook Post");
  }, [headline, projectTitle]);

  useEffect(() => {
    if (!summary.trim() && projectDescription?.trim()) setSummary(projectDescription);
  }, [projectDescription, setSummary, summary]);

  useEffect(() => {
    if (blocks.length > 0) return;
    const seed = GRAPH_ASSETS[0];
    const timeline = forecastCombined.map((r) => r.ts);
    const w = { start: timeline.length ? timeline[0] : null, end: timeline.length ? timeline[timeline.length - 1] : null };
    setBlocks([{ id: id(), type: "graph", assetId: seed.id, title: seed.title, caption: seed.caption, windowStartTs: w.start, windowEndTs: w.end }]);
  }, [blocks.length, forecastCombined]);

  const addTextBlock = (style: TextStyle = "body") =>
    setBlocks((prev) => [
      ...prev,
      {
        id: id(),
        type: "text",
        style,
        content:
          style === "bullets"
            ? "Point one\nPoint two"
            : style === "h1"
              ? headline || "Heading"
              : "Write your text",
      },
    ]);
  const addGraphBlock = () => {
    const seed = GRAPH_ASSETS[0];
    const w = defaultWindow(seed.id);
    setBlocks((prev) => [
      ...prev,
      {
        id: id(),
        type: "graph",
        assetId: seed.id,
        title: seed.title,
        caption: seed.caption,
        windowStartTs: w.start,
        windowEndTs: w.end,
      },
    ]);
  };
  const updateBlock = useCallback((blockId: string, fn: (b: NotebookBlock) => NotebookBlock) => {
    setBlocks((prev) => prev.map((b) => (b.id === blockId ? fn(b) : b)));
  }, []);
  const moveBlock = useCallback((i: number, dir: "up" | "down") => {
    setBlocks((prev) => {
      const t = dir === "up" ? i - 1 : i + 1;
      if (t < 0 || t >= prev.length) return prev;
      const c = [...prev];
      [c[i], c[t]] = [c[t], c[i]];
      return c;
    });
  }, []);
  const reorderBlocks = useCallback((sourceId: string, targetId: string) => {
    if (!sourceId || sourceId === targetId) return;
    setBlocks((prev) => {
      const s = prev.findIndex((b) => b.id === sourceId);
      const t = prev.findIndex((b) => b.id === targetId);
      if (s < 0 || t < 0) return prev;
      const c = [...prev];
      const [m] = c.splice(s, 1);
      c.splice(t, 0, m);
      return c;
    });
  }, []);

  const handleAISuggestSetup = () => {
    setHeadline(projectTitle?.trim() ? `${projectTitle}: Forecast Highlights` : "Forecast Highlights");
    setSummary(
      `This post explains the ${horizon}-step forecast for ${projectTitle || "the selected dataset"}, compares ${multivariateModel || "multivariate"} against ${baselineModel || "baseline"}, and summarises practical insights.`
    );
    if (tags.length === 0) setTags(["business", "weekly"]);
    setNotice("AI setup suggestion applied (stub).");
  };

  const handleAISuggestText = (blockId: string) => {
    updateBlock(blockId, (b) => (b.type === "text" ? { ...b, content: b.style === "bullets" ? "Forecast horizon is clear\nModel comparison is positive\nPlan next actions" : "This section explains what the chart means in plain English." } : b));
    setNotice("AI text suggestion applied (stub).");
  };
  const handleAICaption = (blockId: string) => {
    updateBlock(blockId, (b) => (b.type === "graph" ? { ...b, caption: "This chart summarises the key pattern for quick decision-making." } : b));
    setNotice("AI caption suggestion applied (stub).");
  };

  const renderTextPreview = (b: TextBlock) => {
    if (b.style === "h1") return <h1 className="text-3xl font-bold text-white">{b.content}</h1>;
    if (b.style === "h2") return <h2 className="text-2xl font-semibold text-white">{b.content}</h2>;
    if (b.style === "h3") return <h3 className="text-xl font-semibold text-white">{b.content}</h3>;
    if (b.style === "bullets") return <ul className="list-disc pl-5 text-slate-300 text-sm">{b.content.split("\n").filter(Boolean).map((x, i) => <li key={`${b.id}-${i}`}>{x}</li>)}</ul>;
    return <p className="text-sm text-slate-300 whitespace-pre-line">{b.content}</p>;
  };

  const filterWindow = <T extends { ts: number }>(rows: T[], b: GraphBlock) => rows.filter((r) => (b.windowStartTs === null || r.ts >= b.windowStartTs) && (b.windowEndTs === null || r.ts <= b.windowEndTs));

  const renderGraph = (b: GraphBlock) => {
    if (analysisLoading) return <div className="text-xs text-slate-400">Loading chart...</div>;
    if (analysisError) return <div className="text-xs text-amber-300">{analysisError}</div>;

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

    if (b.assetId === "future-forecast") {
      const rows = filterWindow(forecastCombined, b);
      const domain = computeDomain(rows, ["actual", "baseline_forecast", "multivariate_forecast"]);
      return (
        <ChartWrap>
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis {...sharedXAxisProps} />
            <YAxis domain={domain} tickFormatter={axisNum} tick={{ fontSize: 11 }} />
            <Tooltip labelFormatter={(v) => fmtLongDate(Number(v))} formatter={tooltipValue} />
            <Legend />
            {forecastWindowStartTs !== null && forecastWindowEndTs !== null && (
              <ReferenceArea x1={forecastWindowStartTs} x2={forecastWindowEndTs} fill="#022c22" fillOpacity={0.22} ifOverflow="extendDomain" />
            )}
            {forecastWindowStartTs !== null && (
              <ReferenceLine
                x={forecastWindowStartTs}
                stroke="#22c55e"
                strokeDasharray="5 4"
                ifOverflow="extendDomain"
                label={{ value: "forecast starts", fill: "#86efac", fontSize: 10, position: "insideTopRight" }}
              />
            )}
            <Line type="monotone" dataKey="actual" name="historical actual" stroke="#cbd5e1" dot={false} strokeWidth={2} />
            <Line type="monotone" dataKey="baseline_forecast" name="baseline" stroke="#3b82f6" dot={false} />
            <Line type="monotone" dataKey="multivariate_forecast" name="multivariate" stroke="#14b8a6" dot={false} strokeWidth={2} />
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
    if (b.assetId === "test-fit") {
      const rows = filterWindow(testData, b);
      const domain = computeDomain(rows, ["actual", "actual_test", "baseline", "multivariate"]);
      return (
        <ChartWrap>
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis {...sharedXAxisProps} />
            <YAxis domain={domain} tickFormatter={axisNum} tick={{ fontSize: 11 }} />
            <Tooltip labelFormatter={(v) => fmtLongDate(Number(v))} formatter={tooltipValue} />
            <Legend />
            {testWindowStartTs !== null && testWindowEndTs !== null && (
              <ReferenceArea x1={testWindowStartTs} x2={testWindowEndTs} fill="#14532d" fillOpacity={0.22} ifOverflow="extendDomain" />
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
    if (b.assetId === "error-trend") {
      const rows = filterWindow(errorData, b);
      const domain = computeDomain(rows, ["baseline_error", "multivariate_error"], true);
      return (
        <ChartWrap>
          <LineChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis {...sharedXAxisProps} />
            <YAxis domain={domain} tickFormatter={axisNum} tick={{ fontSize: 11 }} />
            <Tooltip labelFormatter={(v) => fmtLongDate(Number(v))} formatter={tooltipValue} />
            <Legend />
            <Line type="monotone" dataKey="baseline_error" name="baseline error" stroke="#3b82f6" dot={false} />
            <Line type="monotone" dataKey="multivariate_error" name="multivariate error" stroke="#14b8a6" dot={false} />
          </LineChart>
        </ChartWrap>
      );
    }
    if (b.assetId === "driver-series") {
      const rows = filterWindow(driverData, b);
      const tempDomain = computeDomain(rows, ["temp_mean"]);
      const holidayDomain = computeDomain(rows, ["holiday_count"], true);
      return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-700 bg-slate-900/30 p-3">
            <p className="text-xs text-slate-400 mb-2">Temperature</p>
            <ChartWrap height={260}>
              <LineChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis {...sharedXAxisProps} />
                <YAxis domain={tempDomain} tickFormatter={(v) => formatDecimal(Number(v), 1)} tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={(v) => fmtLongDate(Number(v))} formatter={tooltipValue} />
                <Legend />
                <Line type="monotone" dataKey="temp_mean" name="temperature mean" stroke="#22d3ee" dot={false} />
              </LineChart>
            </ChartWrap>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-900/30 p-3">
            <p className="text-xs text-slate-400 mb-2">Holidays</p>
            <ChartWrap height={260}>
              <BarChart data={rows}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis {...sharedXAxisProps} />
                <YAxis domain={holidayDomain} tickFormatter={axisNum} tick={{ fontSize: 11 }} />
                <Tooltip labelFormatter={(v) => fmtLongDate(Number(v))} formatter={tooltipValue} />
                <Legend />
                <Bar dataKey="holiday_count" name="holiday count" fill="#f59e0b" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ChartWrap>
          </div>
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

  const renderWindowControls = (b: GraphBlock) => {
    const timeline = timelineForAsset(b.assetId);
    if (timeline.length === 0) return <p className="text-xs text-slate-500">No date window controls for this chart type.</p>;
    const start = b.windowStartTs ?? timeline[0];
    const end = b.windowEndTs ?? timeline[timeline.length - 1];
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
        <label className="text-xs text-slate-400 flex flex-col gap-1">Start
          <select value={String(start)} onChange={(e) => updateBlock(b.id, (x) => x.type === "graph" ? { ...x, windowStartTs: Number(e.target.value) } : x)} className="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-200">
            {timeline.map((ts) => <option key={`${b.id}-s-${ts}`} value={String(ts)}>{fmtDate(ts)}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-400 flex flex-col gap-1">End
          <select value={String(end)} onChange={(e) => updateBlock(b.id, (x) => x.type === "graph" ? { ...x, windowEndTs: Number(e.target.value) } : x)} className="rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1.5 text-xs text-slate-200">
            {timeline.map((ts) => <option key={`${b.id}-e-${ts}`} value={String(ts)}>{fmtDate(ts)}</option>)}
          </select>
        </label>
        <Button size="sm" variant="secondary" onClick={() => updateBlock(b.id, (x) => x.type === "graph" ? { ...x, windowStartTs: timeline[0], windowEndTs: timeline[timeline.length - 1] } : x)}>Reset Window</Button>
      </div>
    );
  };

  const handlePublish = async () => {
    setPublishError("");
    setLoading(true);

    const payload = {
      headline,
      description: summary,
      categories: tags,
      notebook_blocks: blocks,
      published: true,
      publish_mode: "live",
      author_user_id: user?.user_id || null,
      author_username: user?.username || null,
      horizon,
      drivers: selectedDrivers,
      baselineModel,
      multivariateModel,
    };

    const getErrDetail = (err: unknown) =>
      typeof err === "object" &&
      err !== null &&
      "response" in err &&
      typeof (err as { response?: { data?: { detail?: string } } }).response?.data?.detail === "string"
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : null;

    const ensureProjectId = async () => {
      if (projectId) return projectId;
      if (!user) {
        throw new Error("Please sign in before publishing so we can save your story.");
      }
      const created = await createProject(
        user.user_id,
        headline.trim() || projectTitle || "Forecast Notebook Post",
        summary || projectDescription || "",
        useCase || ""
      );
      setProjectId(created.project_id);
      return created.project_id as string;
    };

    try {
      let targetProjectId = await ensureProjectId();

      try {
        await updateProject(targetProjectId, 5, payload);
      } catch (err: unknown) {
        const status =
          typeof err === "object" &&
          err !== null &&
          "response" in err &&
          typeof (err as { response?: { status?: number } }).response?.status === "number"
            ? (err as { response?: { status?: number } }).response?.status
            : null;

        if (status === 404 && user) {
          // Backend store may have restarted and lost the in-memory project.
          const recreated = await createProject(
            user.user_id,
            headline.trim() || projectTitle || "Forecast Notebook Post",
            summary || projectDescription || "",
            useCase || ""
          );
          targetProjectId = recreated.project_id as string;
          setProjectId(targetProjectId);
          await updateProject(targetProjectId, 5, payload);
        } else {
          throw err;
        }
      }

      completeStep(5);
      setPublished(true);
    } catch (err: unknown) {
      setPublishError(
        getErrDetail(err) || (err instanceof Error ? err.message : "Publishing failed. Please try again.")
      );
    } finally {
      setLoading(false);
    }
  };

  if (published) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <PartyPopper className="w-16 h-16 text-teal-400 mb-6" />
        <h2 className="text-3xl font-bold text-white mb-3">Notebook Story Published</h2>
        <p className="text-slate-400 max-w-lg mb-8">&ldquo;{headline || projectTitle || "Forecast Notebook Post"}&rdquo; is ready.</p>
        <div className="flex gap-3">
          <Button size="lg" variant="secondary" onClick={() => (window.location.href = "/explore")}>View Explore</Button>
          <Button size="lg" onClick={() => (window.location.href = "/create")}>Build Another</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2"><PenSquare className="w-5 h-5 text-teal-400" />Publish Story</h3>
        <p className="text-sm text-slate-400 mt-1">Build a clear story from your results using text and chart blocks, then publish to Explore.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-4">
          {STAGES.map((s, i) => (
            <button key={s.id} type="button" onClick={() => setStage(s.id)} className={`rounded-xl border px-3 py-3 text-left transition cursor-pointer ${stage === s.id ? "border-teal-500 bg-teal-500/10" : "border-slate-700 bg-slate-800/40 hover:border-slate-600"}`}>
              <p className="text-xs text-slate-400">Step {i + 1}</p><p className="text-sm font-semibold text-white mt-1 inline-flex items-center gap-2">{s.icon}{s.label}</p>
            </button>
          ))}
        </div>
      </div>

      {stage === "setup" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h4 className="text-white font-semibold text-base">Step 1: Create Your Story</h4>
            <Button size="sm" variant="secondary" onClick={handleAISuggestSetup}><Sparkles className="w-3.5 h-3.5 mr-1" />AI Suggestion</Button>
          </div>
          <Input label="Headline" value={headline} onChange={(e) => setHeadline(e.target.value)} />
          <Textarea label="Short Description" value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} />
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-slate-300">Categories</p>
              <p className="text-xs text-slate-500 mt-1">Pick one or more categories so people can find your story faster.</p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {CATEGORY_OPTIONS.map((option) => {
                const active = tags.includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() =>
                      setTags(active ? tags.filter((t) => t !== option.id) : [...tags, option.id])
                    }
                    className={`rounded-xl border px-3 py-2.5 text-left transition cursor-pointer ${
                      active
                        ? "border-teal-500 bg-teal-500/10 text-teal-200"
                        : "border-slate-700 bg-slate-800/40 text-slate-300 hover:border-slate-600"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 text-sm font-medium">
                      <span className={active ? "text-teal-300" : "text-slate-400"}>{option.icon}</span>
                      {option.label}
                    </span>
                    <span className="block text-[11px] mt-1 text-slate-500">
                      {active ? "Selected" : "Tap to add"}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              {tags.length === 0 ? (
                <span className="text-xs text-slate-500">No categories selected yet.</span>
              ) : (
                tags.map((tag) => {
                  const meta = categoryMeta(tag);
                  return (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1.5 rounded-full border border-teal-800 bg-teal-900/20 px-2.5 py-1 text-xs text-teal-200"
                    >
                      {meta?.icon || <Check className="w-3 h-3" />}
                      {meta?.label || tag}
                    </span>
                  );
                })
              )}
            </div>
          </div>
          {notice && <p className="text-xs text-teal-300">{notice}</p>}
        </div>
      )}

      {stage === "compose" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-white font-semibold text-base">Step 2: Build Your Notebook</h4>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="default">{blocks.length} blocks</Badge>
              <Button onClick={() => addTextBlock("body")}><Plus className="w-3.5 h-3.5 mr-1" />Add Text Block</Button>
              <Button variant="secondary" onClick={addGraphBlock}><Plus className="w-3.5 h-3.5 mr-1" />Add Graph Block</Button>
            </div>
          </div>
          {blocks.map((b, i) => (
            <div key={b.id} className={`rounded-xl border p-4 ${draggingId === b.id ? "border-teal-500 bg-teal-900/10" : "border-slate-700 bg-slate-800/40"}`} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); reorderBlocks(draggingId || e.dataTransfer.getData("text/plain"), b.id); setDraggingId(null); }}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <p className="text-sm font-semibold text-white inline-flex items-center gap-2">
                  <button type="button" draggable onDragStart={(e) => { setDraggingId(b.id); e.dataTransfer.setData("text/plain", b.id); }} onDragEnd={() => setDraggingId(null)} className="text-slate-500 hover:text-slate-300 cursor-grab" title="Drag to reorder"><GripVertical className="w-4 h-4" /></button>
                  Block {i + 1}
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => moveBlock(i, "up")} disabled={i === 0}><ArrowUp className="w-4 h-4" /></Button>
                  <Button size="sm" variant="secondary" onClick={() => moveBlock(i, "down")} disabled={i === blocks.length - 1}><ArrowDown className="w-4 h-4" /></Button>
                  <Button size="sm" variant="destructive" onClick={() => setBlocks((prev) => prev.filter((x) => x.id !== b.id))}><Trash2 className="w-3.5 h-3.5" /></Button>
                </div>
              </div>

              {b.type === "text" && (
                <div className="space-y-3">
                  <label className="space-y-1 block"><span className="text-xs text-slate-400">Text Preset</span>
                    <select value={b.style} onChange={(e) => updateBlock(b.id, (x) => x.type === "text" ? { ...x, style: e.target.value as TextStyle } : x)} className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
                      {TEXT_PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                  </label>
                  <BufferedTextarea
                    label={`Content (${styleLabel(b.style)})`}
                    value={b.content}
                    rows={4}
                    onCommit={(next) =>
                      updateBlock(b.id, (x) => (x.type === "text" ? { ...x, content: next } : x))
                    }
                  />
                  <Button size="sm" variant="secondary" onClick={() => handleAISuggestText(b.id)}><Sparkles className="w-3.5 h-3.5 mr-1" />AI Suggest Text</Button>
                </div>
              )}

              {b.type === "graph" && (
                <div className="space-y-3">
                  <label className="space-y-1 block"><span className="text-xs text-slate-400">Graph Source</span>
                    <select value={b.assetId} onChange={(e) => updateBlock(b.id, (x) => { if (x.type !== "graph") return x; const a = e.target.value as GraphAssetId; const m = GRAPH_ASSETS.find((z) => z.id === a)!; const w = defaultWindow(a); return { ...x, assetId: a, title: m.title, caption: m.caption, windowStartTs: w.start, windowEndTs: w.end }; })} className="w-full rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm text-slate-200">
                      {GRAPH_ASSETS.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
                    </select>
                  </label>
                  <BufferedInput
                    label="Graph Title"
                    value={b.title}
                    onCommit={(next) =>
                      updateBlock(b.id, (x) => (x.type === "graph" ? { ...x, title: next } : x))
                    }
                  />
                  <BufferedTextarea
                    label="Graph Caption"
                    value={b.caption}
                    rows={3}
                    onCommit={(next) =>
                      updateBlock(b.id, (x) => (x.type === "graph" ? { ...x, caption: next } : x))
                    }
                  />
                  <Button size="sm" variant="secondary" onClick={() => handleAICaption(b.id)}><Sparkles className="w-3.5 h-3.5 mr-1" />AI Suggest Caption</Button>
                  {renderWindowControls(b)}
                  {renderGraph(b)}
                </div>
              )}
            </div>
          ))}
          {notice && <p className="text-xs text-teal-300">{notice}</p>}
        </div>
      )}

      {stage === "preview" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-5">
          <div className="flex items-center justify-between"><h4 className="text-white font-semibold text-base">Step 3: Preview and Publish</h4><Badge variant="success">Ready to publish</Badge></div>
          <div className="rounded-xl border border-slate-700 bg-slate-950/50 p-5 space-y-4">
            <h5 className="text-2xl font-bold text-white">{headline || "Untitled Story"}</h5>
            <p className="text-sm text-slate-300">{summary}</p>
            <div className="flex flex-wrap gap-2">{tags.map((t) => <span key={t} className="px-2.5 py-1 rounded-full bg-slate-800 text-xs text-slate-300 border border-slate-700">{t}</span>)}</div>
            <div className="space-y-3">{blocks.map((b) => <div key={b.id} className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">{b.type === "text" ? renderTextPreview(b) : (<div className="space-y-2"><p className="text-sm font-semibold text-white inline-flex items-center gap-2"><BarChart3 className="w-4 h-4 text-teal-300" />{b.title}</p><p className="text-xs text-slate-400">{b.caption}</p>{renderGraph(b)}</div>)}</div>)}</div>
          </div>
          <div className="rounded-xl border border-slate-700 bg-slate-900/40 px-4 py-3 text-sm text-slate-400">
            <p className="font-medium text-slate-300">Project Overview</p>
            <p className="mt-1">{projectTitle || "Untitled"} ({useCase || "General"}) | Baseline: {baselineModel || "-"} | Multivariate: {multivariateModel || "-"} | Horizon: {horizon} | Author: {user?.username || "anonymous"}</p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={prevStep} size="lg"><ArrowLeft className="w-4 h-4 mr-1" />Back</Button>
        <div className="flex items-center gap-2">
          <Button size="lg" variant="secondary" onClick={() => setStage(stage === "preview" ? "compose" : stage === "compose" ? "setup" : "setup")} disabled={stage === "setup"}>Previous Step</Button>
          {stage !== "preview" ? (
            <Button size="lg" onClick={() => setStage(stage === "setup" ? "compose" : "preview")} disabled={stage === "setup" && (!headline.trim() || !summary.trim())}>Next Step</Button>
          ) : (
            <Button onClick={handlePublish} disabled={isLoading || !headline.trim() || !summary.trim() || blocks.length === 0} size="lg">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}Publish Story
            </Button>
          )}
        </div>
      </div>
      {publishError && (
        <div className="rounded-xl border border-amber-800 bg-amber-950/20 px-4 py-3 text-sm text-amber-300">
          {publishError}
        </div>
      )}
    </div>
  );
}

function BufferedInput({
  label,
  value,
  onCommit,
  placeholder,
}: {
  label: string;
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  return (
    <Input
      label={label}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

function BufferedTextarea({
  label,
  value,
  onCommit,
  rows = 3,
}: {
  label: string;
  value: string;
  onCommit: (next: string) => void;
  rows?: number;
}) {
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const commit = () => {
    if (draft !== value) onCommit(draft);
  };

  return (
    <Textarea
      label={label}
      value={draft}
      rows={rows}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
    />
  );
}

function ChartWrap({ children, height = 320 }: { children: React.ReactNode; height?: number }) {
  return <ResponsiveContainer width="100%" height={height}>{children as React.ReactElement}</ResponsiveContainer>;
}
