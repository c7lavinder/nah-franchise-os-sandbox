/**
 * Backfill Embeddings Script
 *
 * Embeds all existing call transcripts and KB documents into pgvector.
 * Safe to run multiple times — skips already-embedded content.
 *
 * Usage: npx tsx scripts/backfill-embeddings.ts
 *
 * Requires:
 * - NEXT_PUBLIC_SUPABASE_URL
 * - SUPABASE_SERVICE_KEY
 * - OPENAI_API_KEY
 */

import "dotenv/config";
import {
  embedAllExistingTranscripts,
  embedAllExistingKBDocs,
} from "../lib/rag/embedder";

async function main() {
  console.log("=== NAH OS Embedding Backfill ===\n");

  // Check required env vars
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "SUPABASE_SERVICE_KEY",
    "OPENAI_API_KEY",
  ];
  for (const key of required) {
    if (!process.env[key]) {
      console.error(`Missing required env var: ${key}`);
      process.exit(1);
    }
  }

  // Backfill transcripts
  console.log("Embedding call transcripts...");
  try {
    const txResults = await embedAllExistingTranscripts();
    console.log(
      `  Transcripts: ${txResults.total} total, ${txResults.embedded} embedded, ${txResults.failed} failed`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  Transcript backfill failed: ${msg}`);
  }

  // Backfill KB docs
  console.log("\nEmbedding KB documents...");
  try {
    const kbResults = await embedAllExistingKBDocs();
    console.log(
      `  KB docs: ${kbResults.total} total, ${kbResults.embedded} embedded, ${kbResults.failed} failed`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  KB doc backfill failed: ${msg}`);
  }

  console.log("\n=== Backfill complete ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
