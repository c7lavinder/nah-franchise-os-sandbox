/**
 * Next.js Instrumentation — runs once on server startup.
 * Used to start background services like the accountability cron.
 *
 * See: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on the server, not during build or in the browser
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startAccountabilityCron } = await import("@/lib/accountability/cron");
    startAccountabilityCron();
  }
}
