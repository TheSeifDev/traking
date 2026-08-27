import ResponsiveNav from "@/src/components/navigation/ResponsiveNav";
import Footer from "@/src/components/home/Footer";

import IntegrationsHero from "@/src/components/integrations/IntegrationsHero";
import FeaturedIntegration from "@/src/components/integrations/FeaturedIntegration";
import AllIntegrations from "@/src/components/integrations/AllIntegrations";
import UpcomingIntegrations from "@/src/components/integrations/UpcomingIntegrations";
import IntegrationWorkflow from "@/src/components/integrations/IntegrationWorkflow";
import IntegrationsCTA from "@/src/components/integrations/IntegrationsCTA";

export default function IntegrationsPage() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#08081f] text-white">
      <ResponsiveNav />

      <IntegrationsHero />

      <FeaturedIntegration />

      <AllIntegrations />

      <UpcomingIntegrations />

      <IntegrationWorkflow />

      <IntegrationsCTA />

      <Footer />
    </main>
  );
}