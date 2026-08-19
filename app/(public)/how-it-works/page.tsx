import ResponsiveNav from "@/src/components/navigation/ResponsiveNav";
import Footer from "@/src/components/home/Footer";

import HowItWorksHero from "@/src/components/how-it-works/HowItWorksHero";
import WorkflowSteps from "@/src/components/how-it-works/WorkflowSteps";
import DetailedWorkflow from "@/src/components/how-it-works/DetailedWorkflow";
import WhyItMatters from "@/src/components/how-it-works/WhyItMatters";
import HowItWorksCTA from "@/src/components/how-it-works/HowItWorksCTA";

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