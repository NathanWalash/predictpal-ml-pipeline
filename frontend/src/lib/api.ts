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

export async function uploadFile(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await api.post("/upload", formData, {
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

// ─── Train ────────────────────────────────────────────────────────────────────

export async function trainModel(
  projectId: string,
  dateCol: string,
  targetCol: string,
  drivers: string[],
  horizon: number
) {
  const res = await api.post("/train", {
    project_id: projectId,
    date_col: dateCol,
    target_col: targetCol,
    drivers,
    horizon,
  });
  return res.data;
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

export async function sendChatMessage(projectId: string, message: string) {
  const res = await api.post("/chat", {
    project_id: projectId,
    message,
  });
  return res.data;
}
