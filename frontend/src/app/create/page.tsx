"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useBuildStore } from "@/lib/store";
import StepProgress from "@/components/steps/StepProgress";
import Step1GetStarted from "@/components/steps/Step1GetStarted";
import Step2ProcessData from "@/components/steps/Step2ProcessData";
import Step3TrainForecast from "@/components/steps/Step3TrainForecast";
import Step4Analysis from "@/components/steps/Step4Analysis";
import Step5Showcase from "@/components/steps/Step5Showcase";
import ChatSidebar from "@/components/ChatSidebar";
import {
  Upload,
  Cpu,
  BarChart3,
  FileText,
  Trophy,
  Bug,
  X,
} from "lucide-react";

const STEPS = [
  { label: "Get Started", icon: <Upload className="w-4 h-4" /> },
  { label: "Process Data", icon: <Cpu className="w-4 h-4" /> },
  { label: "Train & Forecast", icon: <BarChart3 className="w-4 h-4" /> },
  { label: "Analysis & Results", icon: <FileText className="w-4 h-4" /> },
  { label: "Publish Story", icon: <Trophy className="w-4 h-4" /> },
];

const STEP_COMPONENTS: Record<number, React.ReactNode> = {
  1: <Step1GetStarted />,
  2: <Step2ProcessData />,
  3: <Step3TrainForecast />,
  4: <Step4Analysis />,
  5: <Step5Showcase />,
};

const CHAT_WIDTH_DEFAULT = 360;
const CHAT_WIDTH_MIN = 280;
const CHAT_WIDTH_MAX = 640;

export default function BuildPage() {
  const currentStep = useBuildStore((s) => s.currentStep);
  const completedSteps = useBuildStore((s) => s.completedSteps);
  const debugMode = useBuildStore((s) => s.debugMode);
  const toggleDebug = useBuildStore((s) => s.toggleDebug);
  const setStep = useBuildStore((s) => s.setStep);
  const [chatWidth, setChatWidth] = useState(CHAT_WIDTH_DEFAULT);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    const savedWidth = window.localStorage.getItem("forecast-buddy-chat-width");
    if (!savedWidth) return;
    const parsed = Number(savedWidth);
    if (!Number.isFinite(parsed)) return;
    setChatWidth(Math.min(CHAT_WIDTH_MAX, Math.max(CHAT_WIDTH_MIN, parsed)));
  }, []);

  useEffect(() => {
    window.localStorage.setItem("forecast-buddy-chat-width", String(chatWidth));
  }, [chatWidth]);

  const stopResize = useCallback(() => {
    isDraggingRef.current = false;
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, []);

  const onMouseMove = useCallback((event: MouseEvent) => {
    if (!isDraggingRef.current) return;
    const nextWidth = window.innerWidth - event.clientX;
    const clamped = Math.min(CHAT_WIDTH_MAX, Math.max(CHAT_WIDTH_MIN, nextWidth));
    setChatWidth(clamped);
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", stopResize);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", stopResize);
    };
  }, [onMouseMove, stopResize]);

  const startResize = useCallback(() => {
    isDraggingRef.current = true;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
  }, []);

  return (
    <div className="min-h-[calc(100vh-4rem)] flex">
      {/* Main Content */}
      <div className="flex-1 max-w-4xl mx-auto px-6 py-8">
        {/* Step Progress Bar */}
        <div className="flex items-center justify-between mb-8">
          <StepProgress
            currentStep={currentStep}
            completedSteps={completedSteps}
            steps={STEPS}
            onStepClick={setStep}
            debugMode={debugMode}
          />
          <button
            onClick={toggleDebug}
            className={`p-2 rounded-lg transition cursor-pointer ${
              debugMode
                ? "bg-amber-900/30 text-amber-400 border border-amber-800"
                : "text-slate-600 hover:text-slate-400"
            }`}
            title="Toggle debug panel"
          >
            <Bug className="w-4 h-4" />
          </button>
        </div>

        {/* Debug Panel */}
        {debugMode && <DebugPanel />}

        {/* Active Step */}
        <div className="pb-16">
          {STEP_COMPONENTS[currentStep]}
        </div>
      </div>

      {/* Chat Sidebar */}
      <div
        className="relative hidden lg:block border-l border-slate-800 bg-[#0a0e18]"
        style={{ width: `${chatWidth}px` }}
      >
        <button
          type="button"
          aria-label="Resize chat sidebar"
          onMouseDown={startResize}
          className="absolute left-0 top-0 h-full w-2 -translate-x-1/2 cursor-col-resize bg-transparent"
        >
          <span className="absolute left-1/2 top-1/2 h-12 w-1 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-700/80 transition hover:bg-teal-500" />
        </button>
        <ChatSidebar />
      </div>
    </div>
  );
}

