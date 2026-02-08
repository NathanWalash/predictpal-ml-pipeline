"use client";

import { useState } from "react";
import { useBuildStore } from "@/lib/store";
import { processData } from "@/lib/api";
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
} from "lucide-react";

const FREQUENCY_OPTIONS = [
  { id: "D", label: "Daily", icon: <Calendar className="w-4 h-4" /> },
  { id: "W", label: "Weekly", icon: <Calendar className="w-4 h-4" /> },
  { id: "MS", label: "Monthly", icon: <Calendar className="w-4 h-4" /> },
  { id: "QS", label: "Quarterly", icon: <Calendar className="w-4 h-4" /> },
  { id: "YS", label: "Yearly", icon: <Calendar className="w-4 h-4" /> },
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
    detectedDateCol,
    dateCol,
    setDateCol,
    targetCol,
    setTargetCol,
    frequency,
    setFrequency,
    missingStrategy,
    setMissingStrategy,
    missingFillValue,
    setMissingFillValue,
    outlierStrategy,
    setOutlierStrategy,
    driverOutlierStrategy,
    setDriverOutlierStrategy,
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
  } = useBuildStore();

  const [processError, setProcessError] = useState("");

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
        outlierStrategy: outlierStrategy || "keep",
        driverOutlierStrategy: driverOutlierStrategy || "keep",
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
          Clean and Prepare Data
        </h3>

        <BubbleSelect
          label="How often is your data?"
          options={FREQUENCY_OPTIONS}
          selected={frequency}
          onSelect={setFrequency}
          layout="grid"
          columns={3}
          fullWidth
        />

        <BubbleSelect
          label="How should we fill missing values?"
          options={MISSING_STRATEGY_OPTIONS}
          selected={missingStrategy}
          onSelect={setMissingStrategy}
          layout="grid"
          columns={2}
          fullWidth
        />

        <BubbleSelect
          label="How should we handle outliers?"
          options={OUTLIER_STRATEGY_OPTIONS}
          selected={normalizedOutlierStrategy || "keep"}
          onSelect={setOutlierStrategy}
          layout="grid"
          columns={3}
          fullWidth
        />

        <BubbleSelect
          label="How should we handle driver outliers?"
          options={OUTLIER_STRATEGY_OPTIONS}
          selected={normalizedDriverOutlierStrategy || "keep"}
          onSelect={setDriverOutlierStrategy}
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
