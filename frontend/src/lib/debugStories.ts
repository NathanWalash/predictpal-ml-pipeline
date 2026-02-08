import type { StoryDetail } from "@/lib/api";

const now = new Date().toISOString();
const PERSISTED_DEBUG_STORIES_KEY = "hackathon.persisted_debug_stories.v1";

export const DEBUG_STORIES: StoryDetail[] = [
  {
    story_id: "debug-weekly-retail",
    project_id: "debug-weekly-retail",
    title: "Debug Demo: Weekly Retail Forecast Walkthrough",
    description:
      "A full walkthrough of a weekly retail run, from model evaluation on the held-out period to a practical forward forecast that can be shared with non-technical stakeholders.",
    author: "debug_bot",
    user_id: "debug",
    categories: ["retail", "weekly", "demo"],
    published_at: now,
    created_at: now,
    use_case: "retail",
    horizon: 8,
    baseline_model: "lagged_ridge",
    multivariate_model: "gbm",
    drivers: ["temp_mean", "holiday_count"],
    block_count: 4,
    cover_graph: "future-forecast",
    source: "debug",
    is_debug: true,
    publish_mode: "debug",
    notebook_blocks: [
      {
        id: "d1",
        type: "text",
        style: "h2",
        content: "What this run answers",
      },
      {
        id: "d2",
        type: "text",
        style: "body",
        content:
          "This example compares baseline and multivariate models, then explains how the future forecast should be read.",
      },
      {
        id: "d3",
        type: "graph",
        assetId: "test-fit",
        title: "Test Window Fit",
        caption: "Held-out period performance for both models.",
        windowStartTs: null,
        windowEndTs: null,
      },
      {
        id: "d4",
        type: "graph",
        assetId: "future-forecast",
        title: "Future Forecast",
        caption: "Historical actuals followed by projected values.",
        windowStartTs: null,
        windowEndTs: null,
      },
    ],
  },
  {
    story_id: "debug-energy-patterns",
    project_id: "debug-energy-patterns",
    title: "Debug Demo: Energy Demand Patterns",
    description:
      "A driver-first energy narrative that explains demand movement using weather and calendar context, then links those signals back to model confidence and forecast interpretation.",
    author: "debug_bot",
    user_id: "debug",
    categories: ["energy", "operations", "demo"],
    published_at: now,
    created_at: now,
    use_case: "energy",
    horizon: 12,
    baseline_model: "lagged_ridge",
    multivariate_model: "gbm",
    drivers: ["temp_mean", "holiday_count"],
    block_count: 4,
    cover_graph: "driver-series",
    source: "debug",
    is_debug: true,
    publish_mode: "debug",
    notebook_blocks: [
      {
        id: "d5",
        type: "text",
        style: "h2",
        content: "Driver signals explained",
      },
      {
        id: "d6",
        type: "text",
        style: "bullets",
        content:
          "Temperature can explain weekly movement\nHoliday weeks often create one-off shocks\nDriver charts help explain model behavior",
      },
      {
        id: "d7",
        type: "graph",
        assetId: "driver-series",
        title: "Driver Signals",
        caption: "Temperature and holiday activity over time.",
        windowStartTs: null,
        windowEndTs: null,
      },
      {
        id: "d8",
        type: "graph",
        assetId: "feature-importance",
        title: "Feature Importance",
        caption: "Which variables contributed most.",
        windowStartTs: null,
        windowEndTs: null,
      },
    ],
  },
  {
    story_id: "debug-health-brief",
    project_id: "debug-health-brief",
    title: "Debug Demo: Health Forecast Brief",
    description:
      "A concise health operations brief designed for quick decisions, highlighting recent model error behavior and the near-term forecast window in a presentation-friendly format.",
    author: "debug_bot",
    user_id: "debug",
    categories: ["health", "weekly", "demo"],
    published_at: now,
    created_at: now,
    use_case: "health",
    horizon: 6,
    baseline_model: "lagged_ridge",
    multivariate_model: "gbm",
    drivers: ["holiday_count"],
    block_count: 3,
    cover_graph: "error-trend",
    source: "debug",
    is_debug: true,
    publish_mode: "debug",
    notebook_blocks: [
      {
        id: "d9",
        type: "text",
        style: "h3",
        content: "Model reliability snapshot",
      },
      {
        id: "d10",
        type: "graph",
        assetId: "error-trend",
        title: "Absolute Error Trend",
        caption: "How far predictions were from actual values each week.",
        windowStartTs: null,
        windowEndTs: null,
      },
      {
        id: "d11",
        type: "graph",
        assetId: "future-forecast",
        title: "Future Forecast",
        caption: "Projected weeks for planning.",
        windowStartTs: null,
        windowEndTs: null,
      },
    ],
  },
];

function readPersistedDebugStories(): StoryDetail[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(PERSISTED_DEBUG_STORIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoryDetail[]) : [];
  } catch {
    return [];
  }
}

function writePersistedDebugStories(stories: StoryDetail[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PERSISTED_DEBUG_STORIES_KEY, JSON.stringify(stories));
}

export function getPersistedDebugStories(): StoryDetail[] {
  return readPersistedDebugStories();
}

export function upsertPersistedDebugStory(story: StoryDetail) {
  const existing = readPersistedDebugStories();
  const next = [story, ...existing.filter((s) => s.story_id !== story.story_id)];
  writePersistedDebugStories(next);
}

export function getAllDebugStories(): StoryDetail[] {
  const persisted = readPersistedDebugStories();
  const seen = new Set<string>();
  const merged: StoryDetail[] = [];
  for (const story of [...persisted, ...DEBUG_STORIES]) {
    if (seen.has(story.story_id)) continue;
    seen.add(story.story_id);
    merged.push(story);
  }
  return merged;
}

export function getDebugStory(storyId: string): StoryDetail | undefined {
  return getAllDebugStories().find((story) => story.story_id === storyId);
}
