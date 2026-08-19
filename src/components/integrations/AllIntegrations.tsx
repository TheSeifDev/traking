import Image from "next/image";
import IntegrationCard from "./IntegrationCard";

const integrations = [
  {
    name: "YouTube",
    icon: <Image src="https://img.icons8.com/color/96/youtube-play.png" alt="YouTube" width={28} height={28} unoptimized />,
    description: "Track videos from YouTube with real-time viewing analytics.",
    features: ["Import YouTube videos", "Track engagement", "View detailed analytics"],
    connected: true,
  },
  {
    name: "Google Drive",
    icon: <Image src="https://img.icons8.com/fluency/96/google-drive--v1.png" alt="Google Drive" width={28} height={28} unoptimized />,
    description: "Add and track videos from your Google Drive files.",
    features: ["Secure file access", "Track watch progress", "Centralized insights"],
    connected: true,
  },
  {
    name: "Telegram",
    icon: <Image src="https://img.icons8.com/fluency/96/telegram-app.png" alt="Telegram" width={28} height={28} unoptimized />,
    description: "Track videos shared via Telegram channels and groups.",
    features: ["Import Telegram videos", "Track engagement", "Detailed viewer insights"],
  },
  {
    name: "Vimeo",
    icon: <Image src="https://img.icons8.com/color/96/vimeo.png" alt="Vimeo" width={28} height={28} unoptimized />,
    description: "Seamlessly track your Vimeo videos and viewer data.",
    features: ["Import Vimeo videos", "Track engagement", "Advanced analytics"],
  },
];

const AllIntegrations = () => {
  return (
    <section className="px-6 pb-16 md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex items-center gap-2">
          <span className="text-[#a66cff]">▦</span>
          <h2 className="text-sm font-semibold md:text-base">All Integrations</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {integrations.map((integration) => (
            <IntegrationCard key={integration.name} {...integration} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default AllIntegrations;