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
  es: "ATHRON — Train. Track. Progress. Plataforma para boxes de CrossFit: reservas, membresías, coaches y progreso de atletas.",
  en: "ATHRON — Train. Track. Progress. CrossFit box platform: bookings, memberships, coaches and athlete progress.",
};

const titles: Record<"es" | "en", string> = {
  es: `${APP_CONFIG.BRAND_NAME} — Gestión de boxes CrossFit`,
  en: `${APP_CONFIG.BRAND_NAME} — CrossFit box management`,
};

export function buildSiteMetadata(locale: "es" | "en" = "es"): Metadata {
  const siteUrl = getSiteUrl();
  const title = titles[locale];
  const description = descriptions[locale];
  const ogImage = `${siteUrl}/og-athron.jpg`;

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
          width: 1024,
          height: 1024,
          alt: "ATHRON — Train. Track. Progress.",
          type: "image/jpeg",
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
