"use client";

import { Users, Search } from "lucide-react";

/** Leads list — Phase 2 feature, placeholder for now */
export default function LeadsPage() {
  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Users size={20} className="text-nah-orange" />
        <h1 className="text-h1 text-text-primary">Leads</h1>
        <span className="badge-info ml-2">Phase 2</span>
      </div>

      {/* Search bar preview */}
      <div className="card mb-6">
        <div className="flex items-center gap-2">
          <Search size={18} className="text-text-tertiary" />
          <input
            type="text"
            placeholder="Search leads by name, email, or phone..."
            className="input flex-1"
            disabled
          />
        </div>
      </div>

      {/* Table preview */}
      <div className="card">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default">
              {["Name", "Stage", "Score", "Source", "Assigned To", "Last Activity"].map(
                (header) => (
                  <th
                    key={header}
                    className="text-left text-overline text-text-secondary uppercase tracking-wider py-2 px-3"
                  >
                    {header}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td
                colSpan={6}
                className="text-center py-12 text-text-tertiary text-body-sm"
              >
                Lead profiles will appear here once GHL is connected. Full lead
                management is coming in Phase 2.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
