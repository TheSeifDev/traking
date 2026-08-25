import Link from "next/link";
import { ArrowRight, Check, Rocket } from "lucide-react";

type FinalCTAProps = {
  title?: string;
  description?: string;
};

const FinalCTA = ({
  title = "Start Tracking Smarter Today",
  description = "Turn authorized viewing activity into provider-aware evidence where measurement is supported.",
}: FinalCTAProps) => {
  return (
    <section className="relative px-5 pb-12 pt-8 sm:px-6 sm:pb-16 sm:pt-10 lg:px-10">
      <div className="relative mx-auto max-w-[90rem] overflow-hidden rounded-2xl border border-[#343267] bg-[#0b0d29]/90 px-6 py-9 text-center shadow-[0_22px_70px_rgba(0,0,0,0.2)] sm:px-10 sm:py-11">
        <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-[min(70vw,42rem)] -translate-x-1/2 rounded-full bg-violet-600/12 blur-[100px]" />
        <div className="relative mx-auto max-w-3xl">
          <div className="mx-auto flex size-11 items-center justify-center rounded-xl border border-violet-300/20 bg-violet-500/10 text-violet-200 shadow-[0_0_28px_rgba(105,65,255,0.18)]">
            <Rocket size={19} />
          </div>
          <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.26em] text-violet-300/75">Start with TrackUp</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-[-0.045em] text-white sm:text-3xl">{title}</h2>
          <p className="mx-auto mt-3 max-w-2xl text-xs leading-5 text-white/45 sm:text-sm">{description}</p>
          <Link href="/login" className="mt-6 inline-flex h-11 items-center gap-2 rounded-xl bg-linear-to-r from-[#8b3dff] to-[#5d4cff] px-5 text-sm font-semibold text-white shadow-[0_8px_30px_rgba(105,65,255,0.3)] transition hover:-translate-y-0.5 hover:shadow-[0_12px_38px_rgba(105,65,255,0.42)] active:scale-[0.98]">
            Continue with ClickUp
            <ArrowRight size={16} />
          </Link>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[10px] text-white/45">
            <TrustPoint text="Start with your ClickUp account" />
            <TrustPoint text="Provider-aware measurement" />
            <TrustPoint text="Scoped viewer links" />
          </div>
        </div>
      </div>
    </section>
  );
};

const TrustPoint = ({ text }: { text: string }) => (
  <div className="flex items-center gap-1.5">
    <Check size={12} strokeWidth={2} className="text-violet-200/80" />
    <span>{text}</span>
  </div>
);

export default FinalCTA;
