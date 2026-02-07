import { Search, BarChart3, TrendingUp, Users } from "lucide-react";

const MOCK_PROJECTS = [
  {
    title: "Weekly Sales Forecast",
    author: "demo_user",
    tags: ["retail", "weekly", "gradient-boost"],
    description: "Predicting weekly sales volumes for 50 retail stores using external drivers including promotions and holidays.",
  },
  {
    title: "Energy Demand Prediction",
    author: "forecast_fan",
    tags: ["energy", "hourly", "linear"],
    description: "Hourly energy demand forecasting for a regional grid operator using temperature and calendar features.",
  },
  {
    title: "Hospital Admissions",
    author: "health_data",
    tags: ["healthcare", "daily", "multivariate"],
    description: "Daily hospital admission forecasts incorporating flu trends, weather, and historical patterns.",
  },
  {
    title: "Stock Inventory Levels",
    author: "supply_pro",
    tags: ["supply-chain", "monthly", "baseline"],
    description: "Monthly inventory level forecasting for warehouse optimisation across 12 product categories.",
  },
];

export default function ExplorePage() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <section className="max-w-5xl mx-auto px-6 pt-16 pb-10">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-blue-900/30 border border-blue-800 rounded-full text-blue-400 text-sm font-medium mb-6">
            <Search className="w-4 h-4" />
            Community Projects
          </div>
          <h1 className="text-4xl font-bold text-white">Explore</h1>
          <p className="mt-3 text-slate-400 max-w-lg mx-auto">
            Browse published forecasting projects from the community.
            Learn from others&apos; approaches and results.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-10">
          {[
            { icon: <BarChart3 className="w-5 h-5" />, value: "24", label: "Published Projects" },
            { icon: <Users className="w-5 h-5" />, value: "12", label: "Contributors" },
            { icon: <TrendingUp className="w-5 h-5" />, value: "6", label: "Trending" },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 text-center"
            >
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-slate-800 text-teal-400 mb-2">
                {s.icon}
              </div>
              <div className="text-2xl font-bold text-white">{s.value}</div>
              <div className="text-xs text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Project Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {MOCK_PROJECTS.map((project) => (
            <div
              key={project.title}
              className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 hover:border-slate-700 transition-all group cursor-pointer"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-semibold text-white group-hover:text-teal-400 transition">
                  {project.title}
                </h3>
                <span className="text-xs text-slate-500">@{project.author}</span>
              </div>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                {project.description}
              </p>
              <div className="flex flex-wrap gap-2">
                {project.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 rounded-full bg-slate-800 text-xs text-slate-400 border border-slate-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <p className="text-slate-500 text-sm italic">
            More projects coming soon. Build and publish yours to appear here!
          </p>
        </div>
      </section>
    </div>
  );
}
