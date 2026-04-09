/**
 * Quick sanity check for name/phone formatting.
 * Run: npx tsx scripts/test-contact-format.ts
 */

import { capitalizeName, formatPhone } from "../lib/format/contact";

const nameTests: [string | null, string][] = [
  ["john doe", "John Doe"],
  ["JANE SMITH", "Jane Smith"],
  ["mary-jane watson", "Mary-Jane Watson"],
  ["o'brien", "O'Brien"],
  ["de la cruz", "De La Cruz"],
  [null, ""],
  ["", ""],
  ["chris loye", "Chris Loye"],
  ["ramon ayala", "Ramon Ayala"],
  ["mcdonald", "Mcdonald"],
];

const phoneTests: [string | null, string][] = [
  ["3362157571", "+1 (336) 215-7571"],
  ["13362157571", "+1 (336) 215-7571"],
  ["+13362157571", "+1 (336) 215-7571"],
  ["(336) 215-7571", "+1 (336) 215-7571"],
  [null, ""],
  ["", ""],
  ["123", "123"],
  ["2027104153", "+1 (202) 710-4153"],
  ["7132045802", "+1 (713) 204-5802"],
  ["+447911123456", "+447911123456"],
];

let pass = 0;
let fail = 0;

for (const [input, expected] of nameTests) {
  const result = capitalizeName(input);
  if (result === expected) { pass++; }
  else { fail++; console.log(`FAIL name: "${input}" → "${result}" (expected "${expected}")`); }
}

for (const [input, expected] of phoneTests) {
  const result = formatPhone(input);
  if (result === expected) { pass++; }
  else { fail++; console.log(`FAIL phone: "${input}" → "${result}" (expected "${expected}")`); }
}

console.log(`\nResults: ${pass} pass, ${fail} fail`);
