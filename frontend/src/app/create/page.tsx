"use client";

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
  { label: "Analysis", icon: <FileText className="w-4 h-4" /> },
  { label: "Showcase", icon: <Trophy className="w-4 h-4" /> },
];

const STEP_COMPONENTS: Record<number, React.ReactNode> = {
  1: <Step1GetStarted />,
  2: <Step2ProcessData />,
  3: <Step3TrainForecast />,
  4: <Step4Analysis />,
  5: <Step5Showcase />,
};

export default function BuildPage() {
  const currentStep = useBuildStore((s) => s.currentStep);
  const completedSteps = useBuildStore((s) => s.completedSteps);
  const debugMode = useBuildStore((s) => s.debugMode);
  const toggleDebug = useBuildStore((s) => s.toggleDebug);
  const setStep = useBuildStore((s) => s.setStep);

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
      <div className="hidden lg:block w-80 border-l border-slate-800 bg-[#0a0e18]">
        <ChatSidebar />
      </div>
    </div>
  );
}

function DebugPanel() {
  const state = useBuildStore();
  const toggleDebug = useBuildStore((s) => s.toggleDebug);

  const debugData = {
    currentStep: state.currentStep,
    completedSteps: state.completedSteps,
    projectId: state.projectId,
    projectTitle: state.projectTitle,
    useCase: state.useCase,
    uploadedFiles: state.uploadedFiles,
    columns: state.columns.length,
    numericColumns: state.numericColumns.length,
    dateCol: state.dateCol,
    targetCol: state.targetCol,
    frequency: state.frequency,
    missingStrategy: state.missingStrategy,
    outlierStrategy: state.outlierStrategy,
    selectedLags: state.selectedLags,
    calendarFeatures: state.calendarFeatures,
    horizon: state.horizon,
    trainTestSplit: state.trainTestSplit,
    baselineModel: state.baselineModel,
    multivariateModel: state.multivariateModel,
    selectedDrivers: state.selectedDrivers,
    hasForecastResults: !!state.forecastResults,
    widgetCount: state.widgets.length,
    tags: state.tags,
    isLoading: state.isLoading,
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
            onClick={() => state.setStep(s)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer ${
              state.currentStep === s
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
