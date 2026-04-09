"use client";

/**
 * TeamCard — shows NAH internal team members who have touched this contact.
 * Auto-derived from: pipeline state assigned user, call hosts, message mentions, sub-task loggers.
 */

import { useState, useEffect } from "react";
import { Users, Loader2 } from "lucide-react";
import { capitalizeName } from "@/lib/format/contact";

interface TeamMember {
  id: string;
  name: string;
  role: string;
}

interface TeamCardProps {
  contactId: string;
}

export default function TeamCard({ contactId }: TeamCardProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchTeam() {
      try {
        const res = await fetch(`/api/contacts/${contactId}/team`);
        if (res.ok) {
          const data = await res.json();
          setMembers(data.team ?? []);
        }
      } catch { /* silent */ }
      setLoading(false);
    }
    void fetchTeam();
  }, [contactId]);

  if (loading) return <div className="flex items-center justify-center py-3"><Loader2 size={14} className="animate-spin text-text-tertiary" /></div>;

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        <Users size={14} className="text-text-tertiary" />
        <h3 className="text-[10px] font-semibold text-text-tertiary tracking-wider">TEAM ({members.length})</h3>
      </div>
      {members.length === 0 ? (
        <p className="text-caption text-text-tertiary">No team members assigned</p>
      ) : (
        <div className="space-y-1.5">
          {members.map((m) => {
            const name = capitalizeName(m.name);
            const initials = name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
            return (
              <div key={m.id} className="flex items-center gap-2.5 py-1">
                <div className="w-7 h-7 rounded-full bg-scout-purple/10 text-scout-purple flex items-center justify-center text-[10px] font-semibold flex-shrink-0">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-caption font-medium text-text-primary truncate block">{name}</span>
                </div>
                <span className="text-[9px] px-1 py-0.5 rounded bg-text-tertiary/10 text-text-tertiary uppercase">
                  {m.role === "leadership" ? "Admin" : m.role}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
