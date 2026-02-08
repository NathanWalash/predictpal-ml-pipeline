import type { StoryDetail } from "@/lib/api";

const LOCAL_STORIES_KEY = "hackathon.persisted_live_stories.v1";

function readLocalStories(): StoryDetail[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_STORIES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoryDetail[]) : [];
  } catch {
    return [];
  }
}

function writeLocalStories(stories: StoryDetail[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_STORIES_KEY, JSON.stringify(stories));
}

export function getLocalStories(): StoryDetail[] {
  return readLocalStories();
}

export function getLocalStory(storyId: string): StoryDetail | undefined {
  return readLocalStories().find((story) => story.story_id === storyId);
}

export function upsertLocalStory(story: StoryDetail) {
  const existing = readLocalStories();
  const next = [story, ...existing.filter((s) => s.story_id !== story.story_id)];
  writeLocalStories(next);
}

