import { Clock3, Lock, Target, Users } from "lucide-react";

const benefits = [
  { icon: Target, title: "Know What Works", description: "See which videos engage your audience and which parts matter most." },
  { icon: Clock3, title: "Save Time", description: "Automate tracking and reporting so you can focus on creating better content." },
  { icon: Users, title: "Improve Learning", description: "Understand how your team learns and optimize training effectiveness." },
  { icon: Lock, title: "Secure & Private", description: "Your data is encrypted and always protected. We respect your privacy." },
];

const WhyItMatters = () => {
  return (
    <section className="px-6 pb-24 md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#a66cff]">
            Why It Matters
          </span>
          <h2 className="mt-3 text-2xl font-bold md:text-3xl">Better Tracking. Better Results.</h2>
          <p className="mt-3 text-sm text-white/55">
            TrackUp helps teams save time, improve learning, and get real results.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {benefits.map((benefit) => {
            const Icon = benefit.icon;
            return (
              <div
                key={benefit.title}
                className="group rounded-xl border border-white/8 bg-white/[0.018] px-6 py-7 text-center transition-all duration-300 hover:-translate-y-1 hover:border-[#7542ff]/30 hover:bg-[#5424ff]/4"
              >
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#7542ff]/30 bg-[#5424ff]/10">
                  <Icon size={21} className="text-[#9c6cff]" />
                </div>
                <h3 className="mt-5 text-sm font-semibold">{benefit.title}</h3>
                <p className="mt-3 text-xs leading-6 text-white/50">{benefit.description}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default WhyItMatters;