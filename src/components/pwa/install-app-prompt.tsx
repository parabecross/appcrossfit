"use client";

import { useCallback, useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  dismissInstallPrompt,
  isAndroidDevice,
  isBeforeInstallPromptEvent,
  isDismissedInstallPrompt,
  isIosSafari,
  isStandaloneMode,
  type BeforeInstallPromptEvent,
} from "@/lib/pwa/detect";

export function InstallAppPrompt({
  placement = "socio",
}: {
  /** socio: above mobile tab bar; auth: login/register without bottom nav */
  placement?: "socio" | "auth";
}) {
  const t = useTranslations("pwa");
  const [visible, setVisible] = useState(false);
  const [mode, setMode] = useState<"android" | "ios" | null>(null);
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }

    if (isStandaloneMode() || isDismissedInstallPrompt()) return;

    const ios = isIosSafari();
    const android = isAndroidDevice();

    if (ios) {
      setMode("ios");
      setVisible(true);
      return;
    }

    if (!android) return;

    const onBeforeInstall = (event: Event) => {
      if (!isBeforeInstallPromptEvent(event)) return;
      event.preventDefault();
      setDeferredPrompt(event);
      setMode("android");
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () => window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  const handleDismiss = useCallback(() => {
    dismissInstallPrompt();
    setVisible(false);
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setVisible(false);
      }
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
    }
  }, [deferredPrompt]);

  if (!visible || !mode) return null;

  const positionClass =
    placement === "auth"
      ? "bottom-4 left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:max-w-sm"
      : "bottom-[4.75rem] left-4 right-4 md:bottom-6 md:left-auto md:right-6 md:max-w-sm";

  return (
    <div
      role="region"
      aria-label={t("title")}
      className={`fixed z-30 ${positionClass} animate-in slide-in-from-bottom-4 duration-300`}
    >
      <div className="rounded-xl border border-orange-500/25 bg-[#0a0a0a]/95 p-4 shadow-2xl shadow-black/50 backdrop-blur-md">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/15 text-orange-400">
            {mode === "android" ? (
              <Download className="h-5 w-5" aria-hidden />
            ) : (
              <Share className="h-5 w-5" aria-hidden />
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-sm font-semibold text-white">{t("title")}</p>
            <p className="text-xs leading-relaxed text-white/65">
              {mode === "android" ? t("androidHint") : t("iosHint")}
            </p>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="shrink-0 rounded-md p-1 text-white/40 transition hover:bg-white/5 hover:text-white/70"
            aria-label={t("dismiss")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {mode === "android" && deferredPrompt ? (
          <Button
            type="button"
            size="sm"
            className="mt-3 w-full bg-orange-500 text-white hover:bg-orange-600"
            onClick={handleInstall}
            disabled={installing}
          >
            {installing ? t("installing") : t("install")}
          </Button>
        ) : null}

        {mode === "ios" ? (
          <p className="mt-2 text-[11px] text-white/40">{t("iosSafariOnly")}</p>
        ) : null}
      </div>
    </div>
  );
}
