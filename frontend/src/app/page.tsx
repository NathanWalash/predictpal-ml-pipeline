import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Compass,
  Cpu,
  FileText,
  PenSquare,
  Search,
  Share2,
  Sparkles,
  Trophy,
  Upload,
} from "lucide-react";

const CAPABILITIES = [
  {
    icon: <Upload className="w-7 h-7" />,
    title: "Build Forecasts",
    description:
      "Upload data, choose columns, configure models, and run forecasts in a guided flow.",
    tone: "border-teal-800/70 bg-teal-950/20",
  },
  {
    icon: <Search className="w-7 h-7" />,
    title: "Explore Insights",
    description:
      "Review model quality, compare outputs, and inspect forecast behavior with chart-first analysis.",
    tone: "border-sky-800/70 bg-sky-950/20",
  },
  {
    icon: <PenSquare className="w-7 h-7" />,
    title: "Publish Stories",
    description:
      "Turn results into notebook-style posts and share your forecasting story in a feed others can follow.",
    tone: "border-indigo-800/70 bg-indigo-950/20",
  },
];

const HIGHLIGHTS = [
  {
    icon: <Compass className="w-5 h-5" />,
    title: "Guided, Not Overwhelming",
    description:
      "The workflow is structured step-by-step so users always know what to do next.",
  },
  {
    icon: <Bot className="w-5 h-5" />,
    title: "AI Second Opinion",
    description:
      "Use the assistant to clarify choices, interpret metrics, and explain decisions in plain language.",
  },
  {
    icon: <Share2 className="w-5 h-5" />,
    title: "Built For Communication",
    description:
      "Forecast outputs are designed to be shared with non-technical stakeholders, not just data teams.",
  },
];

const WORKFLOW = [
  { step: 1, icon: <Upload className="w-4 h-4" />, label: "Upload Data" },
  { step: 2, icon: <Sparkles className="w-4 h-4" />, label: "Process" },
  { step: 3, icon: <Cpu className="w-4 h-4" />, label: "Train & Forecast" },
  { step: 4, icon: <FileText className="w-4 h-4" />, label: "Analysis & Results" },
  { step: 5, icon: <Trophy className="w-4 h-4" />, label: "Publish Story" },
];

export default function Home() {
  return (
    <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_12%,rgba(20,184,166,0.14),transparent_35%),radial-gradient(circle_at_86%_8%,rgba(59,130,246,0.14),transparent_32%),radial-gradient(circle_at_55%_45%,rgba(148,163,184,0.09),transparent_40%),linear-gradient(to_bottom,rgba(15,23,42,0.32),rgba(2,6,23,0.6))]" />

      <section className="relative max-w-6xl mx-auto px-6 pt-20 pb-10">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-teal-900/30 border border-teal-800 rounded-full text-teal-300 text-sm font-medium mb-6">
          <BarChart3 className="w-4 h-4" />
          PredictPal Workbench
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight tracking-tight">
          Forecast smarter.
          <br />
          <span className="text-teal-400">Share clearer decisions.</span>
        </h1>
        <p className="mt-6 text-lg text-slate-300 max-w-2xl leading-relaxed">
          A guided workspace that helps you go from raw time-series data to publishable forecast stories,
          with analysis and AI support built into every step.
        </p>

        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Link
            href="/create"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-teal-900/40"
          >
            Start Building
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold rounded-xl border border-slate-700 transition-all"
          >
            <Search className="w-4 h-4" />
            Explore Stories
          </Link>
        </div>
      </section>

      <section className="relative max-w-6xl mx-auto px-6 pb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {CAPABILITIES.map((cap) => (
            <div key={cap.title} className={`rounded-2xl border p-6 ${cap.tone} transition-all hover:-translate-y-0.5`}>
              <span className="text-teal-300">{cap.icon}</span>
              <h3 className="mt-3 text-xl font-bold text-white">{cap.title}</h3>
              <p className="mt-2 text-sm text-slate-300 leading-relaxed">{cap.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative max-w-6xl mx-auto px-6 pb-10">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 md:p-8">
          <p className="text-xs uppercase tracking-wide text-teal-300 font-semibold">Mission Snapshot</p>
          <h3 className="mt-2 text-2xl font-bold text-white leading-tight">
            Help more people make forecasting decisions with confidence.
          </h3>
          <p className="mt-3 text-sm text-slate-400 leading-relaxed max-w-3xl">
            PredictPal guides users from upload to publish with a clear workflow, analysis-first charts, and an AI
            assistant that explains tradeoffs in plain English.
          </p>
          <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-300">
              5-step guided process from data to story
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-300">
              Baseline + multivariate comparison for better decisions
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-900/70 px-3 py-2 text-sm text-slate-300">
              Notebook-style publishing for team and social sharing
            </div>
          </div>
        </div>
      </section>

      <section className="relative max-w-6xl mx-auto px-6 pb-10">
        <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 md:p-8">
          <div className="flex items-center gap-2 text-sm font-semibold text-teal-300">
            <Sparkles className="w-4 h-4" />
            Why teams use PredictPal
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
            {HIGHLIGHTS.map((item) => (
              <div key={item.title} className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
                <p className="inline-flex items-center gap-2 text-sm font-semibold text-white">
                  <span className="text-teal-300">{item.icon}</span>
                  {item.title}
                </p>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="relative border-t border-slate-800/80">
        <div className="max-w-6xl mx-auto px-6 py-14">
          <h2 className="text-3xl font-bold text-white text-center">How it works</h2>
          <p className="text-slate-400 text-center mt-2">
            From raw data to shared insight in five structured stages.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mt-9">
            {WORKFLOW.map((s) => (
              <div key={s.step} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-center">
                <div className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-300 mx-auto">
                  {s.icon}
                </div>
                <p className="text-xs text-teal-400 font-semibold mt-3">Step {s.step}</p>
                <p className="text-sm font-medium text-slate-200 mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

