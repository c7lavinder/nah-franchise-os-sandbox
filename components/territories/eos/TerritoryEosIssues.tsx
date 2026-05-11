import SourceBadge from "@/components/ui/SourceBadge";
import type { EosTerritoryIssue } from "@/types/database";

interface Props {
  issues: EosTerritoryIssue[];
}

export default function TerritoryEosIssues({ issues }: Props) {
  return (
    <div>
      <h3 className="text-body-sm font-semibold text-text-primary mb-2">Issues</h3>
      <ul className="space-y-1">
        {issues.map((issue) => (
          <li key={issue.id} className="flex items-start gap-2 rounded-lg px-2 py-1.5">
            <span
              className={`shrink-0 mt-0.5 w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                issue.is_done ? "bg-green-100 border-green-400 text-green-700" : "border-border-primary"
              }`}
            >
              {issue.is_done ? "\u2713" : ""}
            </span>
            <span
              className={`flex-1 text-body-sm ${issue.is_done ? "line-through text-text-tertiary opacity-60" : "text-text-primary"}`}
            >
              {issue.Issue}
            </span>
            <SourceBadge source={issue.source} />
          </li>
        ))}
      </ul>
    </div>
  );
}
