"use client";

import { useState } from "react";
import { useBuildStore } from "@/lib/store";
import { trainModel } from "@/lib/api";
import { BubbleSelect, Toggle, Button } from "@/components/ui";
import {
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

const BASELINE_OPTIONS = [
  {
    id: "lagged_ridge",
    label: "Lagged Ridge",
    icon: "🏔️",
    description: "Lag features with ridge regression",
  },
  {
    id: "seasonal_naive",
    label: "Seasonal Naive",
    icon: "🧭",
    description: "Repeats seasonal pattern",
  },
];

const MV_MODEL_OPTIONS = [
  {
    id: "gbm",
    label: "Gradient Boosted Machines (GBM)",
    icon: "🌲",
    description: "Tree boosting with strong baselines",
  },
  {
    id: "xgb",
    label: "XGBoost",
    icon: "🚀",
    description: "Extreme gradient boosting",
  },
];

const LAG_CONFIG_OPTIONS = [
  {
    id: "1,2,4",
    label: "Fast [1, 2, 4]",
    icon: "⚡",
    description: "Quick baseline with a few lags",
  },
  {
    id: "auto",
    label: "Auto-select",
    icon: "🪄",
    description: "Magic pick from the preset grid",
  },
  {
    id: "1,2,3,4",
    label: "Dense Short [1, 2, 3, 4]",
    icon: "🧩",
    description: "Short-term dynamics",
  },
  {
    id: "1,3,6",
    label: "Sparser [1, 3, 6]",
    icon: "🪶",
    description: "More spaced signals",
  },
];

const TEST_WINDOW_OPTIONS = [
  { id: "24", label: "24 weeks", icon: "🕒" },
  { id: "36", label: "36 weeks", icon: "🗓️" },
  { id: "48", label: "48 weeks", icon: "📅" },
];

const VALIDATION_OPTIONS = [
  {
    id: "walk_forward",
    label: "Walk-forward",
    icon: "🔁",
    description: "Rolling origin evaluation",
  },
  {
    id: "single_split",
    label: "Single split",
    icon: "🎯",
    description: "One holdout window",
  },
];

const HORIZON_OPTIONS = [
  { id: "4", label: "4 weeks", icon: "🟢" },
  { id: "8", label: "8 weeks", icon: "🟡" },
  { id: "12", label: "12 weeks", icon: "🟠" },
];

export default function Step3TrainForecast() {
  const {
    projectId,
    dateCol,
    detectedDateCol,
    targetCol,
    numericColumns,
    selectedDrivers,
    toggleDriver,
    calendarFeatures,
    setCalendarFeatures,
    holidayFeatures,
    setHolidayFeatures,
    horizon,
    setHorizon,
    testWindowWeeks,
    setTestWindowWeeks,
    validationMode,
    setValidationMode,
    lagConfig,
    setLagConfig,
    autoSelectLags,
    setAutoSelectLags,
    baselineModel,
    setBaselineModel,
    multivariateModel,
    setMultivariateModel,
    setForecastResults,
    completeStep,
    nextStep,
    prevStep,
    isLoading,
    setLoading,
    setLoadingMessage,
  } = useBuildStore();

  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  // derive driver options from numeric columns minus target
  const driverOptions = numericColumns
    .filter((c) => c !== targetCol)
    .map((c) => ({ id: c, label: c, icon: "📊" }));

  const canRun =
    (dateCol || detectedDateCol) &&
    targetCol &&
    baselineModel &&
    multivariateModel;

  const handleTrain = async () => {
    if (!canRun || !projectId) return;
    setLoading(true);
    setLoadingMessage("Training models... this may take a moment.");
    setStatus("idle");
    setErrorMsg("");

    try {
      const result = await trainModel(
        projectId,
        (dateCol || detectedDateCol)!,
        targetCol!,
        {
          drivers: selectedDrivers,
          horizon,
          baselineModel,
          multivariateModel,
          lagConfig,
          autoSelectLags,
          testWindowWeeks,
          validationMode,
          calendarFeatures,
          holidayFeatures,
        }
      );
      setForecastResults(result);
      setStatus("success");
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.detail || "Training failed.");
      setStatus("error");
    } finally {
      setLoading(false);
      setLoadingMessage("");
    }
  };

  const handleContinue = () => {
    completeStep(3);
    nextStep();
  };

  return (
    <div className="space-y-8">
      {/* Model Selection */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
        <h3 className="text-lg font-semibold text-white">Model Selection</h3>

        <BubbleSelect
          label="Baseline Model"
          options={BASELINE_OPTIONS}
          selected={baselineModel}
          onSelect={setBaselineModel}
          layout="grid"
          columns={2}
          fullWidth
        />

        <BubbleSelect
          label="Multivariate Model"
          options={MV_MODEL_OPTIONS}
          selected={multivariateModel}
          onSelect={setMultivariateModel}
          layout="grid"
          columns={2}
          fullWidth
        />
      </div>

      {/* Lag Config */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white">Lag Config</h3>
        <BubbleSelect
          label="Recommended ranges"
          options={LAG_CONFIG_OPTIONS}
          selected={autoSelectLags ? "auto" : lagConfig}
          onSelect={(value) => {
            if (value === "auto") {
              setAutoSelectLags(true);
              setLagConfig("1,2,4");
              return;
            }
            setAutoSelectLags(false);
            setLagConfig(value);
          }}
          layout="grid"
          columns={2}
          fullWidth
        />
      </div>

      {/* Drivers */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
        <h3 className="text-lg font-semibold text-white">Drivers</h3>
        {driverOptions.length > 0 ? (
          <BubbleSelect
            label="Pre-attached cleaned drivers"
            options={driverOptions}
            selected={selectedDrivers}
            onSelect={toggleDriver}
            multi
          />
        ) : (
          <p className="text-sm text-slate-400">
            No drivers detected yet. Upload drivers or proceed without them.
          </p>
        )}
        <Toggle
          checked={calendarFeatures}
          onChange={setCalendarFeatures}
          label="Calendar features"
        />
        <Toggle
          checked={holidayFeatures}
          onChange={setHolidayFeatures}
          label="Holiday features"
        />
      </div>

      {/* Test Window */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
        <h3 className="text-lg font-semibold text-white">Test Window</h3>
        <BubbleSelect
          label="Holdout length"
          options={TEST_WINDOW_OPTIONS}
          selected={String(testWindowWeeks)}
          onSelect={(value) => setTestWindowWeeks(Number(value))}
        />
        <BubbleSelect
          label="Validation mode"
          options={VALIDATION_OPTIONS}
          selected={validationMode}
          onSelect={setValidationMode}
        />
      </div>

      {/* Forecast Horizon */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <BubbleSelect
          label="Forecast horizon"
          options={HORIZON_OPTIONS}
          selected={String(horizon)}
          onSelect={(value) => setHorizon(Number(value))}
        />
      </div>

      {/* Run */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Run Training</h3>
            <p className="text-sm text-slate-400">
              This will train both baseline and multivariate models.
            </p>
          </div>
          <Button
            onClick={handleTrain}
            disabled={!canRun || isLoading}
            size="lg"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            {isLoading ? "Training..." : "Train Models"}
          </Button>
        </div>

        {status === "success" && (
          <div className="mt-4 flex items-center gap-2 text-emerald-400 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Training complete! Review results and continue.
          </div>
        )}
        {status === "error" && (
          <div className="mt-4 flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            {errorMsg}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={prevStep}>
          ← Back
        </Button>
        <Button
          onClick={handleContinue}
          disabled={status !== "success"}
          size="lg"
        >
          Continue to Outputs →
        </Button>
      </div>
    </div>
  );
}
