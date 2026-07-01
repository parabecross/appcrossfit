import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Inter, Oswald } from "next/font/google";
import { buildSiteMetadata } from "@/lib/seo/site";

const inter = Inter({ subsets: ["latin"], variable: "--font-geist-sans" });
const oswald = Oswald({ subsets: ["latin"], variable: "--font-display" });

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
      <body
        className={`${inter.variable} ${oswald.variable} min-h-screen bg-background font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
