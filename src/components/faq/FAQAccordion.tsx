"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import type { FAQItem } from "./FAQData";

type FAQAccordionProps = {
  items: FAQItem[];
};

const FAQAccordion = ({ items }: FAQAccordionProps) => {
  const [openId, setOpenId] = useState<number | null>(items[0]?.id ?? null);

  return (
    <div className="flex flex-col gap-2">
      {items.map((item) => {
        const isOpen = openId === item.id;

        return (
          <div
            key={item.id}
            className={`overflow-hidden rounded-xl border transition-all duration-300 ${
              isOpen
                ? "border-[#28245b] bg-[#131337]"
                : "border-[#1f2050] bg-[#10102d]/80 hover:border-[#343477]"
            }`}
          >
            {/* Question */}
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : item.id)}
              className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
            >
              <div className="flex min-w-0 items-center gap-4">
                {/* Icon */}
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#313078] bg-[#17174a] text-[#8a6cff]">
                  <span className="text-sm font-bold">?</span>
                </div>

                <span className="text-sm font-medium text-white/90">
                  {item.question}
                </span>
              </div>

              {isOpen ? (
                <ChevronUp size={18} className="shrink-0 text-white/70" />
              ) : (
                <ChevronDown size={18} className="shrink-0 text-white/70" />
              )}
            </button>

            {/* Answer */}
            <div className={`grid transition-all duration-300 ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
              <div className="overflow-hidden">
                <div className="border-t border-white/5 px-5 pb-5 pt-4 pl-19">
                  <p className="max-w-2xl text-sm leading-6 text-white/60">
                    {item.answer}
                  </p>

                  {isOpen && item.id === 1 && (
                    <div className="mt-5 flex items-center gap-3 text-xs text-white/45">
                      <span>Was this answer helpful?</span>
                      <button type="button" className="rounded-lg border border-[#393276] bg-[#171542] px-3 py-1.5 text-white/70 transition hover:bg-[#211c5c]">
                        Yes
                      </button>
                      <button type="button" className="rounded-lg border border-[#393276] bg-[#171542] px-3 py-1.5 text-white/70 transition hover:bg-[#211c5c]">
                        No
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FAQAccordion;