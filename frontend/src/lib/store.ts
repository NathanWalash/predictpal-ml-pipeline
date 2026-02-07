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
  metrics?: Record<string, number>;
  outputs?: Record<string, string>;
  settings?: Record<string, unknown>;
  test_predictions?: {
    index: string[];
    actual: number[];
    baseline: number[];
    multivariate: number[];
  };
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface UserInfo {
  user_id: string;
  username: string;
}

export interface DriverFileInfo {
  fileName: string;
  columns: string[];
  numericColumns: string[];
  detectedDateCol: string | null;
  rowCount: number;
  previewData: Record<string, unknown>[];
  columnDtypes: Record<string, string>;
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
    { name: "predict-pal-auth" }
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
  removeUploadedFile: (name: string) => void;
  clearFileInfo: () => void;

  // File analysis results
  columns: string[];
  numericColumns: string[];
  detectedDateCol: string | null;
  rowCount: number;
  previewData: Record<string, unknown>[];
  columnDtypes: Record<string, string>;

  // Driver file (optional)
  driverFiles: DriverFileInfo[];
  driverNumericColumns: string[];
  addDriverInfo: (info: {
    fileName: string;
    columns: string[];
    numericColumns: string[];
    detectedDateCol: string | null;
    rowCount: number;
    previewData?: Record<string, unknown>[];
    columnDtypes?: Record<string, string>;
  }) => void;
  setDriverInfos: (infos: DriverFileInfo[]) => void;
  removeDriverInfo: (fileName: string) => void;
  clearDriverInfo: () => void;
  setFileInfo: (info: {
    columns: string[];
    numericColumns: string[];
    detectedDateCol: string | null;
    rowCount: number;
    previewData?: Record<string, unknown>[];
    columnDtypes?: Record<string, string>;
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
  missingFillValue: string;
  setMissingFillValue: (v: string) => void;
  outlierStrategy: string;
  setOutlierStrategy: (s: string) => void;
  driverOutlierStrategy: string;
  setDriverOutlierStrategy: (s: string) => void;
  selectedLags: string[];
  toggleLag: (lag: string) => void;
  calendarFeatures: boolean;
  setCalendarFeatures: (v: boolean) => void;
  holidayFeatures: boolean;
  setHolidayFeatures: (v: boolean) => void;

  // Step 3: Model
  horizon: number;
  setHorizon: (h: number) => void;
  testWindowWeeks: number;
  setTestWindowWeeks: (weeks: number) => void;
  validationMode: string;
  setValidationMode: (mode: string) => void;
  lagConfig: string;
  setLagConfig: (config: string) => void;
  autoSelectLags: boolean;
  setAutoSelectLags: (enabled: boolean) => void;
  baselineModel: string;
  setBaselineModel: (m: string) => void;
  multivariateModel: string;
  setMultivariateModel: (m: string) => void;
  selectedDrivers: string[];
  toggleDriver: (driver: string) => void;
  forecastResults: ForecastResults | null;
  setForecastResults: (results: ForecastResults) => void;

  // Step 4: Analysis
  widgets: { type: string; title: string; caption: string }[];
  setWidgets: (widgets: { type: string; title: string; caption: string }[]) => void;
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
  previewData: [] as Record<string, unknown>[],
  columnDtypes: {} as Record<string, string>,
  driverFiles: [] as DriverFileInfo[],
  driverNumericColumns: [] as string[],
  dateCol: null as string | null,
  targetCol: null as string | null,
  frequency: "",
  missingStrategy: "",
  missingFillValue: "",
  outlierStrategy: "",
  driverOutlierStrategy: "keep",
  selectedLags: [] as string[],
  calendarFeatures: false,
  holidayFeatures: false,
  horizon: 8,
  testWindowWeeks: 48,
  validationMode: "walk_forward",
  lagConfig: "1,2,4",
  autoSelectLags: false,
  baselineModel: "lagged_ridge",
  multivariateModel: "gbm",
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
      content: "Welcome! I'm your Predict Pal. Start by creating a project and uploading your data.",
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
    set((s) => ({
      uploadedFiles: s.uploadedFiles.includes(name)
        ? s.uploadedFiles
        : [name],
    })),
  removeUploadedFile: (name) =>
    set((s) => ({
      uploadedFiles: s.uploadedFiles.filter((f) => f !== name),
    })),
  clearFileInfo: () =>
    set({
      columns: [],
      numericColumns: [],
      detectedDateCol: null,
      rowCount: 0,
      previewData: [],
      columnDtypes: {},
    }),

  addDriverInfo: (info) =>
    set((s) => {
      const nextInfo: DriverFileInfo = {
        fileName: info.fileName,
        columns: info.columns,
        numericColumns: info.numericColumns,
        detectedDateCol: info.detectedDateCol,
        rowCount: info.rowCount,
        previewData: info.previewData || [],
        columnDtypes: info.columnDtypes || {},
      };
      const existing = s.driverFiles.filter((f) => f.fileName !== nextInfo.fileName);
      const driverFiles = [...existing, nextInfo];
      const driverNumericColumns = Array.from(
        new Set(driverFiles.flatMap((f) => f.numericColumns))
      );
      return { driverFiles, driverNumericColumns };
    }),
  setDriverInfos: (infos) =>
    set({
      driverFiles: infos,
      driverNumericColumns: Array.from(new Set(infos.flatMap((f) => f.numericColumns))),
    }),
  removeDriverInfo: (fileName) =>
    set((s) => {
      const driverFiles = s.driverFiles.filter((f) => f.fileName !== fileName);
      const driverNumericColumns = Array.from(
        new Set(driverFiles.flatMap((f) => f.numericColumns))
      );
      return {
        driverFiles,
        driverNumericColumns,
        selectedDrivers: s.selectedDrivers.filter((d) => driverNumericColumns.includes(d)),
      };
    }),
  clearDriverInfo: () =>
    set({
      driverFiles: [],
      driverNumericColumns: [],
      selectedDrivers: [],
    }),

  setFileInfo: (info) =>
    set({
      columns: info.columns,
      numericColumns: info.numericColumns,
      detectedDateCol: info.detectedDateCol,
      rowCount: info.rowCount,
      previewData: info.previewData || [],
      columnDtypes: info.columnDtypes || {},
    }),

  setDateCol: (col) => set({ dateCol: col }),
  setTargetCol: (col) => set({ targetCol: col }),
  setFrequency: (f) => set({ frequency: f }),
  setMissingStrategy: (s) => set({ missingStrategy: s }),
  setMissingFillValue: (v) => set({ missingFillValue: v }),
  setOutlierStrategy: (s) => set({ outlierStrategy: s }),
  setDriverOutlierStrategy: (s) => set({ driverOutlierStrategy: s }),
  toggleLag: (lag) =>
    set((s) => ({
      selectedLags: s.selectedLags.includes(lag)
        ? s.selectedLags.filter((l) => l !== lag)
        : [...s.selectedLags, lag],
    })),
  setCalendarFeatures: (v) => set({ calendarFeatures: v }),
  setHolidayFeatures: (v) => set({ holidayFeatures: v }),

  setHorizon: (h) => set({ horizon: h }),
  setTestWindowWeeks: (weeks) => set({ testWindowWeeks: weeks }),
  setValidationMode: (mode) => set({ validationMode: mode }),
  setLagConfig: (config) => set({ lagConfig: config }),
  setAutoSelectLags: (enabled) => set({ autoSelectLags: enabled }),
  setBaselineModel: (m) => set({ baselineModel: m }),
  setMultivariateModel: (m) => set({ multivariateModel: m }),
  toggleDriver: (driver) =>
    set((s) => ({
      selectedDrivers: s.selectedDrivers.includes(driver)
        ? s.selectedDrivers.filter((d) => d !== driver)
        : [...s.selectedDrivers, driver],
    })),
  setForecastResults: (results) => set({ forecastResults: results }),

  setWidgets: (widgets) => set({ widgets }),
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
