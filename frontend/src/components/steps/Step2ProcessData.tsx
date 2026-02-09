"use client";

import { useState } from "react";
import { useBuildStore } from "@/lib/store";
import { processData, sendChatMessage } from "@/lib/api";
import { BubbleSelect, Button, Input } from "@/components/ui";
import {
  Calendar,
  Hash,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  X,
  CheckCircle2,
  MessageSquare,
  Loader2,
} from "lucide-react";

const FREQUENCY_OPTIONS = [
  { id: "D", label: "Daily", icon: <Calendar className="w-4 h-4" /> },
  { id: "W", label: "Weekly", icon: <Calendar className="w-4 h-4" /> },
  { id: "MS", label: "Monthly", icon: <Calendar className="w-4 h-4" /> },
  { id: "QS", label: "Quarterly", icon: <Calendar className="w-4 h-4" /> },
  { id: "YS", label: "Yearly", icon: <Calendar className="w-4 h-4" /> },
];

const DRIVER_FREQUENCY_OPTIONS = [
  { id: "auto", label: "Auto", icon: <Sparkles className="w-4 h-4" /> },
  { id: "D", label: "Daily", icon: <Calendar className="w-4 h-4" /> },
  { id: "W", label: "Weekly", icon: <Calendar className="w-4 h-4" /> },
  { id: "MS", label: "Monthly", icon: <Calendar className="w-4 h-4" /> },
];

const MISSING_STRATEGY_OPTIONS = [
  {
    id: "ffill",
    label: "Forward Fill",
    icon: <ArrowRight className="w-4 h-4" />,
    description: "Carry last known value",
  },
  {
    id: "bfill",
    label: "Backward Fill",
    icon: <ArrowLeft className="w-4 h-4" />,
    description: "Use next known value",
  },
  {
    id: "interpolate",
    label: "Interpolate",
    icon: <BarChart3 className="w-4 h-4" />,
    description: "Linear interpolation",
  },
  {
    id: "drop",
    label: "Drop Rows",
    icon: <X className="w-4 h-4" />,
    description: "Remove missing rows",
  },
  {
    id: "mean",
    label: "Mean Fill",
    icon: <BarChart3 className="w-4 h-4" />,
    description: "Fill with column mean",
  },
  {
    id: "median",
    label: "Median Fill",
    icon: <BarChart3 className="w-4 h-4" />,
    description: "Fill with column median",
  },
  {
    id: "value",
    label: "Custom Value",
    icon: <Hash className="w-4 h-4" />,
    description: "Fill with a fixed value",
  },
];

const DRIVER_MISSING_STRATEGY_OPTIONS = MISSING_STRATEGY_OPTIONS.filter(
  (opt) => opt.id !== "value"
);

const OUTLIER_STRATEGY_OPTIONS = [
  {
    id: "cap",
    label: "Clip (IQR)",
    icon: <BarChart3 className="w-4 h-4" />,
    description: "Cap at 1.5x IQR bounds",
  },
  {
    id: "remove",
    label: "Remove",
    icon: <X className="w-4 h-4" />,
    description: "Drop outlier rows",
  },
  {
    id: "keep",
    label: "Keep All",
    icon: <CheckCircle2 className="w-4 h-4" />,
    description: "Do not treat outliers",
  },
];

