import Link from "next/link";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  FileText,
  Lightbulb,
  MessageSquare,
  Search,
  Share2,
  Sparkles,
  Upload,
  Users,
} from "lucide-react";

const PILLARS = [
  {
    icon: <Lightbulb className="w-5 h-5" />,
    title: "Make Forecasting Accessible",
    description:
      "Most teams have data but not a forecasting specialist on hand. We designed a guided flow that turns complex decisions into clear, practical steps.",
    tone: "border-amber-800/70 bg-amber-950/20 text-amber-300",
  },
  {
    icon: <BrainCircuit className="w-5 h-5" />,
    title: "Support Better Decisions",
    description:
      "PredictPal does not just output numbers. It explains model quality, error behavior, and forecast handoff points so users can decide with confidence.",
    tone: "border-teal-800/70 bg-teal-950/20 text-teal-300",
  },
  {
    icon: <Share2 className="w-5 h-5" />,
    title: "Turn Insight Into Communication",
    description:
      "Teams need to present findings to others. We added a story builder and explore feed so forecasts can be shared as polished, understandable posts.",
    tone: "border-blue-800/70 bg-blue-950/20 text-blue-300",
  },
];

const PROCESS = [
  {
    step: "01",
    title: "Upload Data",
    description:
      "Users upload their dataset and optionally add driver files like temperature, holidays, or external demand signals.",
    icon: <Upload className="w-5 h-5" />,
  },
  {
    step: "02",
    title: "Configure & Prepare",
    description:
      "The system guides column selection, frequency checks, and preprocessing choices so raw data becomes training-ready.",
    icon: <Sparkles className="w-5 h-5" />,
  },
  {
    step: "03",
    title: "Train & Forecast",
    description:
      "Baseline and multivariate models are run side-by-side so users can compare performance and understand tradeoffs.",
    icon: <BrainCircuit className="w-5 h-5" />,
  },
  {
    step: "04",
    title: "Analyse Results",
    description:
      "Evaluation metrics and visual diagnostics explain what worked, where errors happen, and what the forecast means.",
    icon: <Search className="w-5 h-5" />,
  },
  {
    step: "05",
    title: "Publish Story",
    description:
      "Users convert insights into a readable narrative post with charts, annotations, and context for stakeholders or social sharing.",
    icon: <FileText className="w-5 h-5" />,
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <section className="max-w-6xl mx-auto px-6 pt-14 pb-20 space-y-10">
        <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-900 to-[#0b1b2b] p-8 md:p-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-teal-800 bg-teal-900/20 px-3 py-1 text-xs font-semibold text-teal-300">
            <Users className="w-3.5 h-3.5" />
            About PredictPal
          </div>

          <h1 className="mt-5 text-4xl md:text-5xl font-bold leading-tight text-white">
            We are building forecasting tools people can actually use.
          </h1>
          <p className="mt-4 max-w-3xl text-slate-300 leading-relaxed">
            PredictPal is a guided forecasting workbench focused on clarity, accessibility, and communication.
            Our mission is to help more people move from raw data to confident prediction decisions, then present those
            results in a way others can understand.
          </p>

          <div className="mt-7 grid grid-cols-1 md:grid-cols-3 gap-3">
            {PILLARS.map((pillar) => (
              <div key={pillar.title} className={`rounded-2xl border p-4 ${pillar.tone}`}>
                <div className="inline-flex items-center gap-2 text-sm font-semibold">
                  {pillar.icon}
                  {pillar.title}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-300">{pillar.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1.4fr,1fr] gap-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-7">
            <h2 className="text-2xl font-bold text-white">How The Guided Process Works</h2>
            <p className="mt-2 text-sm text-slate-400">
              The flow is designed so non-specialists can still produce credible forecasting output.
            </p>

            <div className="mt-6 space-y-4">
              {PROCESS.map((item) => (
                <div key={item.step} className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl border border-teal-800 bg-teal-900/20 text-teal-300 flex items-center justify-center">
                      {item.icon}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-teal-400">Step {item.step}</p>
                      <p className="text-sm font-semibold text-white">{item.title}</p>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-400 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="inline-flex items-center gap-2 text-teal-300 font-semibold text-sm">
                <Bot className="w-4 h-4" />
                AI Chat Assistant
              </div>
              <h3 className="mt-3 text-xl font-bold text-white">
                A second opinion while users work.
              </h3>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                The built-in chatbot helps users interpret steps, break down choices, and sanity-check decisions. It is
                there to reduce uncertainty and keep people moving when they are unsure what to do next.
              </p>
              <div className="mt-4 rounded-2xl border border-slate-700 bg-slate-800/40 p-3">
                <p className="text-xs text-slate-300 inline-flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5 text-teal-300" />
                  Example support
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  &ldquo;What does RMSE tell me here?&rdquo; • &ldquo;Should I include this driver?&rdquo; •
                  &ldquo;How do I explain this chart to non-technical stakeholders?&rdquo;
                </p>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6">
              <div className="inline-flex items-center gap-2 text-blue-300 font-semibold text-sm">
                <Share2 className="w-4 h-4" />
                Social Storytelling
              </div>
              <h3 className="mt-3 text-xl font-bold text-white">From model output to shareable narrative.</h3>
              <p className="mt-3 text-sm text-slate-400 leading-relaxed">
                PredictPal includes a notebook-style publish stage. Users can combine explanatory text with charts,
                then post to Explore as a readable feed entry. The goal is not just prediction, but communication.
              </p>
            </div>

            <div className="rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-950 p-6">
              <h3 className="text-lg font-bold text-white">Built for LeedsHack 2026, aimed beyond it.</h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                This started as a hackathon build and is evolving into a practical forecasting UX that can support real
                teams, real reporting workflows, and accessible analytics education.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/create"
                  className="inline-flex items-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-500 px-4 py-2.5 text-sm font-semibold text-white transition"
                >
                  Start Building
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/explore"
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/70 hover:bg-slate-800 px-4 py-2.5 text-sm font-semibold text-slate-200 transition"
                >
                  View Explore Feed
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

