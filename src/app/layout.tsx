import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Businestra — credit sales & collections for Ghanaian distributors", template: "%s · Businestra" },
  description: "Track what every retailer owes you, enforce credit limits, record MoMo and cash collections, and send statements — built for wholesalers and distributors in Ghana.",
  applicationName: "Businestra",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = { themeColor: "#065f46", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GH">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
