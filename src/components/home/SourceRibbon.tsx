import { Cloud, PlaySquare, Send } from "lucide-react";
import { ClickUpIcon } from "./ClickUpIntegration";

const sources = [
  { label: "ClickUp", icon: <ClickUpIcon size={18} /> },
  { label: "YouTube", icon: <PlaySquare size={17} strokeWidth={1.8} /> },
  { label: "Vimeo", icon: <span className="text-[15px] font-semibold leading-none">v</span> },
  { label: "Google Drive", icon: <Cloud size={18} strokeWidth={1.7} /> },
  { label: "Telegram", icon: <Send size={16} strokeWidth={1.8} /> },
];

export default function SourceRibbon() {
  return (
    <section className="px-5 pb-4 pt-2 sm:px-6 sm:pb-6 lg:px-10">
      <div className="mx-auto max-w-4xl text-center">
        <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-white/30">Connect sources your team already uses</p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-7 gap-y-3 text-white/35 sm:gap-x-10">
          {sources.map(({ label, icon }) => (
            <div key={label} className="flex items-center gap-2 text-[11px] font-medium tracking-wide transition-colors hover:text-white/60">
              <span className="flex size-6 items-center justify-center text-violet-200/65">{icon}</span>
              {label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
