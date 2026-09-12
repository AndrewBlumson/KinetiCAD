/** Browser signals used by both the public site and the CAD entry point.
 * Viewport size is deliberately absent: a narrow desktop window is supported. */
export type DesktopSupportSignals = {
  userAgent: string;
  platform?: string;
  maxTouchPoints?: number;
  hasCoarsePointer: boolean;
  hasFinePointer: boolean;
};

/** Device eligibility, independent of browser globals or any CAD imports.
 * A mouse attached to a known phone/tablet does not make it a desktop. */
export function isDesktopSupported(signals: DesktopSupportSignals): boolean {
  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile|Windows\s*Phone|Silk|Kindle|Tablet|PlayBook|BlackBerry|BB10|webOS|Opera Mini/i;
  if (mobileUserAgent.test(signals.userAgent)) return false;

  // iPadOS can advertise the same UA/platform as macOS in desktop mode.
  const macIdentity = /Macintosh|MacIntel/i.test(`${signals.userAgent} ${signals.platform ?? ''}`);
  if (macIdentity && (signals.maxTouchPoints ?? 0) > 1) return false;

  // Touch-capable Windows laptops remain eligible when a mouse/trackpad is
  // available. Touch-point count alone is not a desktop exclusion.
  if (signals.hasCoarsePointer && !signals.hasFinePointer) return false;
  return true;
}
