import { Fragment, type ReactNode } from "react";
import { BarChart3, Play } from "lucide-react";
import { ClickUpIcon } from "./ClickUpIntegration";

type StepType = "clickup" | "play" | "analytics";

interface Step {
  number: string;
  title: string;
  description: ReactNode;
  type: StepType;
}

const steps: Step[] = [
  {
    number: "1",
    title: "Login with ClickUp",
    description: (
      <>
        Use your existing ClickUp account.
        <br />
        No separate register needed.
      </>
    ),
    type: "clickup",
  },
  {
    number: "2",
    title: "Add & Share Videos",
    description: (
      <>
        Send YouTube, Drive, Telegram or
        <br className="hidden sm:block" />
        upload your own videos.
      </>
    ),
    type: "play",
  },
  {
    number: "3",
    title: "Track & Analyze",
    description: (
      <>
        See exactly who watched, when, how
        <br className="hidden sm:block" />
        much and which parts — with detailed
        insights.
      </>
    ),
    type: "analytics",
  },
];

// Icon per step type, kept data-driven so the card markup below has no branching.
const STEP_ICONS: Record<StepType, ReactNode> = {
  clickup: <ClickUpIcon size={48} />,
  play: (
    <div className="flex size-12 items-center justify-center rounded-full border-[6px] border-[#a855f7] text-[#a855f7] sm:size-14 sm:border-[7px] md:size-14.5">
      <Play size={22} fill="currentColor" strokeWidth={0} className="ml-1 sm:w-6 sm:h-6" />
    </div>
  ),
  analytics: (
    <BarChart3 size={48} strokeWidth={2.5} className="text-[#9864ff]" />
  ),
};

/** Dashed line + two glow points connecting the three cards from md upward. */
const DesktopConnector = () => (
  <>
    <div className="absolute left-[16.66%] right-[16.66%] top-17.5 hidden h-px border-t border-dashed border-[#7655ff]/70 md:block lg:top-20.5" />
  </>
);

/** Short dashed link shown between stacked cards on mobile only. */
const MobileConnector = () => (
  <div className="flex h-12 items-center justify-center md:hidden" aria-hidden="true">
    <div className="relative h-full w-px border-l-2 border-dashed border-[#7655ff]/50">
      <span className="absolute left-1/2 top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#a66cff] shadow-[0_0_18px_6px_rgba(142,92,255,0.55)]" />
    </div>
  </div>
);

const StepCard = ({ step }: { step: Step }) => (
  <div className="group relative flex flex-col items-center">
    {/* Icon circle */}
    <div className="relative z-20">

      {/* Number badge */}
      <div className="absolute -top-5 left-1/2 z-30 flex size-10 -translate-x-1/2 items-center justify-center rounded-full border border-[#7048e8] bg-[#171052] text-sm font-semibold text-white shadow-[0_0_20px_rgba(112,72,232,0.3)]">
        {step.number}
      </div>

      {/* Slow-rotating gradient ring behind a static icon */}
      <div className="relative size-28 sm:size-32 md:size-34.5">
        <div
          className="absolute inset-0 rounded-full opacity-70 [background:conic-gradient(from_0deg,#8065ff,#4ca8ff,#b83cff,#8065ff)] motion-safe:animate-[spin_9s_linear_infinite]"
          aria-hidden="true"
        />
        <div className="absolute inset-0.75 flex items-center justify-center rounded-full border border-[#754cff] bg-linear-to-br from-[#25205f] via-[#1c174d] to-[#121132] shadow-[0_0_35px_rgba(104,70,255,0.18)] transition-all duration-300 group-hover:border-[#9b6cff] group-hover:shadow-[0_0_45px_rgba(104,70,255,0.35)]">
          {STEP_ICONS[step.type]}
        </div>
      </div>

      {/* Glow under icon */}
      <div className="absolute -bottom-2 left-1/2 -z-10 h-8 w-24 -translate-x-1/2 rounded-full bg-[#7145ff]/50 opacity-50 blur-xl transition-opacity duration-300 group-hover:opacity-90" />
    </div>

    {/* Card */}
    <div className="relative -mt-7 w-full max-w-105 rounded-[22px] border border-white/10 bg-linear-to-b from-[#171743]/80 to-[#0d0d2b]/85 px-5 pb-7 pt-17.5 text-center shadow-[0_20px_60px_rgba(0,0,0,0.2)] backdrop-blur-xl transition-all duration-300 group-hover:-translate-y-1 group-hover:border-[#5745a5]/60 group-hover:shadow-[0_20px_70px_rgba(80,55,220,0.16)] sm:px-6 sm:pt-19.5">
      <h3 className="text-lg font-semibold tracking-tight text-white sm:text-xl">
        {step.title}
      </h3>

      <p className="mt-4 min-h-13 text-sm leading-6 text-white/60">
        {step.description}
      </p>
    </div>
  </div>
);

const HowItWorks = () => {
  return (
    <section id="how-it-works" className="relative overflow-hidden py-20 sm:py-28 lg:py-32">

      <div className="relative z-10 mx-auto max-w-360 px-6 lg:px-10">

        {/* Header */}
        <div className="mx-auto max-w-3xl text-center">

          <h2 className="text-4xl font-bold tracking-[-0.04em] text-white sm:text-5xl lg:text-[56px] lg:leading-[1.05]">
            How It{" "}
            <span className="bg-linear-to-r from-[#b83cff] via-[#8065ff] to-[#4ca8ff] bg-clip-text text-transparent">
              Works
            </span>
          </h2>

          <p className="mt-5 text-base text-white/60 sm:text-lg">
            Get started in minutes. No complex setup.
          </p>
        </div>

        {/* Steps */}
        <div className="relative mt-16 sm:mt-20">
          <DesktopConnector />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8 lg:gap-14">
            {steps.map((step, index) => (
              <Fragment key={step.number}>
                <StepCard step={step} />
                {index < steps.length - 1 && <MobileConnector />}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorks;