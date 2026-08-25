import Features from "@/src/components/home/Features";
import FinalCTA from "@/src/components/home/FinalCTA";
import Footer from "@/src/components/home/Footer";
import Hero from "@/src/components/home/Hero";
import HowItWorks from "@/src/components/home/HowItWorks";
import UseCasesPreview from "@/src/components/home/UseCasesPreview";
import SourceRibbon from "@/src/components/home/SourceRibbon";
import { ResponsiveNav } from "@/src/components/navigation";

export default function Home() {
  return (
    <>
      <ResponsiveNav />
      <Hero />
      <SourceRibbon />
      <Features showIntegration={false} compact />
      <HowItWorks />
      <UseCasesPreview />
      <FinalCTA />
      <Footer />
    </>
  );
}