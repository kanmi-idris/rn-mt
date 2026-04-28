import "./globals.css";

import type { Metadata } from "next";
import { IBM_Plex_Mono, Source_Sans_3 } from "next/font/google";
import type { ReactNode } from "react";

const bodyFont = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

const monoFont = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "rn-mt Docs",
    template: "%s | rn-mt Docs",
  },
  description:
    "Simple, detailed documentation for the rn-mt multitenancy conversion platform.",
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" className={`${bodyFont.variable} ${monoFont.variable}`}>
      <body className="docs-root">{children}</body>
    </html>
  );
}
