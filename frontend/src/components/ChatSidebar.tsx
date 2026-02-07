"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { ReactNode } from "react";
import { useBuildStore } from "@/lib/store";
import { sendChatMessage } from "@/lib/api";
import { Button } from "@/components/ui";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";

const USE_CASE_LABELS: Record<string, string> = {
  retail: "Retail & Sales",
  energy: "Energy & Utilities",
  healthcare: "Healthcare",
  finance: "Finance",
  "supply-chain": "Supply Chain",
  other: "Other",
};

const FREQUENCY_LABELS: Record<string, string> = {
  D: "Daily",
  W: "Weekly",
  MS: "Monthly",
  QS: "Quarterly",
  YS: "Yearly",
};

const MISSING_STRATEGY_LABELS: Record<string, string> = {
  ffill: "Forward Fill",
  bfill: "Backward Fill",
  interpolate: "Interpolate",
  drop: "Drop Rows",
  mean: "Mean Fill",
  median: "Median Fill",
  value: "Custom Value",
};

const OUTLIER_STRATEGY_LABELS: Record<string, string> = {
  cap: "Clip (IQR)",
  remove: "Remove",
  keep: "Keep All",
};

const BASELINE_MODEL_LABELS: Record<string, string> = {
  lagged_ridge: "Lagged Ridge",
  seasonal_naive: "Seasonal Naive",
};

const MULTIVARIATE_MODEL_LABELS: Record<string, string> = {
  gbm: "Gradient Boosted Machines (GBM)",
  xgb: "XGBoost",
};

const VALIDATION_LABELS: Record<string, string> = {
  walk_forward: "Walk-forward",
  single_split: "Single split",
};

function asLabel(value: string, lookup: Record<string, string>): string {
  return lookup[value] || value;
}

