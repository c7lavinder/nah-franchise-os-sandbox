"use client";

import { useState, useEffect } from "react";
import { Kanban, RefreshCw } from "lucide-react";

/** Fallback stages if GHL API call fails */
/** Fallback stages if GHL API call fails — Won/Lost are opportunity statuses, not a pipeline */
const FALLBACK_PIPELINES = [
  {
    name: "NAH Franchise Sales - Active",
    stages: [
      "New Lead", "Contacted", "Qualified",
      "Matt Call (Discovery)", "Sam Call (Validation)",
      "Compliance Gate", "Application + Approval",
      "FDD Issued", "Mark Call (Capital/Lending)",
      "Award + Agreement", "Funds Received",
    ],
  },
  {
    name: "NAH Franchise Sales - Long-Term",
    stages: ["Follow-up", "Nurture", "Re-engaged"],
  },
];

interface PipelineStage {
  id: string;
  name: string;
  count: number;
}

interface PipelineData {
  name: string;
  stages: PipelineStage[];
}

/** Pipeline board — fetches real stages from GHL dynamically */
export default function PipelinePage() {
  const [pipelines, setPipelines] = useState<PipelineData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function fetchPipelines() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/pipeline");
      if (!response.ok) throw new Error("Failed to fetch pipelines");

      const data = await response.json();
      setPipelines(data.pipelines);
    } catch {
      // Fall back to static stage names
      setPipelines(
        FALLBACK_PIPELINES.map((p) => ({
          name: p.name,
          stages: p.stages.map((name) => ({ id: name, name, count: 0 })),
        }))
      );
      setError("Using cached stages — GHL connection failed");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void fetchPipelines();
  }, []);

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Kanban size={20} className="text-nah-orange" />
        <h1 className="text-h1 text-text-primary">Pipeline</h1>
        <span className="badge-info ml-2">Phase 2</span>
        <button
          onClick={() => void fetchPipelines()}
          className="btn-ghost p-1.5 ml-auto"
          title="Refresh pipeline"
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {error && (
        <div className="mb-4 px-3 py-2 bg-warning/10 border border-warning/20 rounded-lg">
          <p className="text-body-sm text-warning">{error}</p>
        </div>
      )}

      {pipelines.map((pipeline) => (
        <div key={pipeline.name} className="mb-8">
          <h2 className="text-h2 text-text-primary mb-3">{pipeline.name}</h2>
          <div className="flex gap-3 overflow-x-auto pb-4">
            {pipeline.stages.map((stage) => (
              <div
                key={stage.id}
                className="flex-shrink-0 w-56 bg-bg-secondary border border-border-default rounded-lg"
              >
                <div className="px-3 py-2.5 border-b border-border-default">
                  <h3 className="text-body-sm text-text-primary font-semibold truncate">
                    {stage.name}
                  </h3>
                  <span className="text-caption text-text-tertiary">
                    {stage.count} {stage.count === 1 ? "lead" : "leads"}
                  </span>
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
      ))}
    </div>
  );
}
