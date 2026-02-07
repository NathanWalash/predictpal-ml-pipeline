"use client";

import { useState } from "react";
import { useBuildStore } from "@/lib/store";
import { processData } from "@/lib/api";
import { BubbleSelect, Button, Input } from "@/components/ui";

const FREQUENCY_OPTIONS = [
  { id: "D", label: "Daily", icon: "📅" },
  { id: "W", label: "Weekly", icon: "🗓️" },
  { id: "MS", label: "Monthly", icon: "📆" },
  { id: "QS", label: "Quarterly", icon: "📊" },
  { id: "YS", label: "Yearly", icon: "📈" },
];

const MISSING_STRATEGY_OPTIONS = [
  { id: "ffill", label: "Forward Fill", icon: "➡️", description: "Carry last known value" },
  { id: "bfill", label: "Backward Fill", icon: "⬅️", description: "Use next known value" },
  { id: "interpolate", label: "Interpolate", icon: "📐", description: "Linear interpolation" },
  { id: "drop", label: "Drop Rows", icon: "🗑️", description: "Remove missing rows" },
  { id: "mean", label: "Mean Fill", icon: "📊", description: "Fill with column mean" },
  { id: "median", label: "Median Fill", icon: "📉", description: "Fill with column median" },
  { id: "value", label: "Custom Value", icon: "🔢", description: "Fill with a fixed value" },
];

const OUTLIER_STRATEGY_OPTIONS = [
  { id: "cap", label: "Clip (IQR)", icon: "✂️", description: "Cap at 1.5× IQR bounds" },
  { id: "remove", label: "Remove", icon: "🗑️", description: "Drop outlier rows" },
  { id: "keep", label: "Keep All", icon: "✅", description: "Don't treat outliers" },
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
    setDriverInfo,
    clearDriverInfo,
    setLoading,
    setLoadingMessage,
    driverColumns,
    driverDetectedDateCol,
    driverRowCount,
    driverPreviewData,
    driverColumnDtypes,
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
    icon: c === detectedDateCol ? "✨" : "📅",
    description: c === detectedDateCol ? "Auto-detected" : undefined,
  }));

  const targetColOptions = numericColumns.map((c) => ({
    id: c,
    label: c,
    icon: "📈",
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
        driverDateCol: driverDetectedDateCol || undefined,
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
      if (result.driver?.file_name) {
        setDriverInfo({
          fileName: result.driver.file_name,
          columns: driverColumns || [],
          numericColumns: result.driver.numeric_columns || [],
          detectedDateCol: driverDetectedDateCol || null,
          rowCount: driverRowCount || 0,
          previewData: driverPreviewData || [],
          columnDtypes: driverColumnDtypes || {},
        });
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
      {/* Column Selection */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
        <h3 className="text-lg font-semibold text-white">Column Selection</h3>

        <BubbleSelect
          label="Date Column"
          options={dateColOptions}
          selected={dateCol || detectedDateCol || ""}
          onSelect={setDateCol}
        />

        <BubbleSelect
          label="Target Column (what to forecast)"
          options={targetColOptions}
          selected={targetCol || ""}
          onSelect={setTargetCol}
        />
      </div>

      {/* Frequency & Missing Data */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
        <h3 className="text-lg font-semibold text-white">Processing Pipeline</h3>

        <BubbleSelect
          label="Data Frequency"
          options={FREQUENCY_OPTIONS}
          selected={frequency}
          onSelect={setFrequency}
        />

        <BubbleSelect
          label="Missing Data Strategy"
          options={MISSING_STRATEGY_OPTIONS}
          selected={missingStrategy}
          onSelect={setMissingStrategy}
        />

        <BubbleSelect
          label="Outlier Strategy"
          options={OUTLIER_STRATEGY_OPTIONS}
          selected={normalizedOutlierStrategy || "keep"}
          onSelect={setOutlierStrategy}
        />

        <BubbleSelect
          label="Driver Outlier Strategy"
          options={OUTLIER_STRATEGY_OPTIONS}
          selected={normalizedDriverOutlierStrategy || "keep"}
          onSelect={setDriverOutlierStrategy}
        />

        {missingStrategy === "value" && (
          <Input
            type="number"
            label="Custom Fill Value"
            placeholder="e.g. 0"
            value={missingFillValue}
            onChange={(e) => setMissingFillValue(e.target.value)}
          />
        )}
      </div>

      {/* Navigation */}
      {processError && (
        <div className="rounded-xl border border-red-900/50 bg-red-950/30 px-4 py-3 text-sm text-red-300">
          {processError}
        </div>
      )}
      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={prevStep}>
          ← Back
        </Button>
        <Button onClick={handleContinue} disabled={!canContinue} size="lg">
          Continue to Train →
        </Button>
      </div>
    </div>
  );
}
