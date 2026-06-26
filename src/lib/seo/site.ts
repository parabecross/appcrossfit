import type { Metadata } from "next";
import { APP_CONFIG } from "@/lib/config/app-config";

export function getSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }
  return "https://appcrossfit.vercel.app";
}

const descriptions: Record<"es" | "en", string> = {
  es: "Plataforma para boxes de CrossFit. Reserva clases, gestiona membresías, coaches y el progreso de tus atletas. Entrena fuerte. Reserva fácil.",
  en: "CrossFit box management platform. Book classes, manage memberships, coaches and athlete progress. Train hard. Book easy.",
};

const titles: Record<"es" | "en", string> = {
  es: `${APP_CONFIG.BRAND_NAME} — Gestión de boxes CrossFit`,
  en: `${APP_CONFIG.BRAND_NAME} — CrossFit box management`,
};

export function buildSiteMetadata(locale: "es" | "en" = "es"): Metadata {
  const siteUrl = getSiteUrl();
  const title = titles[locale];
  const description = descriptions[locale];
  const ogImage = `${siteUrl}/opengraph-image`;

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: title,
      template: `%s | ${APP_CONFIG.BRAND_NAME}`,
    },
    description,
    applicationName: APP_CONFIG.BRAND_NAME,
    keywords: [
      "ATHRON",
      "CrossFit",
      "box",
      "reservas",
      "membresías",
      "gym management",
    ],
    authors: [{ name: APP_CONFIG.BRAND_NAME }],
    openGraph: {
      type: "website",
      locale: locale === "es" ? "es_MX" : "en_US",
      alternateLocale: locale === "es" ? ["en_US"] : ["es_MX"],
      url: siteUrl,
      siteName: APP_CONFIG.BRAND_NAME,
      title,
      description,
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: `${APP_CONFIG.BRAND_NAME} — CrossFit box platform`,
          type: "image/png",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}