export default function Step2ProcessData() {
  const {
    columns,
    numericColumns,
    rowCount,
    detectedDateCol,
    dateCol,
    setDateCol,
    targetCol,
    setTargetCol,
    frequency,
    setFrequency,
    driverFrequency,
    setDriverFrequency,
    missingStrategy,
    setMissingStrategy,
    missingFillValue,
    setMissingFillValue,
    outlierStrategy,
    setOutlierStrategy,
    driverOutlierStrategy,
    setDriverOutlierStrategy,
    driverSettings,
    setDriverSetting,
    completeStep,
    nextStep,
    prevStep,
    projectId,
    setFileInfo,
    setDriverInfos,
    clearDriverInfo,
    setLoading,
    setLoadingMessage,
    driverFiles,
    chatMessages,
    addChatMessage,
  } = useBuildStore();

  const [processError, setProcessError] = useState("");
  const [aiBusyKey, setAiBusyKey] = useState<string | null>(null);

  const getApiErrorMessage = (err: unknown) => {
    if (
      typeof err === "object" &&
      err !== null &&
      "response" in err &&
      typeof (err as { response?: unknown }).response === "object" &&
      (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
    ) {
      return (err as { response: { data: { detail: string } } }).response.data.detail;
    }
    return "Failed to process data.";
  };

  const dateColOptions = columns.map((c) => ({
    id: c,
    label: c,
    icon:
      c === detectedDateCol ? <Sparkles className="w-4 h-4" /> : <Calendar className="w-4 h-4" />,
    description: c === detectedDateCol ? "Auto-detected" : undefined,
  }));

  const targetColOptions = numericColumns.map((c) => ({
    id: c,
    label: c,
    icon: <BarChart3 className="w-4 h-4" />,
  }));

  const canContinue = Boolean((dateCol || detectedDateCol) && targetCol && projectId);

  const normalizedOutlierStrategy =
    outlierStrategy === "clip"
      ? "cap"
      : outlierStrategy === "none"
        ? "keep"
        : outlierStrategy;

  const normalizedDriverOutlierStrategy =
    driverOutlierStrategy === "clip"
      ? "cap"
      : driverOutlierStrategy === "none"
        ? "keep"
        : driverOutlierStrategy;

  const getDriverSetting = (
    fileName: string,
    key: "frequency" | "missingStrategy" | "outlierStrategy",
    fallback: string
  ) => {
    const settings = driverSettings[fileName] || {};
    const value = settings[key];
    return value && value.length > 0 ? value : fallback;
  };

  const handleContinue = async () => {
    if (!projectId || !targetCol || !(dateCol || detectedDateCol)) return;
    const resolvedDateCol = dateCol || detectedDateCol;
    if (!resolvedDateCol) return;

    setLoading(true);
    setLoadingMessage("Applying Step 2 processing...");
    setProcessError("");

    try {
      const result = await processData({
        projectId,
        dateCol: resolvedDateCol,
        targetCol,
        frequency: frequency || "W",
        driverFrequency: driverFrequency || undefined,
        outlierStrategy: outlierStrategy || "keep",
        driverOutlierStrategy: driverOutlierStrategy || "keep",
        missingStrategy: missingStrategy || undefined,
        missingFillValue: missingStrategy === "value" ? missingFillValue : undefined,
        driverMissingStrategy: undefined,
        driverSettings:
          driverFiles.length > 0
            ? Object.fromEntries(
                driverFiles.map((file) => [
                  file.fileName,
                  {
                    frequency: (() => {
                      const value = getDriverSetting(file.fileName, "frequency", "auto");
                      return value === "auto" ? undefined : value;
                    })(),
                    missingStrategy: getDriverSetting(file.fileName, "missingStrategy", "median"),
                    outlierStrategy: getDriverSetting(
                      file.fileName,
                      "outlierStrategy",
                      normalizedDriverOutlierStrategy || "keep"
                    ),
                  },
                ])
              )
            : undefined,
      });

      setDateCol(result.detected_date_col || resolvedDateCol);
      setTargetCol(result.target_col || targetCol);
      setFileInfo({
        columns: result.columns || [],
        numericColumns: result.numeric_columns || [],
        detectedDateCol: result.detected_date_col || null,
        rowCount: result.rows || 0,
        previewData: result.preview || [],
        columnDtypes: result.dtypes || {},
      });

      if (Array.isArray(result.driver?.files) && result.driver.files.length > 0) {
        const existingByName = new Map(driverFiles.map((file) => [file.fileName, file]));
        type ProcessedDriverFile = { file_name: string; numeric_columns?: string[] };
        setDriverInfos(
          result.driver.files.map((file: ProcessedDriverFile) => ({
            fileName: file.file_name,
            columns: existingByName.get(file.file_name)?.columns || [],
            numericColumns: file.numeric_columns || [],
            detectedDateCol: existingByName.get(file.file_name)?.detectedDateCol || null,
            rowCount: existingByName.get(file.file_name)?.rowCount || 0,
            previewData: existingByName.get(file.file_name)?.previewData || [],
            columnDtypes: existingByName.get(file.file_name)?.columnDtypes || {},
          }))
        );
      } else {
        clearDriverInfo();
      }
    } catch (err: unknown) {
      setProcessError(getApiErrorMessage(err));
      return;
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }

    if (!dateCol && detectedDateCol) setDateCol(detectedDateCol);
    completeStep(2);
    nextStep();
  };

  const extractRecommendation = (content: string, validIds: string[]) => {
    const match = content.match(/RECOMMENDATION\s*:\s*([A-Za-z0-9_.-]+)/i);
    if (!match) return null;
    const raw = match[1].replace(/[`"'.,;:!?]+$/g, "").trim();
    const found = validIds.find((id) => id.toLowerCase() === raw.toLowerCase());
    return found || null;
  };

  const sanitizeAssistantReply = (content: string) => {
    const cleaned = content
      .replace(/\n?\s*RECOMMENDATION\s*:\s*[A-Za-z0-9_.-]+\s*$/i, "")
      .trim();
    return cleaned || content;
  };

  const askPredictPalForChoice = async (args: {
    key: string;
    topic: string;
    options: { id: string; label: string }[];
    currentValue?: string;
    applyRecommendation: (id: string) => void;
  }) => {
    if (aiBusyKey) return;
    setAiBusyKey(args.key);

    const optionsText = args.options
      .map((opt) => `- ${opt.id}: ${opt.label}`)
      .join("\n");

    const internalPrompt = [
      `Can you explain these ${args.topic} options and suggest the best one for my current dataset?`,
      "",
      "Use only one of these option IDs:",
      optionsText,
      "",
      `Current selection: ${args.currentValue || "not selected"}`,
      "",
      "Reply with concise reasoning, then end with exactly:",
      "RECOMMENDATION: <id>",
    ].join("\n");

    addChatMessage({
      role: "user",
      content: `Can you explain these ${args.topic} options and suggest the best one for my current dataset?`,
    });

    try {
      const response = await sendChatMessage({
        project_id: projectId || "demo",
        message: internalPrompt,
        page_context: [
          "Page: Process Data (Step 2).",
          dateCol || detectedDateCol
            ? `Date column: ${dateCol || detectedDateCol}.`
            : "Date column not selected.",
          targetCol ? `Target column: ${targetCol}.` : "Target column not selected.",
          rowCount > 0 ? `Rows: ${rowCount}.` : "",
          numericColumns.length > 0
            ? `Numeric columns: ${numericColumns.join(", ")}.`
            : "",
          `Frequency: ${frequency || "not selected"}.`,
          `Missing strategy: ${missingStrategy || "not selected"}.`,
          `Outlier strategy: ${normalizedOutlierStrategy || "not selected"}.`,
          `Driver outlier strategy: ${normalizedDriverOutlierStrategy || "not selected"}.`,
        ]
          .filter(Boolean)
          .join(" "),
        history: chatMessages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
      });

      addChatMessage({
        role: "assistant",
        content: sanitizeAssistantReply(response.content),
      });
      const recommendation = extractRecommendation(
        response.content,
        args.options.map((o) => o.id)
      );
      if (recommendation) {
        args.applyRecommendation(recommendation);
      }
    } catch {
      addChatMessage({
        role: "assistant",
        content:
          "I couldn't fetch a recommendation right now. Please try again in a few seconds.",
      });
    } finally {
      setAiBusyKey(null);
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/80 to-slate-800/40 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-teal-500/10 p-2 text-teal-300">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-white">Step 2: Process Data</h2>
            <p className="text-sm text-slate-400">
              Choose your date and target columns, then pick simple cleaning options.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-teal-300" />
          Choose Columns
        </h3>

        <BubbleSelect
          label="Date Column"
          options={dateColOptions}
          selected={dateCol || detectedDateCol || ""}
          onSelect={setDateCol}
          layout="grid"
          columns={2}
          fullWidth
        />

        <BubbleSelect
          label="Target Column"
          options={targetColOptions}
          selected={targetCol || ""}
          onSelect={setTargetCol}
          layout="grid"
          columns={2}
          fullWidth
        />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-teal-300" />
          Clean and Prepare Target Data
        </h3>

        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-medium text-slate-300">How often is your target data?</label>
          <Button
            size="icon"
            variant="secondary"
            disabled={aiBusyKey !== null}
            aria-label="Ask Predict Pal about frequency options"
            title="Ask Predict Pal"
            onClick={() =>
              askPredictPalForChoice({
                key: "frequency",
                topic: "frequency",
                options: FREQUENCY_OPTIONS.map((o) => ({ id: o.id, label: o.label })),
                currentValue: frequency,
                applyRecommendation: setFrequency,
              })
            }
          >
            {aiBusyKey === "frequency" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <span className="inline-flex items-center gap-0.5 leading-none">
                <span className="text-[11px]">🤖</span>
                <MessageSquare className="w-3 h-3" />
              </span>
            )}
          </Button>
        </div>
        <BubbleSelect
          options={FREQUENCY_OPTIONS}
          selected={frequency}
          onSelect={setFrequency}
          layout="grid"
          columns={3}
          fullWidth
        />

        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-medium text-slate-300">How should we fill missing target values?</label>
          <Button
            size="icon"
            variant="secondary"
            disabled={aiBusyKey !== null}
            aria-label="Ask Predict Pal about missing value options"
            title="Ask Predict Pal"
            onClick={() =>
              askPredictPalForChoice({
                key: "missing",
                topic: "missing value handling",
                options: MISSING_STRATEGY_OPTIONS.map((o) => ({ id: o.id, label: o.label })),
                currentValue: missingStrategy,
                applyRecommendation: setMissingStrategy,
              })
            }
          >
            {aiBusyKey === "missing" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <span className="inline-flex items-center gap-0.5 leading-none">
                <span className="text-[11px]">🤖</span>
                <MessageSquare className="w-3 h-3" />
              </span>
            )}
          </Button>
        </div>
        <BubbleSelect
          options={MISSING_STRATEGY_OPTIONS}
          selected={missingStrategy}
          onSelect={setMissingStrategy}
          layout="grid"
          columns={2}
          fullWidth
        />

        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-medium text-slate-300">How should we handle target outliers?</label>
          <Button
            size="icon"
            variant="secondary"
            disabled={aiBusyKey !== null}
            aria-label="Ask Predict Pal about outlier options"
            title="Ask Predict Pal"
            onClick={() =>
              askPredictPalForChoice({
                key: "outlier",
                topic: "target outlier handling",
                options: OUTLIER_STRATEGY_OPTIONS.map((o) => ({ id: o.id, label: o.label })),
                currentValue: normalizedOutlierStrategy,
                applyRecommendation: setOutlierStrategy,
              })
            }
          >
            {aiBusyKey === "outlier" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <span className="inline-flex items-center gap-0.5 leading-none">
                <span className="text-[11px]">🤖</span>
                <MessageSquare className="w-3 h-3" />
              </span>
            )}
          </Button>
        </div>
        <BubbleSelect
          options={OUTLIER_STRATEGY_OPTIONS}
          selected={normalizedOutlierStrategy || "keep"}
          onSelect={setOutlierStrategy}
          layout="grid"
          columns={3}
          fullWidth
        />

        {missingStrategy === "value" && (
          <Input
            type="number"
            label="Custom Fill Number"
            placeholder="e.g. 0"
            value={missingFillValue}
            onChange={(e) => setMissingFillValue(e.target.value)}
          />
        )}
      </div>

      {driverFiles.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-teal-300" />
            Clean and Prepare Driver Data
          </h3>

          {driverFiles.map((file) => {
            const driverFrequencyValue = getDriverSetting(
              file.fileName,
              "frequency",
              driverFrequency || "auto"
            );
            const driverMissingValue = getDriverSetting(file.fileName, "missingStrategy", "median");
            const driverOutlierValue = getDriverSetting(
              file.fileName,
              "outlierStrategy",
              normalizedDriverOutlierStrategy || "keep"
            );

            return (
              <div
                key={file.fileName}
                className="rounded-xl border border-slate-800/60 bg-slate-950/40 p-4 space-y-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-white">{file.fileName}</p>
                    <p className="text-xs text-slate-400">{file.rowCount.toLocaleString()} rows</p>
                  </div>
                </div>

                <BubbleSelect
                  label="Driver frequency"
                  options={DRIVER_FREQUENCY_OPTIONS}
                  selected={driverFrequencyValue}
                  onSelect={(value) => {
                    setDriverFrequency(value);
                    setDriverSetting(file.fileName, { frequency: value });
                  }}
                  layout="grid"
                  columns={3}
                  fullWidth
                />

                <BubbleSelect
                  label="Driver missing value handling"
                  options={DRIVER_MISSING_STRATEGY_OPTIONS}
                  selected={driverMissingValue}
                  onSelect={(value) =>
                    setDriverSetting(file.fileName, { missingStrategy: value })
                  }
                  layout="grid"
                  columns={2}
                  fullWidth
                />

                <BubbleSelect
                  label="Driver outlier handling"
                  options={OUTLIER_STRATEGY_OPTIONS}
                  selected={driverOutlierValue}
                  onSelect={(value) => {
                    setDriverOutlierStrategy(value);
                    setDriverSetting(file.fileName, { outlierStrategy: value });
                  }}
                  layout="grid"
                  columns={3}
                  fullWidth
                />
              </div>
            );
          })}
        </div>
      )}

      {processError && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {processError}
        </div>
      )}

      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={prevStep} size="lg">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={handleContinue} disabled={!canContinue} size="lg">
          Continue to Model Training
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
