import type { Metadata } from "next";
import PhantomsDeck from "@/src/components/presentation/PhantomsDeck";

export const metadata: Metadata = {
  title: "Phantoms — First Assembly 2026",
  description: "العرض التفاعلي لأول اجتماع لفريق Phantoms في السنة.",
};

export default function Home() {
  return <PhantomsDeck />;
}
