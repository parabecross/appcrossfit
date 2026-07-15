/**
 * Client-safe Web Share helper for athlete achievements.
 * Uses navigator.share when available; falls back to clipboard text.
 * No images, no extra dependencies. Call only from browser event handlers.
 */

import { buildShareText, type ShareAchievementPayload } from "@/lib/socio/home-snapshot";

export type ShareResult =
  | { ok: true; method: "share" | "clipboard" }
  | { ok: false; reason: "unsupported" | "aborted" | "failed" };

export async function shareAchievement(
  payload: ShareAchievementPayload
): Promise<ShareResult> {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return { ok: false, reason: "unsupported" };
  }

  const text = buildShareText(payload);

  if (typeof navigator.share === "function") {
    try {
      await navigator.share({
        title: payload.title,
        text,
      });
      return { ok: true, method: "share" };
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      if (name === "AbortError") return { ok: false, reason: "aborted" };
      // Fall through to clipboard
    }
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return { ok: true, method: "clipboard" };
    } catch {
      return { ok: false, reason: "failed" };
    }
  }

  return { ok: false, reason: "unsupported" };
}
