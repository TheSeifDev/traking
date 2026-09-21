import type { Metadata } from "next";
import ResponsiveNav from "@/src/components/navigation/ResponsiveNav";
import Footer from "@/src/components/home/Footer";

import HowItWorksHero from "@/src/components/how-it-works/HowItWorksHero";
import WorkflowSteps from "@/src/components/how-it-works/WorkflowSteps";
import DetailedWorkflow from "@/src/components/how-it-works/DetailedWorkflow";
import WhyItMatters from "@/src/components/how-it-works/WhyItMatters";
import HowItWorksCTA from "@/src/components/how-it-works/HowItWorksCTA";

export const metadata: Metadata = {
  title: "How It Works",
  description: "Sign in with ClickUp, share a scoped watch link, and review provider-aware playback evidence. TrackUp keeps video access private and analytics honest.",
  openGraph: {
    title: "How TrackUp Works | ClickUp-connected video evidence",
    description: "Sign in with ClickUp, share a scoped watch link, and review provider-aware playback evidence. TrackUp keeps video access private and analytics honest.",
  },
};

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen text-white">
      <ResponsiveNav />

      <HowItWorksHero />
      <WorkflowSteps />
      <DetailedWorkflow />
      <WhyItMatters />
      <HowItWorksCTA />

      <Footer />
    </main>
  );
}