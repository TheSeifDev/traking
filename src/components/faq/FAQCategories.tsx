"use client";

import { BarChart3, CreditCard, Grid2X2, Play, ShieldCheck, Sparkles } from "lucide-react";

const categories = [
  { label: "All Questions", icon: Grid2X2 },
  { label: "Getting Started", icon: Play },
  { label: "Tracking", icon: BarChart3 },
  { label: "ClickUp Integration", icon: Sparkles },
  { label: "Security & Privacy", icon: ShieldCheck },
  { label: "Billing", icon: CreditCard },
];

type FAQCategoriesProps = {
  activeCategory: string;
  onCategoryChange: (category: string) => void;
};

const FAQCategories = ({ activeCategory, onCategoryChange }: FAQCategoriesProps) => {
  return (
    <div className="flex flex-wrap justify-center gap-3">
      {categories.map((category) => {
        const Icon = category.icon;
        const active = activeCategory === category.label;

        return (
          <button
            key={category.label}
            type="button"
            onClick={() => onCategoryChange(category.label)}
            className={`flex h-10 items-center gap-2 rounded-xl border px-4 text-xs font-medium transition-all duration-200 ${
              active
                ? "border-[#5838d7] bg-linear-to-r from-[#3820a8] to-[#4b26c7] text-white shadow-[0_0_25px_rgba(92,50,255,0.25)]"
                : "border-[#33326b] bg-[#10102f]/70 text-white/70 hover:border-[#5746a8] hover:text-white"
            }`}
          >
            <Icon size={15} strokeWidth={1.8} />
            {category.label}
          </button>
        );
      })}
    </div>
  );
};

export default FAQCategories;