function usePageContext(): string {
  const currentStep = useBuildStore((s) => s.currentStep);
  const projectTitle = useBuildStore((s) => s.projectTitle);
  const projectDescription = useBuildStore((s) => s.projectDescription);
  const useCase = useBuildStore((s) => s.useCase);
  const columns = useBuildStore((s) => s.columns);
  const numericColumns = useBuildStore((s) => s.numericColumns);
  const rowCount = useBuildStore((s) => s.rowCount);
  const detectedDateCol = useBuildStore((s) => s.detectedDateCol);
  const dateCol = useBuildStore((s) => s.dateCol);
  const targetCol = useBuildStore((s) => s.targetCol);
  const frequency = useBuildStore((s) => s.frequency);
  const missingStrategy = useBuildStore((s) => s.missingStrategy);
  const missingFillValue = useBuildStore((s) => s.missingFillValue);
  const outlierStrategy = useBuildStore((s) => s.outlierStrategy);
  const driverOutlierStrategy = useBuildStore((s) => s.driverOutlierStrategy);
  const horizon = useBuildStore((s) => s.horizon);
  const lagConfig = useBuildStore((s) => s.lagConfig);
  const autoSelectLags = useBuildStore((s) => s.autoSelectLags);
  const testWindowWeeks = useBuildStore((s) => s.testWindowWeeks);
  const validationMode = useBuildStore((s) => s.validationMode);
  const calendarFeatures = useBuildStore((s) => s.calendarFeatures);
  const holidayFeatures = useBuildStore((s) => s.holidayFeatures);
  const baselineModel = useBuildStore((s) => s.baselineModel);
  const multivariateModel = useBuildStore((s) => s.multivariateModel);
  const selectedDrivers = useBuildStore((s) => s.selectedDrivers);
  const uploadedFiles = useBuildStore((s) => s.uploadedFiles);
  const driverFileName = useBuildStore((s) => s.driverFileName);
  const driverNumericColumns = useBuildStore((s) => s.driverNumericColumns);
  const widgets = useBuildStore((s) => s.widgets);
  const summary = useBuildStore((s) => s.summary);
  const tags = useBuildStore((s) => s.tags);
  const forecastResults = useBuildStore((s) => s.forecastResults);
  const modelMetrics = forecastResults?.metrics || {};
  const rmseImprovement = modelMetrics.improvement_pct;

  switch (currentStep) {
    case 1:
      return [
        "Page: Get Started (Step 1).",
        "The user is setting up project details and uploading main/driver data.",
        projectTitle ? `Project title: ${projectTitle}.` : "Project title not set yet.",
        projectDescription ? `Project description: ${projectDescription}.` : "",
        useCase
          ? `Use case selected: ${asLabel(useCase, USE_CASE_LABELS)} (${useCase}).`
          : "Use case not selected yet.",
        uploadedFiles.length
          ? `Uploaded file(s): ${uploadedFiles.join(", ")}.`
          : "No file uploaded yet.",
        rowCount ? `Main dataset has ${rowCount} rows and ${columns.length} columns.` : "",
        detectedDateCol ? `Detected date column in main data: ${detectedDateCol}.` : "",
        numericColumns.length
          ? `Main numeric columns detected: ${numericColumns.join(", ")}.`
          : "",
        driverFileName
          ? `Driver file loaded: ${driverFileName} with ${driverNumericColumns.length} numeric column(s).`
          : "No driver file loaded yet (optional in this step).",
        "Step 1 options shown to user: use-case bubbles and file upload zones for main data plus optional driver data.",
        "Guide the user on required file structure, useful driver data, and what to do before moving to Step 2.",
      ]
        .filter(Boolean)
        .join(" ");
    case 2:
      return [
        "Page: Process Data (Step 2).",
        "The user is configuring cleaning and preprocessing settings.",
        "Only reference Step 2 options that exist in this exact UI. Do not mention old or alternative option names.",
        "Valid frequency options: Daily (D), Weekly (W), Monthly (MS), Quarterly (QS), Yearly (YS).",
        "Valid missing strategy options: Forward Fill (ffill), Backward Fill (bfill), Interpolate (interpolate), Drop Rows (drop), Mean Fill (mean), Median Fill (median), Custom Value (value).",
        "Valid outlier options for both target and drivers: Clip (IQR) (cap), Remove (remove), Keep All (keep).",
        dateCol
          ? `Date column selected: ${dateCol}.`
          : detectedDateCol
            ? `Date column not manually selected yet; detected date column is ${detectedDateCol}.`
            : "No date column selected yet.",
        targetCol ? `Target column: ${targetCol}.` : "No target column selected yet.",
        frequency ? `Frequency selected: ${asLabel(frequency, FREQUENCY_LABELS)} (${frequency}).` : "Frequency not selected yet.",
        missingStrategy
          ? `Missing strategy selected: ${asLabel(missingStrategy, MISSING_STRATEGY_LABELS)} (${missingStrategy}).`
          : "Missing strategy not selected yet.",
        missingStrategy === "value" && missingFillValue
          ? `Custom missing fill value: ${missingFillValue}.`
          : "",
        outlierStrategy
          ? `Target outlier strategy: ${asLabel(outlierStrategy, OUTLIER_STRATEGY_LABELS)} (${outlierStrategy}).`
          : "",
        driverOutlierStrategy
          ? `Driver outlier strategy: ${asLabel(driverOutlierStrategy, OUTLIER_STRATEGY_LABELS)} (${driverOutlierStrategy}).`
          : "",
        `Current selection summary: frequency=${frequency || "not selected"}, missing=${missingStrategy || "not selected"}, target_outlier=${outlierStrategy || "not selected"}, driver_outlier=${driverOutlierStrategy || "not selected"}.`,
        "Step 2 options shown to user: date/target column selectors, frequency, missing strategy, target outlier strategy, and driver outlier strategy.",
        "Guide the user on practical tradeoffs for each processing choice based on their dataset.",
      ]
        .filter(Boolean)
        .join(" ");
    case 3:
      return [
        "Page: Train & Forecast (Step 3).",
        "The user is selecting model/training settings and running training.",
        baselineModel
          ? `Baseline model selected: ${asLabel(baselineModel, BASELINE_MODEL_LABELS)} (${baselineModel}).`
          : "",
        multivariateModel
          ? `Multivariate model selected: ${asLabel(multivariateModel, MULTIVARIATE_MODEL_LABELS)} (${multivariateModel}).`
          : "",
        `Forecast horizon selected: ${horizon} week(s).`,
        `Lag configuration: ${autoSelectLags ? "Auto-select enabled" : `Manual preset ${lagConfig}`}.`,
        `Test window: ${testWindowWeeks} week(s).`,
        `Validation mode: ${asLabel(validationMode, VALIDATION_LABELS)} (${validationMode}).`,
        `Calendar features: ${calendarFeatures ? "Enabled" : "Disabled"}.`,
        `Holiday features: ${holidayFeatures ? "Enabled" : "Disabled"}.`,
        driverFileName
          ? `Driver file in use: ${driverFileName}. Available numeric drivers: ${driverNumericColumns.join(", ") || "none"}.`
          : "No driver file uploaded, so training can run target-only.",
        selectedDrivers.length
          ? `Selected drivers: ${selectedDrivers.join(", ")}.`
          : "No drivers selected.",
        forecastResults
          ? `Training has been run and results are available.${typeof rmseImprovement === "number" ? ` Reported improvement: ${rmseImprovement.toFixed(2)}%.` : ""}`
          : "Forecast has not been run yet.",
        "Step 3 options shown to user: model choices, lag config, driver selection, calendar/holiday toggles, test window, validation mode, and forecast horizon.",
        "Help compare model settings and explain why the current setup may help or hurt performance.",
      ]
        .filter(Boolean)
        .join(" ");
    case 4:
      return [
        "Page: Analysis & Results (Step 4).",
        "The user is reviewing a guided analysis flow with model quality first, then future forecast outputs.",
        "Step 4 includes fixed sections: Run Summary, Model Metrics, Test Fit, Future Forecast, Feature Importance, Error Trend, Driver Signals, and Forecast Table.",
        widgets.length
          ? `Widgets prepared for Step 5: ${widgets.map((w) => w.type).join(", ")}.`
          : "",
        forecastResults
          ? `Forecast results are available from Step 3 with horizon ${forecastResults.horizon} and drivers ${forecastResults.drivers_used?.join(", ") || "none"}.`
          : "No forecast results yet.",
        "Help interpret model metrics, test-fit behavior, forecast trends, and driver importance in plain language.",
      ]
        .filter(Boolean)
        .join(" ");
    case 5:
      return [
        "Page: Publish Story (Step 5).",
        "The user is composing a notebook-style story and publishing to Explore.",
        projectTitle ? `Project title: ${projectTitle}.` : "",
        summary ? `Story description/summary: ${summary}.` : "Story description has not been written yet.",
        tags.length ? `Selected categories/tags: ${tags.join(", ")}.` : "No categories selected yet.",
        widgets.length ? `Available analysis sections from Step 4: ${widgets.map((w) => w.title).join(", ")}.` : "",
        "Step 5 flow has three stages: Start Prompt, Notebook Builder, Preview & Publish.",
        "Help the user write clearer narrative text, choose useful sections, and prepare an accurate publish-ready summary.",
      ].join(" ");
    default:
      return "The user is using the Predict Pal no-code ML tool.";
  }
}

