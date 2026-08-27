import ResponsiveNav from "@/src/components/navigation/ResponsiveNav";
import Footer from "@/src/components/home/Footer";
import Features from "@/src/components/home/Features";
import FinalCTA from "@/src/components/home/FinalCTA";
import WorkflowSteps from "@/src/components/how-it-works/WorkflowSteps";
import AnalyticsShowcase from "@/src/components/features/AnalyticsShowcase";

export default function FeaturesPage() {
  return (
    <main className="features-page min-h-screen overflow-hidden bg-[#08081f] text-white">
      <ResponsiveNav />
      <section className="relative px-6 pb-10 pt-28 sm:pb-14 sm:pt-36 lg:px-10 lg:pt-40">
        <div className="pointer-events-none absolute left-1/2 top-8 h-80 w-[min(80vw,58rem)] -translate-x-1/2 rounded-full bg-violet-600/15 blur-[130px]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 opacity-35 [background-image:linear-gradient(rgba(111,95,220,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(111,95,220,0.12)_1px,transparent_1px)] [background-size:56px_56px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <span className="inline-flex rounded-full border border-violet-400/25 bg-violet-500/10 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-200">Features</span>
          <h1 className="mt-6 text-4xl font-bold leading-[1.05] tracking-[-0.055em] text-white sm:text-6xl lg:text-7xl">Everything you need to <span className="bg-linear-to-r from-[#b83cff] via-[#8065ff] to-[#4ca8ff] bg-clip-text text-transparent">track, understand,</span> and <span className="bg-linear-to-r from-[#8065ff] to-[#4ca8ff] bg-clip-text text-transparent">improve.</span></h1>
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-white/55 sm:text-base">TrackUp combines controlled video sharing, ClickUp-connected access, provider-aware playback evidence, and scoped analytics so teams can learn from what their data actually shows.</p>
        </div>
      </section>

      <Features showIntegration={false} />
      <AnalyticsShowcase />

      <section className="px-6 pb-2 pt-4 lg:px-10">
        <div className="mx-auto max-w-4xl text-center"><p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-300/75">How it works</p><h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">Simple. Fast. Evidence-led.</h2><p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/45">One connected path from adding a source to reviewing the persisted viewer and session record.</p></div>
      </section>
      <WorkflowSteps />
      <FinalCTA title="Ready to unlock the power of video insights?" description="Join teams using TrackUp to share, understand, and improve video engagement." />
      <Footer />
    </main>
  );
}
