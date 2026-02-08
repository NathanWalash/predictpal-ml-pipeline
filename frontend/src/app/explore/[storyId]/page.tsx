"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Badge, Button } from "@/components/ui";
import { getStory, type StoryDetail } from "@/lib/api";
import { getDebugStory } from "@/lib/debugStories";
import { getLocalStory, upsertLocalStory } from "@/lib/localStories";
import { StoryNotebook } from "@/components/story/StoryNotebook";
import { ArrowLeft, Bug, Loader2, UserRound } from "lucide-react";

function formatDate(value: string | null) {
  if (!value) return "Unknown date";
  const ts = Date.parse(value);
  if (!Number.isFinite(ts)) return value;
  return new Date(ts).toLocaleDateString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export default function StoryDetailPage() {
  const params = useParams<{ storyId: string }>();
  const storyId = useMemo(() => String(params?.storyId || ""), [params]);

  const [story, setStory] = useState<StoryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!storyId) return;
    let mounted = true;

    const run = async () => {
      setLoading(true);
      setLoadError("");

      const debugStory = getDebugStory(storyId);
      if (debugStory) {
        if (mounted) setStory(debugStory);
        if (mounted) setLoading(false);
        return;
      }

      const localStory = getLocalStory(storyId);
      if (localStory) {
        if (mounted) setStory(localStory);
        if (mounted) setLoading(false);
        return;
      }

      try {
        const data = await getStory(storyId);
        if (!mounted) return;
        setStory(data);
        upsertLocalStory(data);
      } catch {
        if (!mounted) return;
        setLoadError("Story not found or unavailable.");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    run();
    return () => {
      mounted = false;
    };
  }, [storyId]);

  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <section className="max-w-5xl mx-auto px-6 pt-12 pb-14 space-y-6">
        <div className="flex items-center justify-between">
          <Link href="/explore">
            <Button variant="secondary">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Explore
            </Button>
          </Link>
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-10 text-slate-300 flex items-center justify-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
            Loading story...
          </div>
        )}

        {!loading && loadError && (
          <div className="rounded-2xl border border-amber-800 bg-amber-950/20 p-8 text-center text-amber-300">
            {loadError}
          </div>
        )}

        {!loading && story && (
          <>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                {story.is_debug ? (
                  <Badge variant="warning">
                    <span className="inline-flex items-center gap-1">
                      <Bug className="w-3 h-3" />
                      Debug
                    </span>
                  </Badge>
                ) : (
                  <Badge variant="success">Live post</Badge>
                )}
                <Badge variant="default">{story.block_count} blocks</Badge>
                {story.horizon ? <Badge variant="default">Horizon: {story.horizon}</Badge> : null}
              </div>

              <h1 className="text-3xl font-bold text-white">{story.title}</h1>
              <p className="text-slate-400">{story.description || "No description provided."}</p>

              <div className="flex flex-wrap items-center gap-4 text-sm text-slate-400">
                <span className="inline-flex items-center gap-1.5">
                  <UserRound className="w-4 h-4 text-slate-500" />@{story.author}
                </span>
                <span>{formatDate(story.published_at || story.created_at)}</span>
                {story.baseline_model && story.multivariate_model ? (
                  <span>
                    {story.baseline_model} vs {story.multivariate_model}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                {story.categories.map((cat) => (
                  <span
                    key={`${story.story_id}-${cat}`}
                    className="px-2.5 py-1 rounded-full bg-slate-800 text-xs text-slate-300 border border-slate-700"
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>

            <StoryNotebook story={story} />
          </>
        )}
      </section>
    </div>
  );
}
