"use client";

import { Kanban } from "lucide-react";

/** Pipeline board — Phase 2 feature, placeholder for now */
export default function PipelinePage() {
  const stages = [
    "New Lead",
    "Attempted Contact",
    "Connected/Qualified",
    "Discovery Scheduled",
    "Discovery Complete",
    "Validation",
    "FDD Sent",
    "In Closing",
  ];

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Kanban size={20} className="text-nah-orange" />
        <h1 className="text-h1 text-text-primary">Pipeline</h1>
        <span className="badge-info ml-2">Phase 2</span>
      </div>

      {/* Kanban preview — shows the stage columns layout */}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {stages.map((stage) => (
          <div
            key={stage}
            className="flex-shrink-0 w-56 bg-bg-secondary border border-border-default rounded-lg"
          >
            <div className="px-3 py-2.5 border-b border-border-default">
              <h3 className="text-body-sm text-text-primary font-semibold truncate">
                {stage}
              </h3>
              <span className="text-caption text-text-tertiary">0 leads</span>
            </div>
            <div className="p-3 min-h-[200px] flex items-center justify-center">
              <span className="text-caption text-text-tertiary">
                Drag & drop coming in Phase 2
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
