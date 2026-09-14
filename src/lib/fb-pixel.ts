"use client";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function fbAdvancedMatch(firstName: string, lastName?: string) {
  const pixelId = process.env.NEXT_PUBLIC_FB_PIXEL_ID;
  if (!pixelId || typeof window === "undefined" || !window.fbq) return;
  window.fbq("init", pixelId, {
    fn: firstName.toLowerCase(),
    ...(lastName ? { ln: lastName.toLowerCase() } : {}),
  });
}

export function fbTrack(event: string, params?: Record<string, unknown>) {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", event, params);
}
