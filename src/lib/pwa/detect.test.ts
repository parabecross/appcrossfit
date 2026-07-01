import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isAndroidDevice,
  isBeforeInstallPromptEvent,
  isIosDevice,
  isIosSafari,
  isStandaloneMode,
} from "./detect";

function mockUserAgent(ua: string) {
  vi.stubGlobal("navigator", { userAgent: ua });
  vi.stubGlobal("window", {});
}

function mockWindow(overrides: Record<string, unknown> = {}) {
  vi.stubGlobal("window", {
    matchMedia: () => ({ matches: false }),
    navigator: globalThis.navigator,
    ...overrides,
  });
}

describe("isStandaloneMode", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns true for display-mode standalone", () => {
    mockWindow({
      matchMedia: (q: string) => ({ matches: q === "(display-mode: standalone)" }),
      navigator: { standalone: false },
    });
    expect(isStandaloneMode()).toBe(true);
  });

  it("returns true for iOS navigator.standalone", () => {
    mockWindow({
      matchMedia: () => ({ matches: false }),
      navigator: { standalone: true },
    });
    expect(isStandaloneMode()).toBe(true);
  });
});

describe("isIosSafari", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("returns true for iPhone Safari", () => {
    mockUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1"
    );
    expect(isIosSafari()).toBe(true);
    expect(isIosDevice()).toBe(true);
  });

  it("returns false for Chrome on iOS", () => {
    mockUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) CriOS/120.0.6099.119 Mobile/15E148 Safari/604.1"
    );
    expect(isIosSafari()).toBe(false);
  });

  it("returns false for Android Chrome", () => {
    mockUserAgent(
      "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
    );
    expect(isIosSafari()).toBe(false);
    expect(isAndroidDevice()).toBe(true);
  });
});

describe("isBeforeInstallPromptEvent", () => {
  it("detects deferred install prompt shape", () => {
    const event = {
      prompt: async () => {},
      userChoice: Promise.resolve({ outcome: "accepted" as const }),
    } as unknown as Event;
    expect(isBeforeInstallPromptEvent(event)).toBe(true);
  });
});
