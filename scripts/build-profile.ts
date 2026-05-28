#!/usr/bin/env tsx
/**
 * Static build-efficiency profile.
 *
 * This is intentionally dependency-free and fast. It highlights files likely to
 * slow future builds/reviews: large app routes/pages and high-import modules.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOTS = ["app", "components", "lib"];
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx"]);

type FileMetric = {
  path: string;
  bytes: number;
  lines: number;
  imports: number;
};

function walk(dir: string): string[] {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", ".next", ".git"].includes(entry.name)) return [];
      return walk(path);
    }
    if (!entry.isFile()) return [];
    return SOURCE_EXTENSIONS.has(path.slice(path.lastIndexOf("."))) ? [path] : [];
  });
}

function metric(path: string): FileMetric {
  const content = readFileSync(path, "utf8");
  return {
    path: relative(process.cwd(), path),
    bytes: statSync(path).size,
    lines: content.split(/\r?\n/).length,
    imports: (content.match(/^import\s/gm) ?? []).length,
  };
}

function printTable(title: string, rows: FileMetric[], key: keyof Pick<FileMetric, "lines" | "imports" | "bytes">) {
  console.log(`\n${title}`);
  for (const row of rows.toSorted((a, b) => b[key] - a[key]).slice(0, 15)) {
    console.log(`${String(row[key]).padStart(5)}  ${row.path}`);
  }
}

const files = ROOTS.flatMap((root) => walk(join(process.cwd(), root))).map(metric);

printTable("Largest source files by lines", files, "lines");
printTable("Highest import-count files", files, "imports");
printTable("Largest app routes/pages by bytes", files.filter((file) => file.path.startsWith("app/")), "bytes");

const oversized = files.filter((file) => file.lines >= 750 || file.imports >= 35);
if (oversized.length > 0) {
  console.log("\nRefactor candidates");
  for (const file of oversized.toSorted((a, b) => b.lines - a.lines)) {
    console.log(`- ${file.path} (${file.lines} lines, ${file.imports} imports)`);
  }
}
