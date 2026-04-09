/**
 * Reconcile field-registry.ts against NAH_Profile_Tab_v2_Expanded.md
 * Reports semantic mismatches between the two.
 */

import { PROFILE_FIELDS } from "../lib/profile/field-registry";
import * as fs from "fs";

const doc = fs.readFileSync(
  "/Users/vieiraproject/Downloads/nahosfiles2/NAH_Profile_Tab_v2_Expanded.md",
  "utf8"
);

// Parse planning doc fields by number
const planningFields: Array<{ num: number; name: string; desc: string; cat: string }> = [];
let currentCat = "";

for (const line of doc.split("\n")) {
  const catMatch = line.match(/^## (\d+)\.\s+(.+?)(?:\s+\(.+?\))?\s*(?:—.*)?$/);
  if (catMatch) {
    currentCat = catMatch[2].trim();
    continue;
  }

  const fieldMatch = line.match(/^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*(.+?)\s*\|/);
  if (fieldMatch) {
    planningFields.push({
      num: parseInt(fieldMatch[1]),
      name: fieldMatch[2].replace(/\*\(EXISTING\)\*\s*/g, "").trim(),
      desc: fieldMatch[3].trim(),
      cat: currentCat,
    });
  }
}

// Map registry fields by category order
const regByIndex = PROFILE_FIELDS.map((f, i) => ({
  index: i,
  name: f.name,
  label: f.label,
  category: f.category,
}));

console.log(`Planning: ${planningFields.length} fields`);
console.log(`Registry: ${regByIndex.length} fields\n`);

// Compare field-by-field within each category
const catOrder = [
  "Identity & Contact",
  "Background & Demographics",
  "Personality & Psychology",
  "Goals & Vision",
  "Financial Profile",
  "Franchise Fit",
  "Territory",
  "Sales Journey",
  "Validation",
  "Trainual",
  "Compliance",
  "Objections & Concerns",
  "Behavioral Signals",
  "Engagement",
  "External Research",
  "AI Scout Intelligence",
  "Predictive Scores",
  "Metadata & Audit",
];

const regCatOrder = [
  "identity_contact",
  "background_demographics",
  "personality_psychology",
  "goals_vision",
  "financial",
  "franchise_fit",
  "territory",
  "sales_journey",
  "validation",
  "trainual",
  "compliance",
  "objections_concerns",
  "behavioral_signals",
  "engagement",
  "external_research",
  "ai_scout",
  "predictive_scores",
  "metadata_audit",
];

let issues = 0;

for (let c = 0; c < catOrder.length; c++) {
  const planCat = catOrder[c];
  const regCat = regCatOrder[c];

  const planFields = planningFields.filter((f) => f.cat === planCat);
  const regFields = PROFILE_FIELDS.filter((f) => f.category === regCat);

  if (planFields.length !== regFields.length) {
    console.log(`⚠️ ${planCat}: count mismatch — plan=${planFields.length} reg=${regFields.length}`);
    issues++;
  }

  // Compare each field
  for (let i = 0; i < Math.max(planFields.length, regFields.length); i++) {
    const plan = planFields[i];
    const reg = regFields[i];

    if (!plan) {
      console.log(`  EXTRA in registry: ${reg?.name} (${reg?.label})`);
      issues++;
      continue;
    }
    if (!reg) {
      console.log(`  MISSING from registry: #${plan.num} ${plan.name}`);
      issues++;
      continue;
    }

    // Check semantic match — normalize and compare
    const planNorm = plan.name.toLowerCase().replace(/[^a-z0-9]/g, "");
    const regLabelNorm = reg.label.toLowerCase().replace(/[^a-z0-9]/g, "");
    const regNameNorm = reg.name.toLowerCase().replace(/[^a-z0-9]/g, "");

    // Consider it a match if label or name contains key words from planning name
    const planWords = plan.name.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
    const matchesLabel = planWords.every((w) => regLabelNorm.includes(w.replace(/[^a-z]/g, "")));
    const matchesName = planWords.every((w) => regNameNorm.includes(w.replace(/[^a-z]/g, "")));

    if (!matchesLabel && !matchesName && planNorm !== regLabelNorm) {
      console.log(`  MISMATCH #${plan.num}: plan="${plan.name}" vs reg="${reg.label}" (${reg.name})`);
      issues++;
    }
  }
}

console.log(`\nTotal issues: ${issues}`);
if (issues === 0) {
  console.log("✅ All fields match semantically!");
}
