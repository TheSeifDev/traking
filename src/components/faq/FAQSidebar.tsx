import Image from "next/image";
import Link from "next/link";
import { Headphones, Send } from "lucide-react";

const FAQSidebar = () => {
  return (
    <aside className="space-y-5">

      {/* Support Card */}
      <div className="rounded-2xl border border-[#25245b] bg-[#10102f]/80 p-7">
        {/* Icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#6547e8] bg-[#1a1650] text-[#6f8cff] shadow-[0_0_30px_rgba(93,67,255,0.25)]">
          <Headphones size={30} strokeWidth={1.7} />
        </div>

        <h2 className="mt-6 text-lg font-semibold text-white">
          Still have questions?
        </h2>

        <p className="mt-3 text-sm leading-6 text-white/55">
          Our support team is ready to help you get the most out of TrackUp.
        </p>

        <Link
          href="/contact"
          className="mt-6 flex h-11 items-center justify-center gap-2 rounded-xl bg-linear-to-r from-[#8b3dff] to-[#5d4cff] text-sm font-medium text-white shadow-[0_8px_30px_rgba(105,65,255,0.3)] transition hover:-translate-y-0.5"
        >
          <Send size={15} />
          Contact Support
        </Link>
      </div>

      {/* Promo Card */}
      <div className="relative min-h-102.5 overflow-hidden rounded-2xl border border-[#25245b] bg-[#10102f]/80 p-7">
        <h2 className="max-w-47.5 text-xl font-semibold text-white">
          Track Smarter.
          <br />
          Achieve More.
        </h2>

        <p className="mt-4 max-w-47.5 text-sm leading-6 text-white/50">
          Join hundreds of teams who use TrackUp to understand video
          engagement and improve learning outcomes.
        </p>

        {/* Image - Fixed and enlarged */}
        <div className="absolute -bottom-2 left-1/2 w-[115%] -translate-x-1/2">
          <Image
            src="/faq-dashboard.webp"
            alt="TrackUp analytics dashboard"
            width={540}
            height={420}
            className="h-auto w-full object-contain"
          />
        </div>
      </div>
    </aside>
  );
};

export default FAQSidebar;