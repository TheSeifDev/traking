import { BarChart3, CheckCircle2, Grid2X2, Link2 } from "lucide-react";

const steps = [
  { icon: Grid2X2, title: "Connect your tools", description: "Link the platforms you already use." },
  { icon: Link2, title: "Sync your content", description: "Bring your videos and tasks together in TrackUp." },
  { icon: BarChart3, title: "Track & analyze", description: "Review persisted activity and provider-backed metrics." },
  { icon: CheckCircle2, title: "Improve & grow", description: "Use data to make smarter decisions and grow faster." },
];

const IntegrationWorkflow = () => {
  return (
    <section className="px-6 pb-16 md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center">
          <h2 className="text-xl font-bold md:text-2xl">
            Build your perfect workflow ✧
          </h2>
        </div>

        <div className="relative grid gap-10 md:grid-cols-4 md:gap-0">
          <div className="pointer-events-none absolute left-[12%] right-[12%] top-7 hidden border-t border-dashed border-[#7542ff]/40 md:block" />

          {steps.map((step) => {
            const Icon = step.icon;

            return (
              <div key={step.title} className="relative z-10 flex flex-col items-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#7845ff]/50 bg-[#101333] shadow-[0_0_25px_rgba(100,50,255,0.15)]">
                  <Icon size={20} className="text-[#9b65ff]" />
                </div>

                <h3 className="mt-5 text-xs font-semibold">{step.title}</h3>
                <p className="mt-2 max-w-45 text-[10px] leading-5 text-white/45">{step.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default IntegrationWorkflow;