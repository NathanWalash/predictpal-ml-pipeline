import { Heart, Github, Lightbulb, Users, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <section className="max-w-3xl mx-auto px-6 pt-16 pb-24">
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-purple-900/30 border border-purple-800 rounded-full text-purple-400 text-sm font-medium mb-6">
            <Heart className="w-4 h-4" />
            About the Project
          </div>
          <h1 className="text-4xl font-bold text-white">ForecastBuddy</h1>
          <p className="mt-3 text-slate-400 max-w-lg mx-auto">
            An open-source forecasting workbench built for accessibility,
            learning, and sharing.
          </p>
        </div>

        {/* Mission */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-teal-900/50 border border-teal-800 flex items-center justify-center text-teal-400">
              <Lightbulb className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white">Our Mission</h2>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Forecasting shouldn&apos;t require a PhD. ForecastBuddy lowers the
            barrier to time-series prediction by guiding users through every
            step — from uploading raw CSV data to publishing polished,
            shareable reports. Whether you&apos;re a student, analyst, or
            domain expert, you can build, compare, and communicate forecasts
            without writing a single line of code.
          </p>
        </div>

        {/* Tech Stack */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 mb-8">
          <h2 className="text-xl font-bold text-white mb-4">Tech Stack</h2>
          <div className="grid grid-cols-2 gap-3">
            {[
              { name: "Next.js", detail: "React framework, App Router" },
              { name: "Tailwind CSS", detail: "Utility-first styling" },
              { name: "FastAPI", detail: "Python async backend" },
              { name: "skforecast", detail: "Time-series ML engine" },
              { name: "Zustand", detail: "Lightweight state management" },
              { name: "Recharts", detail: "Data visualisation" },
            ].map((t) => (
              <div
                key={t.name}
                className="rounded-xl bg-slate-800/60 border border-slate-700 px-4 py-3"
              >
                <span className="text-sm font-semibold text-white">
                  {t.name}
                </span>
                <span className="block text-xs text-slate-500 mt-0.5">
                  {t.detail}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Team / Credits */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-blue-900/50 border border-blue-800 flex items-center justify-center text-blue-400">
              <Users className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-white">Built At</h2>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Created during <strong className="text-slate-200">LeedsHack 2026</strong>.
            ForecastBuddy is a hackathon prototype exploring how guided UX
            patterns can make advanced analytics more approachable.
          </p>
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <Link
            href="/build"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-teal-900/40"
          >
            Start Building
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>
    </div>
  );
}
