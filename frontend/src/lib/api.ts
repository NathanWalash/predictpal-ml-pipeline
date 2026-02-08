import axios from "axios";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api",
  headers: {
    "Content-Type": "application/json",
  },
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

export async function registerUser(username: string, password: string) {
  const res = await api.post("/auth/register", { username, password });
  return res.data;
}

export async function loginUser(username: string, password: string) {
  const res = await api.post("/auth/login", { username, password });
  return res.data;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function createProject(
  userId: string,
  title: string,
  description: string = "",
  useCase: string = ""
) {
  const res = await api.post("/projects/create", {
    user_id: userId,
    title,
    description,
    use_case: useCase,
  });
  return res.data;
}

export async function listProjects(userId: string) {
  const res = await api.get(`/projects/${userId}`);
  return res.data;
}

export async function getProject(projectId: string) {
  const res = await api.get(`/projects/detail/${projectId}`);
  return res.data;
}

export async function updateProject(
  projectId: string,
  step?: number,
  config?: Record<string, unknown>
) {
  const res = await api.post("/projects/update", {
    project_id: projectId,
    step,
    config,
  });
  return res.data;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function uploadFile(file: File, projectId?: string) {
  const formData = new FormData();
  formData.append("file", file);
  if (projectId) formData.append("project_id", projectId);
  const res = await api.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

export async function uploadDriverFile(file: File, projectId?: string) {
  const formData = new FormData();
  formData.append("file", file);
  if (projectId) formData.append("project_id", projectId);
  const res = await api.post("/upload-drivers", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return res.data;
}

// ─── Analyze ──────────────────────────────────────────────────────────────────

export async function analyzeData(
  projectId: string,
  dateCol?: string,
  targetCol?: string
) {
  const res = await api.post("/analyze", {
    project_id: projectId,
    date_col: dateCol,
    target_col: targetCol,
  });
  return res.data;
}

export async function processData(options: {
  projectId: string;
  dateCol: string;
  targetCol: string;
  frequency: string;
  driverFrequency?: string;
  driverDateCol?: string;
  outlierStrategy: string;
  driverOutlierStrategy: string;
}) {
  const res = await api.post("/process", {
    project_id: options.projectId,
    date_col: options.dateCol,
    target_col: options.targetCol,
    frequency: options.frequency,
    driver_frequency: options.driverFrequency,
    driver_date_col: options.driverDateCol,
    outlier_strategy: options.outlierStrategy,
    driver_outlier_strategy: options.driverOutlierStrategy,
  });
  return res.data;
}

// ─── Train ────────────────────────────────────────────────────────────────────

export async function trainModel(
  projectId: string,
  dateCol: string,
  targetCol: string,
  options: {
    drivers: string[];
    horizon: number;
    baselineModel: string;
    multivariateModel: string;
    lagConfig: string;
    autoSelectLags: boolean;
    testWindowWeeks: number;
    validationMode: string;
    calendarFeatures: boolean;
    holidayFeatures: boolean;
    frequency: string;
  }
) {
  const res = await api.post("/train", {
    project_id: projectId,
    date_col: dateCol,
    target_col: targetCol,
    drivers: options.drivers,
    horizon: options.horizon,
    baseline_model: options.baselineModel,
    multivariate_model: options.multivariateModel,
    lag_config: options.lagConfig,
    auto_select_lags: options.autoSelectLags,
    test_window_weeks: options.testWindowWeeks,
    validation_mode: options.validationMode,
    calendar_features: options.calendarFeatures,
    holiday_features: options.holidayFeatures,
    frequency: options.frequency,
  });
  return res.data;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export interface ChatPayload {
  project_id: string;
  message: string;
  page_context?: string;
  history?: { role: string; content: string }[];
  report_data?: string | null;
}

export async function sendChatMessage(payload: ChatPayload) {
  const res = await api.post("/chat", payload);
  return res.data;
}

export interface AISuggestionPayload {
  mode: "story_setup" | "graph_caption";
  project_id?: string | null;
  page_context?: string;
  report_data?: string | null;
  graph_source?: string;
  current_headline?: string;
  current_summary?: string;
  current_caption?: string;
}

export interface AISuggestionResponse {
  headline?: string;
  summary?: string;
  caption?: string;
}

export async function requestAISuggestion(payload: AISuggestionPayload): Promise<AISuggestionResponse> {
  const res = await api.post("/ai/suggest", payload);
  return res.data as AISuggestionResponse;
}

export interface AnalysisManifest {
  data_summary: {
    target_name: string;
    date_col: string;
    start: string;
    end: string;
    rows: number;
    freq: string;
  };
  settings: Record<string, unknown>;
  metrics: {
    baseline_rmse: number;
    baseline_mae: number;
    baseline_nrmse_pct?: number;
    baseline_walk_forward_rmse: number;
    multivariate_rmse: number;
    multivariate_mae: number;
    multivariate_nrmse_pct?: number;
    multivariate_walk_forward_rmse: number;
    improvement_pct: number;
  };
  outputs: Record<string, string>;
}

export interface AnalysisBundle {
  manifest: AnalysisManifest;
  available: Record<string, boolean>;
  datasets: {
    forecast: Array<{
      week_ending: string;
      baseline_forecast: number;
      multivariate_forecast: number;
    }>;
    test_predictions: Array<{
      week_ending: string;
      actual: number;
      baseline: number;
      multivariate: number;
    }>;
    feature_importance: Array<{
      feature: string;
      importance: number;
    }>;
    feature_frame: Array<Record<string, string | number | null>>;
    target_series: Array<Record<string, string | number | null>>;
    temp_weekly: Array<{
      date: string;
      temp_mean: number;
    }>;
    holiday_weekly: Array<{
      week_ending?: string;
      index?: string;
      date?: string;
      holiday_count: number;
    }>;
    driver_series: Array<Record<string, string | number | null>>;
  };
}

export async function getSampleAnalysisBundle(): Promise<AnalysisBundle> {
  const res = await api.get("/analysis/sample");
  return res.data as AnalysisBundle;
}

export type StoryTextStyle = "h1" | "h2" | "h3" | "body" | "bullets";
export type StoryGraphAssetId =
  | "future-forecast"
  | "test-fit"
  | "error-trend"
  | "driver-series"
  | "feature-importance";

export type StoryNotebookBlock =
  | {
      id: string;
      type: "text";
      style: StoryTextStyle;
      content: string;
    }
  | {
      id: string;
      type: "graph";
      assetId: StoryGraphAssetId;
      title: string;
      caption: string;
      windowStartTs: number | null;
      windowEndTs: number | null;
    };

export interface StoryCard {
  story_id: string;
  project_id: string;
  title: string;
  description: string;
  author: string;
  user_id: string;
  categories: string[];
  published_at: string | null;
  created_at: string | null;
  use_case: string;
  horizon: number | null;
  baseline_model: string | null;
  multivariate_model: string | null;
  drivers: string[];
  block_count: number;
  cover_graph: StoryGraphAssetId | null;
  source: "user" | "debug";
  is_debug: boolean;
}

export interface StoryDetail extends StoryCard {
  notebook_blocks: StoryNotebookBlock[];
  publish_mode: string;
}

export async function listStories(params?: {
  search?: string;
  category?: string;
}): Promise<{ stories: StoryCard[]; total: number }> {
  const res = await api.get("/stories", {
    params: {
      search: params?.search || undefined,
      category: params?.category || undefined,
    },
  });
  return res.data as { stories: StoryCard[]; total: number };
}

export async function getStory(storyId: string): Promise<StoryDetail> {
  const res = await api.get(`/stories/${storyId}`);
  return res.data as StoryDetail;
}
