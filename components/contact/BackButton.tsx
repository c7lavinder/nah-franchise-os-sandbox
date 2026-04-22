"use client";

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";

/** Thin client wrapper so server components can render a history-aware
 *  "Back" button. Using router.back() lands the user on whatever page
 *  they navigated from — pipeline, daily-hq, journey, etc. */
export default function BackButton({ className }: { className?: string }) {
  const router = useRouter();
  return (
    <button onClick={() => router.back()} className={className ?? "btn-ghost p-1.5"} aria-label="Back">
      <ArrowLeft size={18} />
    </button>
  );
}
