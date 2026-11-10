import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getServerEnvironment } from "@/server/config/environment";

import "./globals.css";

export const metadata: Metadata = {
  title: "ReorderLens — Project initialization",
  description: "ReorderLens application foundation. Product workflows are under development.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  getServerEnvironment();

  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
