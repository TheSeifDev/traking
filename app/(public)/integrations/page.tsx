import type { Metadata } from "next";
import ResponsiveNav from "@/src/components/navigation/ResponsiveNav";
import Footer from "@/src/components/home/Footer";

import IntegrationsHero from "@/src/components/integrations/IntegrationsHero";
import FeaturedIntegration from "@/src/components/integrations/FeaturedIntegration";
import AllIntegrations from "@/src/components/integrations/AllIntegrations";
import UpcomingIntegrations from "@/src/components/integrations/UpcomingIntegrations";
import IntegrationWorkflow from "@/src/components/integrations/IntegrationWorkflow";
import IntegrationsCTA from "@/src/components/integrations/IntegrationsCTA";

export const metadata: Metadata = {
  title: "Integrations",
  description: "Connect TrackUp to ClickUp for OAuth sign-in, workspace discovery, and task lookup. Bring YouTube, Vimeo, direct media URLs, Google Drive, and Telegram into one scoped library.",
  openGraph: {
    title: "TrackUp Integrations | ClickUp, YouTube, Vimeo, Drive, Telegram",
    description: "Connect TrackUp to ClickUp for OAuth sign-in, workspace discovery, and task lookup. Bring YouTube, Vimeo, direct media URLs, Google Drive, and Telegram into one scoped library.",
  },
};

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