import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "autoreddit.ai — compliant Reddit management",
  description:
    "Schedule posts, manage replies, and draft with AI — through Reddit's official API, with disclosed automation and human-approved posting.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
