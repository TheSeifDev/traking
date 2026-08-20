import Image from "next/image";
import { Link2 } from "lucide-react";
import ClickUpLogo from "./ClickUpLogo";

const PARTICLES = [
  { left: "18%", top: "36%", size: 3, opacity: 0.65 },
  { left: "29%", top: "24%", size: 2, opacity: 0.45 },
  { left: "41%", top: "46%", size: 2, opacity: 0.75 },
  { left: "59%", top: "30%", size: 3, opacity: 0.55 },
  { left: "72%", top: "42%", size: 2, opacity: 0.7 },
  { left: "83%", top: "21%", size: 2, opacity: 0.4 },
] as const;

const IntegrationVisual = () => (
  <div aria-hidden="true" className="pointer-events-none relative h-98 min-w-0 select-none">
    {/* Ambient light and rising energy beams */}
    <div className="absolute bottom-20 left-1/2 h-72 w-80 -translate-x-1/2 rounded-full bg-violet-600/20 blur-[90px]" />
    <div className="absolute bottom-29 left-1/2 h-60 w-72 -translate-x-1/2 bg-linear-to-t from-violet-600/25 via-violet-500/8 to-transparent blur-xl [clip-path:polygon(28%_0,72%_0,100%_100%,0_100%)]" />

    {/* Perspective grid floor */}
    <div className="absolute bottom-0 left-1/2 h-56 w-130 -translate-x-1/2 overflow-hidden opacity-65 mask-[linear-gradient(to_top,black_48%,transparent_100%)]">
      <div className="absolute inset-x-0 bottom-0 h-64 origin-bottom bg-[linear-gradient(rgba(139,92,246,0.2)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.2)_1px,transparent_1px)] bg-size-[38px_38px] transform-[perspective(360px)_rotateX(58deg)_scale(1.18)]" />
    </div>

    {/* Small light particles */}
    {PARTICLES.map((particle, index) => (
      <span
        key={`${particle.left}-${particle.top}`}
        className="absolute rounded-full bg-violet-300 shadow-[0_0_9px_rgba(196,181,253,0.95)]"
        style={{
          left: particle.left,
          top: particle.top,
          width: particle.size,
          height: particle.size,
          opacity: particle.opacity,
          animationDelay: `${index * 180}ms`,
        }}
      />
    ))}

    {/* Light running from the connection down to the platform */}
    <div className="absolute left-1/2 top-31 h-26 w-px -translate-x-1/2 bg-linear-to-b from-violet-300/80 via-violet-500/45 to-transparent shadow-[0_0_12px_rgba(167,139,250,0.75)]" />

    {/* TrackUp tile */}
    <div className="absolute left-4 top-0 flex h-40 w-32 items-center justify-center rounded-3xl border border-violet-400/65 bg-[#08091d]/95 shadow-[0_0_38px_rgba(124,58,237,0.28)] ring-1 ring-violet-500/10 backdrop-blur-xl 2xl:h-44 2xl:w-37">
      <Image
        src="/logo.webp"
        alt=""
        width={96}
        height={96}
        sizes="96px"
        className="h-auto w-20 object-contain drop-shadow-[0_0_18px_rgba(139,92,246,0.38)] 2xl:w-23"
      />
    </div>

    {/* ClickUp tile */}
    <div className="absolute right-4 top-0 flex h-40 w-32 items-center justify-center rounded-3xl border border-violet-400/65 bg-[#08091d]/95 shadow-[0_0_38px_rgba(124,58,237,0.28)] ring-1 ring-violet-500/10 backdrop-blur-xl 2xl:h-44 2xl:w-37">
      <ClickUpLogo
        gradientId="integration-clickup"
        className="size-20 drop-shadow-[0_0_18px_rgba(168,85,247,0.3)] 2xl:size-24"
      />
    </div>

    {/* Horizontal connection lines */}
    <div className="absolute right-1/2 left-36 top-20 h-px bg-linear-to-r from-violet-500/25 to-violet-300 shadow-[0_0_8px_rgba(167,139,250,0.9)] 2xl:left-41 2xl:top-23" />
    <div className="absolute right-36 left-1/2 top-20 h-px bg-linear-to-l from-violet-500/25 to-violet-300 shadow-[0_0_8px_rgba(167,139,250,0.9)] 2xl:right-41 2xl:top-23" />

    {/* Connection node */}
    <div className="absolute left-1/2 top-12 z-10 flex size-16 -translate-x-1/2 items-center justify-center rounded-full border border-violet-300/80 bg-violet-600/65 shadow-[0_0_34px_rgba(124,58,237,0.95)] ring-4 ring-violet-500/10 backdrop-blur-md 2xl:top-14 2xl:size-18">
      <Link2 className="size-7 text-white 2xl:size-8" strokeWidth={2} />
    </div>

    {/* Floating platform */}
    <div className="absolute bottom-24 left-1/2 h-16 w-96 -translate-x-1/2 rounded-[50%] border border-violet-500/45 bg-violet-950/15 shadow-[0_0_34px_rgba(99,48,255,0.38)]" />
    <div className="absolute bottom-28 left-1/2 h-20 w-78 -translate-x-1/2 rounded-[50%] border border-violet-300/90 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.3)_0%,rgba(139,92,246,0.7)_32%,rgba(91,33,182,0.92)_70%)] shadow-[0_0_42px_rgba(124,58,237,0.95),inset_0_8px_22px_rgba(255,255,255,0.18)]" />
    <div className="absolute bottom-35 left-1/2 h-8 w-64 -translate-x-1/2 rounded-[50%] bg-violet-300/25 blur-lg" />
  </div>
);

export default IntegrationVisual;