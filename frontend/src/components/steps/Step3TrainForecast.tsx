"use client";

import { useState } from "react";
import { useBuildStore } from "@/lib/store";
import { trainModel } from "@/lib/api";
import { BubbleSelect, Slider, Button } from "@/components/ui";
import {
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";

const BASELINE_OPTIONS = [
  { id: "linear", label: "Linear Regression", icon: "📏", description: "Simple & fast" },
  { id: "ridge", label: "Ridge", icon: "🏔️", description: "Regularised linear" },
  { id: "lasso", label: "Lasso", icon: "🪢", description: "Sparse features" },
];

const MV_MODEL_OPTIONS = [
  {
    id: "histgb",
    label: "HistGradientBoosting",
    icon: "🌲",
    description: "Gradient-boosted trees (fast)",
  },
  {
    id: "random_forest",
    label: "Random Forest",
    icon: "🌳",
    description: "Ensemble of decision trees",
  },
  {
    id: "xgboost",
    label: "XGBoost",
    icon: "🚀",
    description: "Optimised boosting (if installed)",
  },
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
    driverOutlierStrategy,
    horizon,
    setHorizon,
    trainTestSplit,
    setTrainTestSplit,
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

  const canRun = (dateCol || detectedDateCol) && targetCol && baselineModel;

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
        selectedDrivers,
        horizon,
        driverOutlierStrategy
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
        />

        <BubbleSelect
          label="Multivariate Model"
          options={MV_MODEL_OPTIONS}
          selected={multivariateModel}
          onSelect={setMultivariateModel}
        />
      </div>

      {/* Driver Selection */}
      {driverOptions.length > 0 && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
          <BubbleSelect
            label="Exogenous Drivers (optional)"
            options={driverOptions}
            selected={selectedDrivers}
            onSelect={toggleDriver}
            multi
          />
        </div>
      )}

      {/* Parameters */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-6">
        <h3 className="text-lg font-semibold text-white">Parameters</h3>

        <Slider
          label={`Forecast Horizon: ${horizon} steps`}
          min={1}
          max={52}
          step={1}
          value={horizon}
          onChange={setHorizon}
        />

        <Slider
          label={`Train/Test Split: ${trainTestSplit}% train`}
          min={50}
          max={95}
          step={5}
          value={trainTestSplit}
          onChange={setTrainTestSplit}
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
