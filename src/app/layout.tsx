import type { Metadata } from "next";
import type { ReactNode } from "react";
import localFont from "next/font/local";

import { getServerEnvironment } from "@/server/config/environment";

import "./globals.css";

const manrope = localFont({
  src: "./fonts/manrope-latin-variable.woff2",
  weight: "200 800",
  style: "normal",
  display: "swap",
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "ReorderLens",
  description: "A secure workspace for inventory intelligence and replenishment planning.",
  robots: { index: false, follow: false },
  icons: { icon: "/branding/reorderlens-logo.png" },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  getServerEnvironment();

  return (
    <html lang="en" className={`dark ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
