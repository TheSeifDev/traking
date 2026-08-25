import { Check, Link2 } from "lucide-react";
import Image from "next/image";

// تعريف المكونات المفقودة وإعدادها للتصدير
export const ClickUpIcon = ({ size = 24 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M6.2 9.4L12 5l5.8 4.4" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5.5 13.2c.8 3.2 3.2 5.3 6.5 5.3s5.7-2.1 6.5-5.3" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

const ClickUpWordmark = () => (
  <svg width="90" height="24" viewBox="0 0 90 24" fill="none" aria-hidden="true">
    <path d="M6.2 9.4L12 5l5.8 4.4" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5.5 13.2c.8 3.2 3.2 5.3 6.5 5.3s5.7-2.1 6.5-5.3" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
    <text x="26" y="17" fontFamily="Arial, sans-serif" fontSize="16" fontWeight="bold" fill="white">ClickUp</text>
  </svg>
);

const benefits = [
  "Connect your workspace",
  "Keep video links in workspace context",
  "Review measured engagement where supported",
];

const ClickUpIntegration = () => {
  return (
    <div id="integrations" className="relative mt-11 overflow-hidden rounded-[28px] border border-[#38357d] bg-[#101034]/80 px-7 py-9 lg:px-12 lg:py-10">
      {/* Background Glow */}
      <div className="pointer-events-none absolute left-[15%] top-1/2 h-75 w-75 -translate-y-1/2 rounded-full bg-[#4634ff]/10 blur-[100px]" />

      <div className="relative z-10 grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        {/* ================= VISUAL ================= */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-4 sm:gap-7">
            {/* ClickUp */}
            <div className="flex h-31.25 w-31.25 items-center justify-center rounded-[24px] border border-[#5545d8] bg-[#17174c] text-white shadow-[0_0_35px_rgba(88,62,255,0.15)]">
              <ClickUpIcon size={65} />
            </div>

            {/* Connection */}
            <div className="flex h-15 w-15 shrink-0 items-center justify-center rounded-full border border-[#654fff] bg-[#29177c] text-[#b39aff] shadow-[0_0_25px_rgba(101,79,255,0.35)]">
              <Link2 size={27} />
            </div>

            {/* TrackUp Logo */}
            <div className="flex h-31.25 w-31.25 items-center justify-center rounded-[24px] border border-[#5545d8] bg-[#17174c] p-3 shadow-[0_0_35px_rgba(88,62,255,0.15)]">
              <Image
                src="/logo.webp"
                alt="TrackUp"
                width={100}
                height={100}
                priority
                className="h-auto w-full object-contain"
              />
            </div>
          </div>
        </div>

        {/* ================= CONTENT ================= */}
        <div>
          {/* Heading */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold tracking-[0.22em] text-[#a477ff]">
              BUILT FOR TEAMS USING
            </span>
            <ClickUpWordmark />
          </div>

          {/* Description */}
          <p className="mt-4 max-w-170 text-[15px] leading-6 text-white/65">
            Enhance your ClickUp workspace with provider-aware video tracking.
            Share internal viewer links, keep access scoped, and review real
            engagement evidence where the source supports measurement.
          </p>

          {/* Benefits */}
          <div className="mt-7 flex flex-wrap gap-x-8 gap-y-4">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-2 text-sm text-white/75">
                <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#6657df] text-[#8e7cff]">
                  <Check size={14} />
                </span>
                {benefit}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClickUpIntegration;