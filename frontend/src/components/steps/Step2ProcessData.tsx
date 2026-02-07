"use client";

import { useBuildStore } from "@/lib/store";
import { BubbleSelect, Toggle, Button, Input } from "@/components/ui";

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

const LAG_OPTIONS = [
  { id: "1", label: "t-1", description: "One step back" },
  { id: "7", label: "t-7", description: "One week" },
  { id: "14", label: "t-14", description: "Two weeks" },
  { id: "30", label: "t-30", description: "One month" },
  { id: "90", label: "t-90", description: "One quarter" },
  { id: "365", label: "t-365", description: "One year" },
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
    selectedLags,
    toggleLag,
    calendarFeatures,
    setCalendarFeatures,
    completeStep,
    nextStep,
    prevStep,
  } = useBuildStore();

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

  const canContinue =
    (dateCol || detectedDateCol) && targetCol && frequency && missingStrategy;

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

  const handleContinue = () => {
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

      {/* Feature Engineering */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
        <h3 className="text-lg font-semibold text-white">Feature Engineering</h3>

        <BubbleSelect
          label="Lag Features"
          options={LAG_OPTIONS}
          selected={selectedLags}
          onSelect={toggleLag}
          multi
        />

        <Toggle
          checked={calendarFeatures}
          onChange={setCalendarFeatures}
          label="Add calendar features (day-of-week, month, quarter, etc.)"
        />
      </div>

      {/* Navigation */}
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
