import type { Metadata } from "next";
import { ResponsiveNav } from "@/src/components/navigation";
import FAQHero from "@/src/components/faq/FAQHero";
import FAQContent from "@/src/components/faq/FAQContent";
import FAQCTA from "@/src/components/faq/FAQCTA";
import Footer from "@/src/components/home/Footer";

export const metadata: Metadata = {
  title: "FAQ",
  description: "Common questions about TrackUp's provider-aware tracking, ClickUp integration, scoped analytics, organization and Space structure, and security boundaries.",
  openGraph: {
    title: "TrackUp FAQ | Provider-aware tracking questions answered",
    description: "Common questions about TrackUp's provider-aware tracking, ClickUp integration, scoped analytics, organization and Space structure, and security boundaries.",
  },
};

const FAQPage = () => {
  return (
    <main className="min-h-screen overflow-hidden">
      <ResponsiveNav />

      <FAQHero />

      <FAQContent />

      <FAQCTA />

      <Footer />
    </main>
  );
};

export default FAQPage;