function useReportData(): string | null {
  const currentStep = useBuildStore((s) => s.currentStep);
  const forecastResults = useBuildStore((s) => s.forecastResults);
  const widgets = useBuildStore((s) => s.widgets);
  const summary = useBuildStore((s) => s.summary);
  const tags = useBuildStore((s) => s.tags);
  const baselineModel = useBuildStore((s) => s.baselineModel);
  const multivariateModel = useBuildStore((s) => s.multivariateModel);
  const horizon = useBuildStore((s) => s.horizon);
  const selectedDrivers = useBuildStore((s) => s.selectedDrivers);
  const lagConfig = useBuildStore((s) => s.lagConfig);
  const testWindowWeeks = useBuildStore((s) => s.testWindowWeeks);
  const validationMode = useBuildStore((s) => s.validationMode);

  const hasContextPayload =
    !!forecastResults || widgets.length > 0 || !!summary || tags.length > 0;
  if (!hasContextPayload) return null;

  const payload = {
    step: currentStep,
    forecast_results: forecastResults || null,
    story_context: {
      summary,
      tags,
      widgets,
    },
    training_context: {
      horizon,
      baseline_model: baselineModel,
      multivariate_model: multivariateModel,
      selected_drivers: selectedDrivers,
      lag_config: lagConfig,
      test_window_weeks: testWindowWeeks,
      validation_mode: validationMode,
    },
  };

  try {
    return JSON.stringify(payload);
  } catch {
    return null;
  }
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const normalized = text
    // Gemini sometimes escapes markdown markers.
    .replace(/\\\*/g, "*")
    .replace(/\\_/g, "_")
    .replace(/\\`/g, "`");

  return normalized
    .split(/(\*\*.+?\*\*)/g)
    .filter(Boolean)
    .map((part, index) => {
      const boldMatch = part.match(/^\*\*(.+?)\*\*$/);
      if (boldMatch) {
        return <strong key={index}>{boldMatch[1]}</strong>;
      }
      return <span key={index}>{part}</span>;
    });
}

function renderMessageContent(content: string): ReactNode {
  const lines = content.split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const current = lines[i];

    if (/^[-*]\s+/.test(current)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ul key={`ul-${i}`} className="list-disc pl-5 space-y-1">
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineMarkdown(item)}</li>
          ))}
        </ul>
      );
      continue;
    }

    if (/^\d+\.\s+/.test(current)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+\.\s+/, ""));
        i += 1;
      }
      blocks.push(
        <ol key={`ol-${i}`} className="list-decimal pl-5 space-y-1">
          {items.map((item, idx) => (
            <li key={idx}>{renderInlineMarkdown(item)}</li>
          ))}
        </ol>
      );
      continue;
    }

    if (!current.trim()) {
      blocks.push(<div key={`sp-${i}`} className="h-2" />);
      i += 1;
      continue;
    }

    blocks.push(
      <p key={`p-${i}`} className="whitespace-pre-wrap">
        {renderInlineMarkdown(current)}
      </p>
    );
    i += 1;
  }

  return <div className="space-y-2">{blocks}</div>;
}

