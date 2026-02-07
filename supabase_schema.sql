-- ═══════════════════════════════════════════════════════════════════════════
-- Predict Pal — Supabase Schema
-- Run this in Supabase SQL Editor to set up all tables.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Projects: A container for a forecasting session
CREATE TABLE IF NOT EXISTS projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  name TEXT DEFAULT 'Untitled Project',
  current_step INT DEFAULT 1,
  status TEXT DEFAULT 'draft' -- 'draft', 'processing', 'completed'
);

-- 2. Datasets: Tracks the uploaded file
CREATE TABLE IF NOT EXISTS datasets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  row_count INT,
  date_col_name TEXT,
  target_col_name TEXT,
  metadata JSONB
);

-- 3. Model Configs: Stores the user's choices & results
CREATE TABLE IF NOT EXISTS model_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  drivers_selected JSONB,
  forecast_horizon INT DEFAULT 12,
  metrics JSONB
);

-- 4. Chat Logs: Persists the "Buddy" conversation
CREATE TABLE IF NOT EXISTS chat_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('user', 'assistant')),
  content TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_datasets_project ON datasets(project_id);
CREATE INDEX IF NOT EXISTS idx_model_configs_project ON model_configs(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_project ON chat_logs(project_id);
CREATE INDEX IF NOT EXISTS idx_chat_logs_created ON chat_logs(created_at);

