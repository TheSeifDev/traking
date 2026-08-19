import {
  BarChart3,
  Cloud,
  Link2,
  Play,
  Send,
  ShieldCheck,
  Upload,
  Users,
} from "lucide-react";

// تعريف أيقونة يوتيوب مخصصة لأنها غير موجودة في إصدارات lucide-react الحديثة
const YoutubeIcon = ({ size = 24, ...props }: { size?: number } & React.SVGProps<SVGSVGElement>) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const timeline = [
  { icon: Link2, title: "Add Video", description: "Import videos from multiple sources." },
  { icon: Users, title: "Share & Assign", description: "Generate tracking links or assign to ClickUp tasks." },
  { icon: Play, title: "Track in Real-time", description: "We capture every play, pause, seek, and view." },
  { icon: BarChart3, title: "Analyze & Improve", description: "Get powerful insights and optimize your content." },
];

const sources = [
  { icon: YoutubeIcon, title: "YouTube", description: "Add any public or unlisted YouTube video." },
  { icon: Cloud, title: "Google Drive", description: "Add videos from your Drive instantly." },
  { icon: Send, title: "Telegram", description: "Track videos shared in your Telegram channels." },
  { icon: Upload, title: "Upload Video", description: "Upload your video files and host securely." },
];

const DetailedWorkflow = () => {
  return (
    <section className="px-6 pb-24 md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-10 text-center">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#a66cff]">
            Detailed Workflow
          </span>
          <h2 className="mt-3 text-2xl font-bold md:text-3xl">See How TrackUp Works</h2>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-white/55">
            From adding a video to understanding engagement — all in one seamless workflow.
          </p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.018] shadow-[0_0_60px_rgba(77,50,255,0.06)]">
          <div className="grid lg:grid-cols-[250px_1fr]">
            {/* Timeline */}
            <div className="border-b border-white/8 p-5 lg:border-b-0 lg:border-r">
              <div className="space-y-3">
                {timeline.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className={`rounded-xl p-4 transition-colors ${index === 0 ? "border border-[#743eff]/25 bg-[#5120c9]/10" : ""}`}
                    >
                      <div className="flex gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#7542ff]/25 bg-[#5524cc]/10">
                          <Icon size={17} className="text-[#9c6cff]" />
                        </div>
                        <div>
                          <h3 className="text-xs font-semibold">{item.title}</h3>
                          <p className="mt-1 text-[11px] leading-5 text-white/45">{item.description}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Main content */}
            <div className="p-5 md:p-7">
              <div className="rounded-xl border border-white/8 bg-[#090c20]/80 p-5 md:p-6">
                <h3 className="text-sm font-semibold">Add New Video</h3>
                <p className="mt-1 text-xs text-white/40">Choose a source and add your video to start tracking.</p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {sources.map((source) => {
                    const Icon = source.icon;
                    return (
                      <div
                        key={source.title}
                        className="rounded-xl border border-white/8 bg-white/[0.018] p-5 text-center transition-all duration-200 hover:border-[#7542ff]/30 hover:bg-white/[0.035]"
                      >
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#151839]">
                          <Icon size={24} className="text-[#8d5cff]" />
                        </div>
                        <h4 className="mt-4 text-xs font-semibold">{source.title}</h4>
                        <p className="mt-3 text-[11px] leading-5 text-white/45">{source.description}</p>
                      </div>
                    );
                  })}
                </div>

                {/* Security note */}
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/7 bg-white/1.5 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#5724d6]/15">
                    <ShieldCheck size={17} className="text-[#9c6cff]" />
                  </div>
                  <p className="text-[11px] leading-5 text-white/50">
                    We support a wide range of video formats and ensure secure tracking without compromising visibility.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default DetailedWorkflow;