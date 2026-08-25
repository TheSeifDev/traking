import Image from "next/image";
import IntegrationCard from "./IntegrationCard";

const integrations = [
  {
    name: "YouTube",
    icon: <Image src="https://img.icons8.com/color/96/youtube-play.png" alt="YouTube" width={28} height={28} unoptimized />,
    description: "Embed YouTube videos and show provider-backed playback evidence when the IFrame API events are available.",
    features: ["Add YouTube source URLs", "Internal TrackUp viewer", "Detailed telemetry when available"],
    statusLabel: "IFrame API when available",
  },
  {
    name: "Google Drive",
    icon: <Image src="https://img.icons8.com/fluency/96/google-drive--v1.png" alt="Google Drive" width={28} height={28} unoptimized />,
    description: "Add Google Drive video sources to a scoped TrackUp viewer with session-level access records.",
    features: ["Scoped provider access", "Session-only measurement", "Centralized activity records"],
    statusLabel: "Session-only measurement",
  },
  {
    name: "Telegram",
    statusLabel: "Session-only measurement",
    icon: <Image src="https://img.icons8.com/fluency/96/telegram-app.png" alt="Telegram" width={28} height={28} unoptimized />,
    description: "Open supported Telegram video sources through a scoped TrackUp viewer with session-level records.",
    features: ["Add Telegram source URLs", "Session-only measurement", "Viewer activity records"],
  },
  {
    name: "Vimeo",
    statusLabel: "Provider-dependent",
    icon: <Image src="https://img.icons8.com/color/96/vimeo.png" alt="Vimeo" width={28} height={28} unoptimized />,
    description: "Embed Vimeo sources through the provider adapter when a valid player callback is available.",
    features: ["Add Vimeo source URLs", "Provider callback path", "Telemetry depends on playback availability"],
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