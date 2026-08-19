import { Check } from "lucide-react";

type IntegrationCardProps = {
  name: string;
  icon: React.ReactNode;
  description: string;
  features: string[];
  connected?: boolean;
};

const IntegrationCard = ({
  name,
  icon,
  description,
  features,
  connected = false,
}: IntegrationCardProps) => {
  return (
    <div className="group rounded-xl border border-white/9 bg-white/1.5 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-[#7040ff]/30 hover:bg-[#5424ff]/[0.035]">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/4">
        {icon}
      </div>

      <h3 className="mt-5 text-sm font-semibold">{name}</h3>
      <p className="mt-3 min-h-12 text-xs leading-5 text-white/50">{description}</p>

      <div className="mt-5 space-y-2.5">
        {features.map((feature) => (
          <div key={feature} className="flex items-center gap-2 text-[10px] text-white/60">
            <Check size={13} className="text-[#9b63ff]" />
            {feature}
          </div>
        ))}
      </div>

      <div
        className={`mt-5 flex h-8 items-center justify-center rounded-md border text-[10px] ${
          connected
            ? "border-emerald-500/10 bg-emerald-500/4 text-emerald-400"
            : "border-white/10 text-white/60"
        }`}
      >
        {connected ? "●  Connected" : "◌  Connect"}
      </div>
    </div>
  );
};

export default IntegrationCard;