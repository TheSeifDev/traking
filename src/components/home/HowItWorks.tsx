import { BarChart3, Link2, Play, type LucideIcon } from "lucide-react";
import { ClickUpIcon } from "./ClickUpIntegration";

type Step = {
  number: string;
  title: string;
  description: string;
  icon: LucideIcon | "clickup";
};

const steps: Step[] = [
  {
    number: "1",
    title: "Login with ClickUp",
    description: "Use your existing ClickUp account to enter your workspace.",
    icon: "clickup",
  },
  {
    number: "2",
    title: "Assign & Share",
    description: "Add a source, then create a scoped Watch Link for viewers.",
    icon: Link2,
  },
  {
    number: "3",
    title: "Track Engagement",
    description: "Persist sessions and playback events where the provider supports them.",
    icon: Play,
  },
  {
    number: "4",
    title: "Get Insights",
    description: "Review viewer, video, and session evidence with limits kept explicit.",
    icon: BarChart3,
  },
];

function StepIcon({ icon }: { icon: Step["icon"] }) {
  if (icon === "clickup") return <ClickUpIcon size={25} />;
  const Icon = icon;
  return <Icon size={24} strokeWidth={1.8} />;
}

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="relative px-5 pb-10 pt-10 sm:px-6 sm:pb-14 sm:pt-14 lg:px-10 lg:pb-20">
      <div className="mx-auto max-w-[90rem]">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-violet-300/75">How it works</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.045em] text-white sm:text-3xl">
            Simple. Fast. <span className="bg-linear-to-r from-[#b83cff] via-[#8065ff] to-[#4ca8ff] bg-clip-text text-transparent">Evidence-led.</span>
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-xs leading-5 text-white/45 sm:text-sm">
            One connected path from adding a source to reviewing the persisted viewer and session record.
          </p>
        </div>

        <div className="relative grid gap-7 md:grid-cols-4 md:gap-4">
          <div className="pointer-events-none absolute left-[12.5%] right-[12.5%] top-7 hidden border-t border-dashed border-violet-400/35 md:block" />
          {steps.map((step) => (
            <article key={step.number} className="relative z-10 flex flex-col items-center text-center">
              <div className="relative flex size-14 items-center justify-center rounded-full border border-violet-400/45 bg-[#0b1030] text-violet-200 shadow-[0_0_28px_rgba(105,65,255,0.2)]">
                <StepIcon icon={step.icon} />
                <span className="absolute -right-1 -top-3 flex size-6 items-center justify-center rounded-full border border-violet-400/35 bg-[#171052] text-[10px] font-semibold text-white">
                  {step.number}
                </span>
              </div>
              <h3 className="mt-4 text-[12px] font-semibold text-white">{step.title}</h3>
              <p className="mt-2 max-w-44 text-[10px] leading-4 text-white/45">{step.description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
