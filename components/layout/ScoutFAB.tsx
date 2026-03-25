"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Bot, X } from "lucide-react";
import { QuickAsk } from "@/components/scout";

/** Scout AI floating action button — persistent on all pages except /scout */
export default function ScoutFAB() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Don't show on the dedicated Scout page
  if (pathname === "/scout") return null;

  return (
    <>
      {/* FAB button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-[500] w-14 h-14 rounded-full bg-nah-blue text-white flex items-center justify-center cursor-pointer hover:scale-[1.08] transition-transform"
          style={{ boxShadow: "0 4px 20px rgba(0, 161, 225, 0.4)" }}
          aria-label="Open Scout AI"
        >
          <Bot size={24} />
        </button>
      )}

      {/* Scout drawer */}
      {open && (
        <div
          className="fixed top-0 right-0 bottom-0 z-[499] w-[380px] flex flex-col"
          style={{
            background: "rgba(255, 255, 255, 0.85)",
            backdropFilter: "blur(24px)",
            WebkitBackdropFilter: "blur(24px)",
            borderLeft: "1px solid rgba(255, 255, 255, 0.6)",
            boxShadow: "-4px 0 40px rgba(0, 0, 0, 0.08)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
            <div className="flex items-center gap-2">
              <Bot size={18} className="text-nah-blue" />
              <span className="font-headline font-semibold text-text-primary">Scout AI</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded-lg hover:bg-bg-hover transition-colors"
            >
              <X size={18} className="text-text-secondary" />
            </button>
          </div>

          {/* Quick ask */}
          <div className="flex-1 flex flex-col items-center justify-center px-5">
            <Bot size={40} className="text-nah-blue mb-4 opacity-40" />
            <p className="text-text-secondary text-sm text-center mb-6">
              Ask Scout anything about your leads, pipeline, or next steps.
            </p>
            <div className="w-full">
              <QuickAsk />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
