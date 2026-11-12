import type { Metadata } from "next";
import type { ReactNode } from "react";
import { connection } from "next/server";
import { manrope } from "@/lib/fonts";

import { getServerEnvironment } from "@/server/config/environment";

import "./globals.css";

export const metadata: Metadata = {
  title: "ReorderLens",
  description: "A secure workspace for inventory intelligence and replenishment planning.",
  robots: { index: false, follow: false },
  icons: { icon: "/branding/reorderlens-logo.png" },
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  // Per-response CSP nonces require request-time rendering, including /preview.
  await connection();
  getServerEnvironment();

  return (
    <html lang="en" className={`dark ${manrope.variable}`}>
      <body>{children}</body>
    </html>
  );
}
