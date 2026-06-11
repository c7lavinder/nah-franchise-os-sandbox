"use client";

import Link from "next/link";
import { Download, ExternalLink, Printer } from "lucide-react";
import {
  siteGuideMeetingAgenda,
  siteGuideModules,
  siteGuidePrinciples,
  siteGuideQuickStart,
  siteGuideUpdatedAt,
  siteGuideUpdateChecklist,
} from "@/lib/site-guide/content";

function printGuide() {
  window.print();
}

function NumberedList({ items }: { items: string[] }) {
  return (
    <ol className="space-y-2">
      {items.map((item, index) => (
        <li key={item} className="flex gap-3 text-body text-text-secondary leading-relaxed">
          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-nah-blue/10 text-[11px] font-bold text-nah-blue">
            {index + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item} className="flex gap-2 text-body text-text-secondary leading-relaxed">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-nah-blue" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export default function SiteGuidePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 print:max-w-none print:space-y-5">
      <style jsx global>{`
        @media print {
          body {
            background: #ffffff !important;
          }
          aside,
          button,
          .print-hidden,
          [data-bug-report-button],
          [data-scout-quick-ask] {
            display: none !important;
          }
          main {
            margin-left: 0 !important;
          }
          a {
            color: inherit !important;
            text-decoration: none !important;
          }
          .print-break-inside-avoid {
            break-inside: avoid;
          }
        }
      `}</style>

      <section className="rounded-lg border border-border-default bg-white px-5 py-5 shadow-sm print:border-0 print:px-0 print:shadow-none">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-label-caps uppercase text-nah-blue">FranDev Training</p>
            <h1 className="mt-1 font-headline text-page-title text-text-primary">Site Guide</h1>
            <p className="mt-2 max-w-3xl text-body-lg text-text-secondary">
              A practical guide for using FranDev in daily sales, calls, pipeline, cleanup, and admin workflows.
            </p>
            <p className="mt-3 text-caption font-medium text-text-tertiary">Updated {siteGuideUpdatedAt}</p>
          </div>
          <div className="flex flex-wrap gap-2 print-hidden">
            <button onClick={printGuide} className="btn-secondary inline-flex items-center gap-2">
              <Printer size={16} />
              Print
            </button>
            <button onClick={printGuide} className="btn-primary inline-flex items-center gap-2">
              <Download size={16} />
              Save PDF
            </button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <div className="rounded-lg border border-border-default bg-white p-5 shadow-sm print-break-inside-avoid">
          <h2 className="font-headline text-section-title text-text-primary">Quick Start</h2>
          <div className="mt-4">
            <NumberedList items={siteGuideQuickStart} />
          </div>
        </div>

        <div className="rounded-lg border border-border-default bg-white p-5 shadow-sm print-break-inside-avoid">
          <h2 className="font-headline text-card-title text-text-primary">How This Stays Updated</h2>
          <div className="mt-4 space-y-3">
            {siteGuideUpdateChecklist.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="flex gap-3">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-nah-blue/10 text-nah-blue">
                    <Icon size={16} />
                  </div>
                  <div>
                    <p className="text-body-sm font-semibold text-text-primary">{item.title}</p>
                    <p className="mt-0.5 text-caption text-text-secondary">{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border-default bg-white p-5 shadow-sm print-break-inside-avoid">
        <h2 className="font-headline text-section-title text-text-primary">Operating Principles</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {siteGuidePrinciples.map((principle) => (
            <div key={principle} className="rounded-md border border-border-default bg-bg-primary p-4">
              <p className="text-body text-text-secondary leading-relaxed">{principle}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="font-headline text-section-title text-text-primary">Workflow Modules</h2>
          <p className="mt-1 text-body text-text-secondary">
            Use these modules during onboarding, team meetings, and day-to-day refreshers.
          </p>
        </div>

        {siteGuideModules.map((module) => {
          const Icon = module.icon;
          return (
            <article
              key={module.id}
              id={module.id}
              className="rounded-lg border border-border-default bg-white p-5 shadow-sm print-break-inside-avoid"
            >
              <div className="flex flex-col gap-3 border-b border-border-default pb-4 md:flex-row md:items-start md:justify-between">
                <div className="flex gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-nah-blue/10 text-nah-blue">
                    <Icon size={20} />
                  </div>
                  <div>
                    <h3 className="font-headline text-card-title text-text-primary">{module.title}</h3>
                    <p className="mt-1 max-w-3xl text-body text-text-secondary">{module.purpose}</p>
                  </div>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
                  <span className="badge badge-info">Updated {module.updatedAt}</span>
                  <span className="badge badge-neutral">{module.owner}</span>
                </div>
              </div>

              <div className="grid gap-5 pt-5 lg:grid-cols-3">
                <div>
                  <h4 className="mb-3 text-body-sm font-semibold text-text-primary">Daily Workflow</h4>
                  <NumberedList items={module.dailyWorkflow} />
                </div>
                <div>
                  <h4 className="mb-3 text-body-sm font-semibold text-text-primary">What Good Looks Like</h4>
                  <BulletList items={module.whatGoodLooksLike} />
                </div>
                <div>
                  <h4 className="mb-3 text-body-sm font-semibold text-text-primary">Common Mistakes</h4>
                  <BulletList items={module.commonMistakes} />
                </div>
              </div>

              <div className="mt-5 print-hidden">
                <Link
                  href={module.path}
                  className="inline-flex items-center gap-1.5 text-body-sm font-semibold text-nah-blue hover:underline"
                >
                  Open {module.title}
                  <ExternalLink size={14} />
                </Link>
              </div>
            </article>
          );
        })}
      </section>

      <section className="rounded-lg border border-border-default bg-white p-5 shadow-sm print-break-inside-avoid">
        <h2 className="font-headline text-section-title text-text-primary">Team Meeting Run Of Show</h2>
        <div className="mt-4">
          <NumberedList items={siteGuideMeetingAgenda} />
        </div>
      </section>
    </div>
  );
}
