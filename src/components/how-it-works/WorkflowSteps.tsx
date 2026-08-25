import { BarChart3, Link2, Play, Users } from "lucide-react";

const steps = [
  { number: "1", icon: Link2, title: "Add Video", description: "Add YouTube, Vimeo, direct media, Google Drive, or Telegram sources." },
  { number: "2", icon: Users, title: "Assign & Share", description: "Create a scoped Watch Link or connect the video to an authorized ClickUp workflow." },
  { number: "3", icon: Play, title: "Track Engagement", description: "Persist sessions and player events only when the provider exposes reliable telemetry." },
  { number: "4", icon: BarChart3, title: "Get Insights", description: "Review viewer, video, and session analytics with unavailable states kept explicit." },
];

const WorkflowSteps = () => {
  return (
    <section className="relative px-6 pb-20 pt-6 md:px-10 md:pb-24">
      <div className="mx-auto max-w-7xl">
        <div className="relative grid gap-12 md:grid-cols-4 md:gap-0">
          <div className="pointer-events-none absolute left-[12%] right-[12%] top-10.75 hidden border-t border-dashed border-[#8b4dff]/50 md:block" />
          {steps.map(({ number, icon: Icon, title, description }) => (
            <div key={number} className="relative z-10 flex flex-col items-center text-center">
              <div className="relative">
                <div className="flex h-21.5 w-21.5 items-center justify-center rounded-full border border-[#713cff]/50 bg-[#0d1030] shadow-[0_0_35px_rgba(112,55,255,0.16)]"><Icon size={30} strokeWidth={1.8} className="text-[#9c6cff]" /></div>
                <div className="absolute -right-1 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-[#7c45ff]/60 bg-[#111336] text-xs font-semibold text-white">{number}</div>
              </div>
              <h3 className="mt-6 text-sm font-semibold text-white md:text-base">{title}</h3>
              <p className="mt-3 max-w-55 text-xs leading-6 text-white/55 md:text-sm">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WorkflowSteps;
