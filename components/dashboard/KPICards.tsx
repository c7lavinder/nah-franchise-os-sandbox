"use client";

import { Users, Trophy, XCircle, TrendingUp, Contact } from "lucide-react";

interface KPICardsProps {
  activeLeads: number;
  won: number;
  lost: number;
  conversionRate: number;
  totalContacts: number;
}

interface CardConfig {
  label: string;
  value: number | string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  bgColor: string;
}

export default function KPICards({ activeLeads, won, lost, conversionRate, totalContacts }: KPICardsProps) {
  const cards: CardConfig[] = [
    { label: "Active Leads", value: activeLeads.toLocaleString(), icon: Users, color: "text-info", bgColor: "bg-info/10" },
    { label: "Won", value: won.toLocaleString(), icon: Trophy, color: "text-success", bgColor: "bg-success/10" },
    { label: "Lost", value: lost.toLocaleString(), icon: XCircle, color: "text-danger", bgColor: "bg-danger/10" },
    { label: "Conversion", value: `${conversionRate}%`, icon: TrendingUp, color: "text-nah-orange", bgColor: "bg-nah-orange/10" },
    { label: "Total Contacts", value: totalContacts.toLocaleString(), icon: Contact, color: "text-scout-purple", bgColor: "bg-scout-purple/10" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="bg-bg-secondary border border-border-default rounded-lg p-4"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg ${card.bgColor} flex items-center justify-center`}>
                <Icon size={16} className={card.color} />
              </div>
            </div>
            <p className="text-2xl font-bold text-text-primary">{card.value}</p>
            <p className="text-caption text-text-tertiary">{card.label}</p>
          </div>
        );
      })}
    </div>
  );
}
