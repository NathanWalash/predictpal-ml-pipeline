import Link from "next/link";
import { BarChart3, Upload, Cpu, FileText, Search, Trophy } from "lucide-react";

const CAPABILITIES = [
  {
    icon: "🔨",
    title: "Build",
    description: "Upload your data, configure processing pipelines, train models, and generate reports — all in one guided workflow.",
    color: "border-teal-800 bg-teal-900/20",
  },
  {
    icon: "🔍",
    title: "Explore",
    description: "Browse published forecasting projects from the community. Learn from others' approaches and insights.",
    color: "border-blue-800 bg-blue-900/20",
  },
  {
    icon: "🏆",
    title: "Showcase",
    description: "Publish your forecasting outcomes. Share your methodology, results, and narrative with the world.",
    color: "border-purple-800 bg-purple-900/20",
  },
];

export default function Home() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      {/* Hero */}
      <section className="max-w-5xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-teal-900/30 border border-teal-800 rounded-full text-teal-400 text-sm font-medium mb-8">
          <BarChart3 className="w-4 h-4" />
          Time-Series Forecasting Workbench
        </div>

        <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight tracking-tight">
          Forecast smarter,
          <br />
          <span className="text-teal-400">not harder.</span>
        </h1>

        <p className="mt-6 text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
          A guided workbench that takes you from raw data to publishable forecasts.
          Upload, process, train, and share — step by step.
        </p>

        <div className="mt-10 flex items-center justify-center gap-4">
          <Link
            href="/build"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-teal-900/40 hover:shadow-teal-900/60"
          >
            <Upload className="w-4 h-4" />
            Start Building
          </Link>
          <Link
            href="/explore"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl border border-slate-700 transition-all"
          >
            <Search className="w-4 h-4" />
            Explore Projects
          </Link>
        </div>
      </section>

      {/* Capabilities */}
      <section className="max-w-5xl mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CAPABILITIES.map((cap) => (
            <div
              key={cap.title}
              className={`rounded-2xl border p-8 ${cap.color} transition-all hover:scale-[1.02]`}
            >
              <span className="text-4xl">{cap.icon}</span>
              <h3 className="mt-4 text-xl font-bold text-white">
                {cap.title}
              </h3>
              <p className="mt-2 text-sm text-slate-400 leading-relaxed">
                {cap.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="border-t border-slate-800 bg-[#0d1117]">
        <div className="max-w-5xl mx-auto px-6 py-20">
          <h2 className="text-3xl font-bold text-white text-center mb-12">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {[
              { step: 1, icon: <Upload className="w-5 h-5" />, label: "Upload Data" },
              { step: 2, icon: <Cpu className="w-5 h-5" />, label: "Process" },
              { step: 3, icon: <BarChart3 className="w-5 h-5" />, label: "Train & Forecast" },
              { step: 4, icon: <FileText className="w-5 h-5" />, label: "Build Report" },
              { step: 5, icon: <Trophy className="w-5 h-5" />, label: "Showcase" },
            ].map((s) => (
              <div key={s.step} className="flex flex-col items-center text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-teal-400 mb-3">
                  {s.icon}
                </div>
                <span className="text-xs text-teal-500 font-bold">Step {s.step}</span>
                <span className="text-sm font-medium text-slate-300 mt-1">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
