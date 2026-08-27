import { ArrowLeft, ExternalLink, GitBranch, LifeBuoy, LogIn } from "lucide-react";
import Link from "next/link";
import ResponsiveNav from "@/src/components/navigation/ResponsiveNav";
import Footer from "@/src/components/home/Footer";

export default function ContactPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#08081f] text-white">
      <ResponsiveNav />
      <section className="relative px-6 pb-20 pt-32 sm:pt-40 lg:px-10">
        <div className="pointer-events-none absolute left-1/2 top-20 h-72 w-[min(80vw,56rem)] -translate-x-1/2 rounded-full bg-violet-600/15 blur-[120px]" />
        <div className="relative mx-auto max-w-3xl">
          <Link href="/faq" className="inline-flex items-center gap-2 text-xs text-violet-300 transition hover:text-violet-200"><ArrowLeft size={14} />Back to FAQ</Link>
          <div className="mt-8 rounded-3xl border border-white/9 bg-white/[0.03] p-7 shadow-[0_18px_60px_rgba(0,0,0,0.16)] sm:p-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-500/15 text-violet-200"><LifeBuoy size={22} /></div>
            <p className="mt-7 text-[10px] font-semibold uppercase tracking-[0.25em] text-violet-300/75">TrackUp support</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">How to get help</h1>
            <p className="mt-4 text-sm leading-7 text-white/55">TrackUp is maintained in the project repository. For implementation questions, route bugs, deployment problems, or documentation corrections, open an issue with the steps to reproduce and the affected TrackUp route.</p>
            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <a href="https://github.com/TheSeifDev/traking/issues" target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-violet-500"><GitBranch size={16} />Open GitHub Issues <ExternalLink size={14} /></a>
              <Link href="/login" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-semibold text-white/75 transition hover:border-white/20 hover:text-white"><LogIn size={16} />Return to sign in</Link>
            </div>
            <p className="mt-6 border-t border-white/8 pt-5 text-xs leading-6 text-white/35">Do not include ClickUp access tokens, session cookies, Watch Link tokens, or other secrets in a public issue. Redact private viewer and organization data from screenshots and logs.</p>
          </div>
        </div>
      </section>
      <Footer />
    </main>
  );
}
