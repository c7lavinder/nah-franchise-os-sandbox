/**
 * Email Tracking Utilities
 *
 * Injects open-tracking pixels and click-tracking wrappers into
 * outbound email HTML so we can record opens and clicks in
 * workflow_step_logs.
 */

/**
 * Injects a 1x1 transparent tracking pixel before the closing </body>
 * tag, or at the end of the HTML if no </body> is present.
 */
export function injectTrackingPixel(html: string, logId: string, baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const pixelUrl = `${cleanBase}/api/track/open/${encodeURIComponent(logId)}`;
  const pixelTag = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />`;

  // Insert before </body> if present (case-insensitive)
  const bodyCloseRegex = /<\/body>/i;
  if (bodyCloseRegex.test(html)) {
    return html.replace(bodyCloseRegex, `${pixelTag}</body>`);
  }

  // Otherwise append to end
  return html + pixelTag;
}

/**
 * Wraps all <a href="..."> links in the HTML with click tracking.
 * The original URL is passed as a query parameter so the tracking
 * endpoint can redirect after recording the click.
 *
 * Skips mailto: and tel: links, as well as anchors (#).
 */
export function wrapLinksWithTracking(html: string, logId: string, baseUrl: string): string {
  const cleanBase = baseUrl.replace(/\/+$/, "");
  const trackBase = `${cleanBase}/api/track/click/${encodeURIComponent(logId)}`;

  // Match <a ...href="..."...> with single or double quotes
  const linkRegex = /<a\s([^>]*?)href\s*=\s*["']([^"']+)["']([^>]*?)>/gi;

  return html.replace(linkRegex, (_match: string, before: string, href: string, after: string): string => {
    // Skip non-http links
    if (
      href.startsWith("mailto:") ||
      href.startsWith("tel:") ||
      href.startsWith("#") ||
      href.startsWith("javascript:")
    ) {
      return `<a ${before}href="${href}"${after}>`;
    }

    const trackedUrl = `${trackBase}?url=${encodeURIComponent(href)}`;
    return `<a ${before}href="${trackedUrl}"${after}>`;
  });
}

/**
 * Prepares email HTML for tracking by injecting both the open pixel
 * and click-tracking wrappers. Uses NEXT_PUBLIC_APP_URL as the base URL.
 */
export function prepareEmailForTracking(html: string, logId: string): string {
  const baseUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/frandev`;
  let tracked = wrapLinksWithTracking(html, logId, baseUrl);
  tracked = injectTrackingPixel(tracked, logId, baseUrl);
  return tracked;
}
