import { create } from "zustand";
import { persist } from "zustand/middleware";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ForecastResults {
  baseline: { predictions: number[]; index: string[] };
  multivariate: {
    predictions: number[];
    index: string[];
    feature_importance: Record<string, number>;
  };
  historical: { values: number[]; index: string[] };
  horizon: number;
  drivers_used: string[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface UserInfo {
  user_id: string;
  username: string;
}

// ─── Auth Store ───────────────────────────────────────────────────────────────

interface AuthState {
  user: UserInfo | null;
  setUser: (user: UserInfo) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      setUser: (user) => set({ user }),
      logout: () => set({ user: null }),
    }),
    { name: "forecast-buddy-auth" }
  )
);

// ─── Build Store ──────────────────────────────────────────────────────────────

interface BuildState {
  // Navigation (5 steps now)
  currentStep: number;
  completedSteps: number[];
  debugMode: boolean;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  completeStep: (step: number) => void;
  toggleDebug: () => void;

  // Step 1: Project
  projectId: string | null;
  setProjectId: (id: string) => void;
  projectTitle: string;
  setProjectTitle: (t: string) => void;
  projectDescription: string;
  setProjectDescription: (d: string) => void;
  useCase: string;
  setUseCase: (u: string) => void;

  // Step 1: Files
  uploadedFiles: string[];
  addUploadedFile: (name: string) => void;

  // File analysis results
  columns: string[];
  numericColumns: string[];
  detectedDateCol: string | null;
  rowCount: number;
  setFileInfo: (info: {
    columns: string[];
    numericColumns: string[];
    detectedDateCol: string | null;
    rowCount: number;
  }) => void;

  // Step 2: Pipeline config
  dateCol: string | null;
  setDateCol: (col: string) => void;
  targetCol: string | null;
  setTargetCol: (col: string) => void;
  frequency: string;
  setFrequency: (f: string) => void;
  missingStrategy: string;
  setMissingStrategy: (s: string) => void;
  outlierStrategy: string;
  setOutlierStrategy: (s: string) => void;
  selectedLags: string[];
  toggleLag: (lag: string) => void;
  calendarFeatures: boolean;
  setCalendarFeatures: (v: boolean) => void;

  // Step 3: Model
  horizon: number;
  setHorizon: (h: number) => void;
  trainTestSplit: number;
  setTrainTestSplit: (s: number) => void;
  baselineModel: string;
  setBaselineModel: (m: string) => void;
  multivariateModel: string;
  setMultivariateModel: (m: string) => void;
  selectedDrivers: string[];
  toggleDriver: (driver: string) => void;
  forecastResults: ForecastResults | null;
  setForecastResults: (results: ForecastResults) => void;

  // Step 4: Outputs
  widgets: { type: string; title: string; caption: string }[];
  addWidget: (w: { type: string; title: string; caption: string }) => void;
  removeWidget: (index: number) => void;

  // Step 5: Showcase
  summary: string;
  setSummary: (s: string) => void;
  tags: string[];
  setTags: (t: string[]) => void;

  // Loading
  isLoading: boolean;
  setLoading: (loading: boolean) => void;
  loadingMessage: string;
  setLoadingMessage: (msg: string) => void;

  // Chat
  chatMessages: ChatMessage[];
  addChatMessage: (msg: ChatMessage) => void;

  // Reset
  reset: () => void;
}

const buildInitial = {
  currentStep: 1,
  completedSteps: [] as number[],
  debugMode: false,
  projectId: null as string | null,
  projectTitle: "",
  projectDescription: "",
  useCase: "",
  uploadedFiles: [] as string[],
  columns: [] as string[],
  numericColumns: [] as string[],
  detectedDateCol: null as string | null,
  rowCount: 0,
  dateCol: null as string | null,
  targetCol: null as string | null,
  frequency: "",
  missingStrategy: "",
  outlierStrategy: "",
  selectedLags: [] as string[],
  calendarFeatures: false,
  horizon: 12,
  trainTestSplit: 80,
  baselineModel: "",
  multivariateModel: "",
  selectedDrivers: [] as string[],
  forecastResults: null as ForecastResults | null,
  widgets: [] as { type: string; title: string; caption: string }[],
  summary: "",
  tags: [] as string[],
  isLoading: false,
  loadingMessage: "",
  chatMessages: [
    {
      role: "assistant" as const,
      content: "Welcome! I'm your Forecast Buddy. Start by creating a project and uploading your data.",
    },
  ],
};

export const useBuildStore = create<BuildState>()((set) => ({
  ...buildInitial,

  setStep: (step) => set({ currentStep: step }),
  nextStep: () => set((s) => ({ currentStep: Math.min(s.currentStep + 1, 5) })),
  prevStep: () => set((s) => ({ currentStep: Math.max(s.currentStep - 1, 1) })),
  completeStep: (step) =>
    set((s) => ({
      completedSteps: s.completedSteps.includes(step)
        ? s.completedSteps
        : [...s.completedSteps, step],
    })),
  toggleDebug: () => set((s) => ({ debugMode: !s.debugMode })),

  setProjectId: (id) => set({ projectId: id }),
  setProjectTitle: (t) => set({ projectTitle: t }),
  setProjectDescription: (d) => set({ projectDescription: d }),
  setUseCase: (u) => set({ useCase: u }),
  addUploadedFile: (name) =>
    set((s) => ({ uploadedFiles: [...s.uploadedFiles, name] })),

  setFileInfo: (info) =>
    set({
      columns: info.columns,
      numericColumns: info.numericColumns,
      detectedDateCol: info.detectedDateCol,
      rowCount: info.rowCount,
    }),

  setDateCol: (col) => set({ dateCol: col }),
  setTargetCol: (col) => set({ targetCol: col }),
  setFrequency: (f) => set({ frequency: f }),
  setMissingStrategy: (s) => set({ missingStrategy: s }),
  setOutlierStrategy: (s) => set({ outlierStrategy: s }),
  toggleLag: (lag) =>
    set((s) => ({
      selectedLags: s.selectedLags.includes(lag)
        ? s.selectedLags.filter((l) => l !== lag)
        : [...s.selectedLags, lag],
    })),
  setCalendarFeatures: (v) => set({ calendarFeatures: v }),

  setHorizon: (h) => set({ horizon: h }),
  setTrainTestSplit: (s) => set({ trainTestSplit: s }),
  setBaselineModel: (m) => set({ baselineModel: m }),
  setMultivariateModel: (m) => set({ multivariateModel: m }),
  toggleDriver: (driver) =>
    set((s) => ({
      selectedDrivers: s.selectedDrivers.includes(driver)
        ? s.selectedDrivers.filter((d) => d !== driver)
        : [...s.selectedDrivers, driver],
    })),
  setForecastResults: (results) => set({ forecastResults: results }),

  addWidget: (w) => set((s) => ({ widgets: [...s.widgets, w] })),
  removeWidget: (index) =>
    set((s) => ({ widgets: s.widgets.filter((_, i) => i !== index) })),

  setSummary: (s) => set({ summary: s }),
  setTags: (t) => set({ tags: t }),

  setLoading: (loading) => set({ isLoading: loading }),
  setLoadingMessage: (msg) => set({ loadingMessage: msg }),
  addChatMessage: (msg) =>
    set((s) => ({ chatMessages: [...s.chatMessages, msg] })),

  reset: () => set(buildInitial),
}));
