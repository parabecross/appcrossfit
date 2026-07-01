import type { Metadata, Viewport } from "next";
import "./globals.css";
import { buildSiteMetadata } from "@/lib/seo/site";

export const metadata: Metadata = buildSiteMetadata("es");

export const viewport: Viewport = {
  themeColor: "#f97316",
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
