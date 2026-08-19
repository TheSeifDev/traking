import { BarChart3, PlaySquare, ShieldCheck } from "lucide-react";
import type { ElementType } from "react";
import ClickUpIntegration, { ClickUpIcon } from "./ClickUpIntegration";

const features: {
  title: string;
  description: string;
  icon: ElementType | string;
  iconClass?: string;
}[] = [
  {
    title: "Precise Video Tracking",
    description:
      "Know exactly who watched what, when, how many times and which parts — with second-level accuracy.",
    icon: PlaySquare,
    iconClass: "text-[#6366ff]",
  },
  {
    title: "Native ClickUp Integration",
    description:
      "Link videos to ClickUp tasks and track learning progress across your team — in one place.",
    icon: "clickup",
  },
  {
    title: "Powerful Analytics",
    description:
      "Get clear insights with beautiful charts, heatmaps and engagement metrics.",
    icon: BarChart3,
    iconClass: "text-[#6366ff]",
  },
  {
    title: "Simple & Secure",
    description:
      "Login with your ClickUp account. Your data is protected and always stays under your control.",
    icon: ShieldCheck,
    iconClass: "text-[#5d9cff]",
  },
];

const Features = () => {
  return (
    <section id="features" className="relative px-6 py-16 lg:px-10">
      <div className="mx-auto max-w-360">
        {/* Feature Cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature) => {
            const Icon = typeof feature.icon === "string" ? null : feature.icon;
            return (
              <div
                key={feature.title}
                className="group flex min-h-60 flex-col items-center rounded-2xl border border-[#30306c] bg-[#0d0d2c]/70 px-6 py-5 text-center backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:border-[#5149a8] hover:bg-[#11113a]"
              >
                {/* Icon */}
                <div className="mb-3 flex h-19 w-19 items-center justify-center rounded-2xl border border-[#302d7b] bg-linear-to-br from-[#171750] to-[#24145a] shadow-[0_0_30px_rgba(91,65,255,0.12)]">
                  {Icon ? (
                    <Icon size={38} strokeWidth={1.8} className={feature.iconClass} />
                  ) : (
                    <ClickUpIcon size={38} />
                  )}
                </div>

                {/* Title */}
                <h3 className="text-[17px] font-semibold text-white">
                  {feature.title}
                </h3>

                {/* Description */}
                <p className="mt-2 max-w-67.5 text-sm leading-[1.45] text-white/65">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* ClickUp Integration */}
        <ClickUpIntegration />
      </div>
    </section>
  );
};

export default Features;