function DebugPanel() {
  const toggleDebug = useBuildStore((s) => s.toggleDebug);
  const setStep = useBuildStore((s) => s.setStep);
  const currentStep = useBuildStore((s) => s.currentStep);
  const completedSteps = useBuildStore((s) => s.completedSteps);
  const projectId = useBuildStore((s) => s.projectId);
  const projectTitle = useBuildStore((s) => s.projectTitle);
  const useCase = useBuildStore((s) => s.useCase);
  const uploadedFiles = useBuildStore((s) => s.uploadedFiles);
  const columns = useBuildStore((s) => s.columns);
  const numericColumns = useBuildStore((s) => s.numericColumns);
  const dateCol = useBuildStore((s) => s.dateCol);
  const targetCol = useBuildStore((s) => s.targetCol);
  const frequency = useBuildStore((s) => s.frequency);
  const missingStrategy = useBuildStore((s) => s.missingStrategy);
  const outlierStrategy = useBuildStore((s) => s.outlierStrategy);
  const selectedLags = useBuildStore((s) => s.selectedLags);
  const calendarFeatures = useBuildStore((s) => s.calendarFeatures);
  const holidayFeatures = useBuildStore((s) => s.holidayFeatures);
  const lagConfig = useBuildStore((s) => s.lagConfig);
  const testWindowWeeks = useBuildStore((s) => s.testWindowWeeks);
  const validationMode = useBuildStore((s) => s.validationMode);
  const horizon = useBuildStore((s) => s.horizon);
  const baselineModel = useBuildStore((s) => s.baselineModel);
  const multivariateModel = useBuildStore((s) => s.multivariateModel);
  const autoSelectLags = useBuildStore((s) => s.autoSelectLags);
  const selectedDrivers = useBuildStore((s) => s.selectedDrivers);
  const forecastResults = useBuildStore((s) => s.forecastResults);
  const widgets = useBuildStore((s) => s.widgets);
  const tags = useBuildStore((s) => s.tags);
  const isLoading = useBuildStore((s) => s.isLoading);

  const debugData = {
    currentStep,
    completedSteps,
    projectId,
    projectTitle,
    useCase,
    uploadedFiles,
    columns: columns.length,
    numericColumns: numericColumns.length,
    dateCol,
    targetCol,
    frequency,
    missingStrategy,
    outlierStrategy,
    selectedLags,
    calendarFeatures,
    holidayFeatures,
    lagConfig,
    testWindowWeeks,
    validationMode,
    autoSelectLags,
    horizon,
    baselineModel,
    multivariateModel,
    selectedDrivers,
    hasForecastResults: !!forecastResults,
    widgetCount: widgets.length,
    tags,
    isLoading,
  };

  return (
    <div className="mb-6 rounded-2xl border border-amber-800/60 bg-amber-950/20 p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-amber-400 flex items-center gap-2">
          <Bug className="w-4 h-4" /> Debug State
        </span>
        <button
          onClick={toggleDebug}
          className="text-amber-600 hover:text-amber-400 transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Quick step jump */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-amber-500 mr-1">Jump to:</span>
        {[1, 2, 3, 4, 5].map((s) => (
          <button
            key={s}
            onClick={() => setStep(s)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
              currentStep === s
                ? "bg-amber-500 text-black"
                : "bg-amber-900/40 text-amber-400 hover:bg-amber-800/60 border border-amber-800/50"
            }`}
          >
            Step {s}
          </button>
        ))}
      </div>

      <pre className="text-xs text-amber-300/80 overflow-x-auto max-h-60 overflow-y-auto scrollbar-thin">
        {JSON.stringify(debugData, null, 2)}
      </pre>
    </div>
  );
}
