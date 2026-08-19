"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

import FAQCategories from "./FAQCategories";
import FAQAccordion from "./FAQAccordion";
import FAQSidebar from "./FAQSidebar";
import { faqItems } from "./FAQData";

const FAQContent = () => {
  const [activeCategory, setActiveCategory] = useState("All Questions");
  const [search, setSearch] = useState("");

  const filteredFAQs = useMemo(() => {
    const searchValue = search.toLowerCase().trim();
    
    return faqItems.filter((item) => {
      const matchesCategory =
        activeCategory === "All Questions" || item.category === activeCategory;

      const matchesSearch =
        !searchValue ||
        item.question.toLowerCase().includes(searchValue) ||
        item.answer.toLowerCase().includes(searchValue);

      return matchesCategory && matchesSearch;
    });
  }, [activeCategory, search]);

  return (
    <section className="px-6 pb-16 lg:px-10">
      <div className="mx-auto max-w-7xl">
        {/* Search */}
        <div className="mx-auto max-w-190">
          <div className="flex h-12 items-center gap-3 rounded-xl border border-[#4a3a9a] bg-[#121036]/80 px-4 shadow-[0_0_30px_rgba(84,53,230,0.1)] transition focus-within:border-[#7357e8] focus-within:shadow-[0_0_35px_rgba(84,53,230,0.2)]">
            <Search size={19} className="shrink-0 text-white/45" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search for questions..."
              className="w-full bg-transparent text-sm text-white outline-none placeholder:text-white/35"
            />
          </div>
        </div>

        {/* Categories */}
        <div className="mt-7">
          <FAQCategories activeCategory={activeCategory} onCategoryChange={setActiveCategory} />
        </div>

        {/* Main Content */}
        <div className="mt-8 grid gap-7 lg:grid-cols-[224px_minmax(0,1fr)]">
          {/* Sidebar */}
          <FAQSidebar />

          {/* Questions */}
          <div>
            {filteredFAQs.length > 0 ? (
              <FAQAccordion items={filteredFAQs} />
            ) : (
              <div className="rounded-2xl border border-[#25245b] bg-[#10102f] px-6 py-16 text-center">
                <p className="text-white/60">No questions found.</p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setActiveCategory("All Questions");
                  }}
                  className="mt-4 text-sm text-[#9b7aff] transition-colors hover:text-white"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default FAQContent;