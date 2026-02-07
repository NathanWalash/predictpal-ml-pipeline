export default function TermsPage() {
  return (
    <div className="min-h-[calc(100vh-4rem)]">
      <section className="max-w-4xl mx-auto px-6 pt-14 pb-16 space-y-6">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 md:p-8">
          <h1 className="text-3xl font-bold text-white">Terms & Conditions</h1>
          <p className="mt-3 text-sm text-slate-400 leading-relaxed">
            PredictPal is currently provided as a demo/prototype environment. By using this application, you agree
            that forecasting outputs are informational and should be reviewed before production decision-making.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6 md:p-8 space-y-4">
          <h2 className="text-xl font-semibold text-white">Use of Service</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            You are responsible for the datasets you upload and for any decisions based on generated forecasts.
            Do not upload data you are not authorized to process.
          </p>

          <h2 className="text-xl font-semibold text-white">Data and Content</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Published stories and charts may be visible in the Explore feed depending on environment configuration.
            Avoid sharing sensitive, regulated, or personal data in demo environments.
          </p>

          <h2 className="text-xl font-semibold text-white">No Warranty</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Forecast accuracy is not guaranteed. Model outputs are estimates and may be incorrect or incomplete.
          </p>

          <h2 className="text-xl font-semibold text-white">Changes</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            These terms may be updated as the project evolves from prototype to production.
          </p>
        </div>
      </section>
    </div>
  );
}