export default function ChatSidebar() {
  const chatMessages = useBuildStore((s) => s.chatMessages);
  const addChatMessage = useBuildStore((s) => s.addChatMessage);
  const projectId = useBuildStore((s) => s.projectId);

  const pageContext = usePageContext();
  const reportData = useReportData();

  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleSend = useCallback(async () => {
    if (!input.trim()) return;

    const userMsg = input.trim();
    setInput("");
    addChatMessage({ role: "user", content: userMsg });
    setIsSending(true);

    try {
      const history = chatMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const response = await sendChatMessage({
        project_id: projectId || "demo",
        message: userMsg,
        page_context: pageContext,
        history,
        report_data: reportData,
      });

      addChatMessage(response);
    } catch {
      addChatMessage({
        role: "assistant",
        content:
          "Sorry, I couldn't connect to the server. Make sure the backend is running on port 8000.",
      });
    } finally {
      setIsSending(false);
    }
  }, [input, chatMessages, projectId, pageContext, reportData, addChatMessage]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-slate-800 p-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-teal-800 bg-teal-900/50">
          <span className="text-sm">🤖</span>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-white">Predict Pal</h3>
          <p className="text-xs text-teal-500">Online</p>
        </div>
      </div>

      <div className="scrollbar-thin flex-1 min-h-0 space-y-3 overflow-y-auto p-4">
        {chatMessages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[90%] rounded-2xl px-4 py-2.5 text-sm",
              msg.role === "user"
                ? "ml-auto rounded-br-md bg-teal-600 text-white"
                : "rounded-bl-md border border-slate-700 bg-slate-800 text-slate-300"
            )}
          >
            {renderMessageContent(msg.content)}
          </div>
        ))}

        {isSending && (
          <div className="max-w-[90%] rounded-2xl rounded-bl-md border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-slate-500">
            <span className="animate-pulse">Thinking...</span>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="border-t border-slate-800 p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
            placeholder="Ask the Buddy..."
            className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || isSending}
          >
            <Send size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}

