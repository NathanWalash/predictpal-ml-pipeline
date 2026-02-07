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
  ArrowLeft,
  ArrowRight,
  Sparkles,
  BarChart3,
  Cpu,
  Calendar,
  TrendingUp,
  Hash,
} from "lucide-react";

const BASELINE_OPTIONS = [
  {
    id: "lagged_ridge",
    label: "Lagged Ridge",
    icon: <BarChart3 className="w-4 h-4" />,
    description: "Lag features with ridge regression",
  },
  {
    id: "seasonal_naive",
    label: "Seasonal Naive",
    icon: <TrendingUp className="w-4 h-4" />,
    description: "Repeats seasonal pattern",
  },
];

const MV_MODEL_OPTIONS = [
  {
    id: "gbm",
    label: "Gradient Boosted Machines (GBM)",
    icon: <Cpu className="w-4 h-4" />,
    description: "Tree boosting with strong baselines",
  },
  {
    id: "xgb",
    label: "XGBoost",
    icon: <Cpu className="w-4 h-4" />,
    description: "Extreme gradient boosting",
  },
];

const LAG_CONFIG_OPTIONS = [
  {
    id: "1,2,4",
    label: "Fast [1, 2, 4]",
    icon: <TrendingUp className="w-4 h-4" />,
    description: "Quick baseline with a few lags",
  },
  {
    id: "auto",
    label: "Auto-select",
    icon: <Sparkles className="w-4 h-4" />,
    description: "Pick from the preset lag grid",
  },
  {
    id: "1,2,3,4",
    label: "Dense Short [1, 2, 3, 4]",
    icon: <BarChart3 className="w-4 h-4" />,
    description: "Short-term dynamics",
  },
  {
    id: "1,3,6",
    label: "Sparser [1, 3, 6]",
    icon: <Hash className="w-4 h-4" />,
    description: "More spaced signals",
  },
];

const TEST_WINDOW_OPTIONS = [
  { id: "24", label: "24 weeks", icon: <Calendar className="w-4 h-4" /> },
  { id: "36", label: "36 weeks", icon: <Calendar className="w-4 h-4" /> },
  { id: "48", label: "48 weeks", icon: <Calendar className="w-4 h-4" /> },
];

const VALIDATION_OPTIONS = [
  {
    id: "walk_forward",
    label: "Walk-forward",
    icon: <TrendingUp className="w-4 h-4" />,
    description: "Rolling origin evaluation",
  },
  {
    id: "single_split",
    label: "Single split",
    icon: <BarChart3 className="w-4 h-4" />,
    description: "One holdout window",
  },
];

const HORIZON_OPTIONS = [
  { id: "4", label: "4 weeks", icon: <Calendar className="w-4 h-4" /> },
  { id: "8", label: "8 weeks", icon: <Calendar className="w-4 h-4" /> },
  { id: "12", label: "12 weeks", icon: <Calendar className="w-4 h-4" /> },
];

export default function Step3TrainForecast() {
  const {
    projectId,
    dateCol,
    detectedDateCol,
    targetCol,
    driverFiles,
    driverNumericColumns,
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
  const [trainProgress, setTrainProgress] = useState(0);

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
    return "Training failed.";
  };

  const canRun =
    (dateCol || detectedDateCol) &&
    targetCol &&
    baselineModel &&
    multivariateModel;

  const handleTrain = async () => {
    if (!canRun || !projectId) return;
    setTrainProgress(8);
    setLoading(true);
    setLoadingMessage("Training models... this may take a moment.");
    setStatus("idle");
    setErrorMsg("");
    const progressTimer = window.setInterval(() => {
      setTrainProgress((prev) => (prev >= 92 ? prev : prev + 3));
    }, 350);

    try {
      const result = await trainModel(projectId, (dateCol || detectedDateCol)!, targetCol!, {
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
      });
      setTrainProgress(100);
      setForecastResults(result);
      setStatus("success");
    } catch (err: unknown) {
      setErrorMsg(getApiErrorMessage(err));
      setStatus("error");
    } finally {
      window.clearInterval(progressTimer);
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
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900/80 to-slate-800/40 p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-teal-500/10 p-2 text-teal-300">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-white">Step 3: Train and Forecast</h2>
            <p className="text-sm text-slate-400">
              Pick your model settings, train the models, and generate forecasts.
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Cpu className="w-5 h-5 text-teal-300" />
          Choose Models
        </h3>

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

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-teal-300" />
          Lag Settings
        </h3>
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

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-teal-300" />
          Optional Drivers
        </h3>
        {driverFiles.length > 0 ? (
          <>
            <p className="text-sm text-slate-400">
              Driver source{driverFiles.length !== 1 ? "s" : ""}:{" "}
              <span className="text-slate-300">
                {driverFiles.map((f) => f.fileName).join(", ")}
              </span>
            </p>
            {driverNumericColumns.length > 0 ? (
              <BubbleSelect
                label="Select driver columns"
                options={driverNumericColumns.map((c) => ({
                  id: c,
                  label: c,
                  icon: <BarChart3 className="w-4 h-4" />,
                }))}
                selected={selectedDrivers}
                onSelect={toggleDriver}
                multi
                layout="grid"
                columns={2}
                fullWidth
              />
            ) : (
              <p className="text-sm text-slate-400">
                No numeric drivers available after processing.
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-400">
            No driver file was uploaded, so training will use only your main dataset.
          </p>
        )}

        <div className="flex flex-wrap gap-6">
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
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Calendar className="w-5 h-5 text-teal-300" />
          Test Settings
        </h3>

        <BubbleSelect
          label="Holdout length"
          options={TEST_WINDOW_OPTIONS}
          selected={String(testWindowWeeks)}
          onSelect={(value) => setTestWindowWeeks(Number(value))}
          layout="grid"
          columns={3}
          fullWidth
        />

        <BubbleSelect
          label="Validation mode"
          options={VALIDATION_OPTIONS}
          selected={validationMode}
          onSelect={setValidationMode}
          layout="grid"
          columns={2}
          fullWidth
        />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <BubbleSelect
          label="Forecast length"
          options={HORIZON_OPTIONS}
          selected={String(horizon)}
          onSelect={(value) => setHorizon(Number(value))}
          layout="grid"
          columns={3}
          fullWidth
        />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white">Run Training</h3>
            <p className="text-sm text-slate-400">
              Click train to run both models with your selected settings.
            </p>
          </div>
          <Button onClick={handleTrain} disabled={!canRun || isLoading} size="lg">
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <Play className="w-4 h-4 mr-2" />
            )}
            {isLoading ? "Training..." : "Train Models"}
          </Button>
        </div>
        {isLoading && (
          <div className="mt-4">
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
              <div
                className="h-full rounded-full bg-gradient-to-r from-teal-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${trainProgress}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-400">{trainProgress}% complete</p>
          </div>
        )}

        {status === "success" && (
          <div className="mt-4 flex items-center gap-2 text-emerald-400 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Training finished. You can now continue to Analysis and Results.
          </div>
        )}

        {status === "error" && (
          <div className="mt-4 flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            {errorMsg}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <Button variant="secondary" onClick={prevStep} size="lg">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back
        </Button>
        <Button onClick={handleContinue} disabled={status !== "success"} size="lg">
          Continue to Analysis & Results
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
