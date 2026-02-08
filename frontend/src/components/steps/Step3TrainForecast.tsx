"use client";

import { useEffect, useMemo, useState } from "react";
import { useBuildStore } from "@/lib/store";
import { trainModel } from "@/lib/api";
import { BubbleSelect, Toggle, Button, Slider } from "@/components/ui";
import { trainModel, sendChatMessage } from "@/lib/api";
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
  MessageSquare,
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

export default function Step3TrainForecast() {
  const {
    projectId,
    dateCol,
    detectedDateCol,
    targetCol,
    frequency,
    rowCount,
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
    chatMessages,
    addChatMessage,
  } = useBuildStore();

  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [trainProgress, setTrainProgress] = useState(0);
  const [aiBusyKey, setAiBusyKey] = useState<string | null>(null);

  const periodLabel = frequency === "MS" ? "months" : frequency === "D" ? "days" : "periods";
  const monthlyMode = frequency === "MS";
  const defaultAutoLagConfig = monthlyMode ? "1,2,3,6,12" : "1,2,4";
  const lagConfigOptions = useMemo(
    () =>
      monthlyMode
        ? [
            {
              id: "1,2,3,6,12",
              label: "Monthly Core [1, 2, 3, 6, 12]",
              icon: <TrendingUp className="w-4 h-4" />,
              description: "Short + seasonal monthly lags",
            },
            {
              id: "auto",
              label: "Auto-select",
              icon: <Sparkles className="w-4 h-4" />,
              description: "Pick from monthly preset lag grid",
            },
            {
              id: "1,2,3,4,6,12",
              label: "Dense Monthly [1, 2, 3, 4, 6, 12]",
              icon: <BarChart3 className="w-4 h-4" />,
              description: "Adds richer short-term monthly dynamics",
            },
            {
              id: "1,3,6,12,24",
              label: "Long Seasonal [1, 3, 6, 12, 24]",
              icon: <Hash className="w-4 h-4" />,
              description: "Emphasizes annual and longer cycles",
            },
          ]
        : [
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
          ],
    [monthlyMode]
  );
  const holdoutMin = useMemo(() => {
    if (!rowCount || rowCount <= 1) return 6;
    return Math.max(3, Math.min(12, Math.floor(rowCount * 0.1)));
  }, [rowCount]);
  const holdoutMax = useMemo(() => {
    if (!rowCount || rowCount <= 1) return 48;
    return Math.max(holdoutMin, Math.min(72, rowCount - 1, Math.floor(rowCount * 0.4)));
  }, [rowCount, holdoutMin]);
  const holdoutMarks = useMemo(
    () =>
      holdoutMax > holdoutMin
        ? [holdoutMin, Math.round((holdoutMin + holdoutMax) / 2), holdoutMax]
        : [holdoutMin],
    [holdoutMax, holdoutMin]
  );
  const horizonMin = 1;
  const horizonMax = useMemo(() => {
    return 48;
  }, []);
  const horizonMarks = useMemo(
    () => [horizonMin, Math.round((horizonMin + horizonMax) / 2), horizonMax],
    [horizonMax]
  );

  useEffect(() => {
    if (testWindowWeeks < holdoutMin) {
      setTestWindowWeeks(holdoutMin);
      return;
    }
    if (testWindowWeeks > holdoutMax) {
      setTestWindowWeeks(holdoutMax);
    }
  }, [testWindowWeeks, holdoutMin, holdoutMax, setTestWindowWeeks]);

  useEffect(() => {
    if (horizon < horizonMin) {
      setHorizon(horizonMin);
      return;
    }
    if (horizon > horizonMax) {
      setHorizon(horizonMax);
    }
  }, [horizon, horizonMin, horizonMax, setHorizon]);

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
        frequency: frequency || "W",
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
      `Can you explain these ${args.topic} options and suggest the best one for my current setup?`,
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
      content: `Can you explain these ${args.topic} options and suggest the best one for my current setup?`,
    });

    try {
      const response = await sendChatMessage({
        project_id: projectId || "demo",
        message: internalPrompt,
        page_context: [
          "Page: Train & Forecast (Step 3).",
          `Baseline model: ${baselineModel || "not selected"}.`,
          `Multivariate model: ${multivariateModel || "not selected"}.`,
          `Lag config: ${autoSelectLags ? "auto" : lagConfig}.`,
          `Validation mode: ${validationMode || "not selected"}.`,
          `Test window weeks: ${testWindowWeeks}.`,
          `Horizon: ${horizon}.`,
          `Selected drivers: ${selectedDrivers.join(", ") || "none"}.`,
          `Calendar features: ${calendarFeatures ? "on" : "off"}. Holiday features: ${holidayFeatures ? "on" : "off"}.`,
        ].join(" "),
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

        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-medium text-slate-300">Baseline Model</label>
          <Button
            size="icon"
            variant="secondary"
            disabled={aiBusyKey !== null}
            aria-label="Ask Predict Pal about baseline model options"
            title="Ask Predict Pal"
            onClick={() =>
              askPredictPalForChoice({
                key: "baseline",
                topic: "baseline model",
                options: BASELINE_OPTIONS.map((o) => ({ id: o.id, label: o.label })),
                currentValue: baselineModel,
                applyRecommendation: setBaselineModel,
              })
            }
          >
            {aiBusyKey === "baseline" ? (
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
          options={BASELINE_OPTIONS}
          selected={baselineModel}
          onSelect={setBaselineModel}
          layout="grid"
          columns={2}
          fullWidth
        />

        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-medium text-slate-300">Multivariate Model</label>
          <Button
            size="icon"
            variant="secondary"
            disabled={aiBusyKey !== null}
            aria-label="Ask Predict Pal about multivariate model options"
            title="Ask Predict Pal"
            onClick={() =>
              askPredictPalForChoice({
                key: "multivariate",
                topic: "multivariate model",
                options: MV_MODEL_OPTIONS.map((o) => ({ id: o.id, label: o.label })),
                currentValue: multivariateModel,
                applyRecommendation: setMultivariateModel,
              })
            }
          >
            {aiBusyKey === "multivariate" ? (
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
        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-medium text-slate-300">Recommended ranges</label>
          <Button
            size="icon"
            variant="secondary"
            disabled={aiBusyKey !== null}
            aria-label="Ask Predict Pal about lag settings"
            title="Ask Predict Pal"
            onClick={() =>
              askPredictPalForChoice({
                key: "lag-config",
                topic: "lag configuration",
                options: LAG_CONFIG_OPTIONS.map((o) => ({ id: o.id, label: o.label })),
                currentValue: autoSelectLags ? "auto" : lagConfig,
                applyRecommendation: (value) => {
                  if (value === "auto") {
                    setAutoSelectLags(true);
                    setLagConfig("1,2,4");
                    return;
                  }
                  setAutoSelectLags(false);
                  setLagConfig(value);
                },
              })
            }
          >
            {aiBusyKey === "lag-config" ? (
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
          label="Recommended ranges"
          options={lagConfigOptions}
          selected={autoSelectLags ? "auto" : lagConfig}
          onSelect={(value) => {
            if (value === "auto") {
              setAutoSelectLags(true);
              setLagConfig(defaultAutoLagConfig);
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

        <Slider
          label={`Holdout length: ${testWindowWeeks} ${periodLabel}`}
          value={testWindowWeeks}
          onChange={setTestWindowWeeks}
          min={holdoutMin}
          max={holdoutMax}
          step={1}
          marks={holdoutMarks}
        />

        <div className="flex items-center justify-between gap-3">
          <label className="text-sm font-medium text-slate-300">Validation mode</label>
          <Button
            size="icon"
            variant="secondary"
            disabled={aiBusyKey !== null}
            aria-label="Ask Predict Pal about validation mode options"
            title="Ask Predict Pal"
            onClick={() =>
              askPredictPalForChoice({
                key: "validation",
                topic: "validation mode",
                options: VALIDATION_OPTIONS.map((o) => ({ id: o.id, label: o.label })),
                currentValue: validationMode,
                applyRecommendation: setValidationMode,
              })
            }
          >
            {aiBusyKey === "validation" ? (
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
          options={VALIDATION_OPTIONS}
          selected={validationMode}
          onSelect={setValidationMode}
          layout="grid"
          columns={2}
          fullWidth
        />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
        <Slider
          label={`Forecast length: ${horizon} ${periodLabel}`}
          value={horizon}
          onChange={setHorizon}
          min={horizonMin}
          max={horizonMax}
          step={1}
          marks={horizonMarks}
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
