import { ResponsiveNav } from "@/src/components/navigation";
import FAQHero from "@/src/components/faq/FAQHero";
import FAQContent from "@/src/components/faq/FAQContent";
import FAQCTA from "@/src/components/faq/FAQCTA";
import Footer from "@/src/components/home/Footer";

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