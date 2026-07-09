import type { Metadata, Viewport } from "next";
import "./globals.css";
import Header from "@/components/chrome/Header";
import Footer from "@/components/chrome/Footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://stai.ai"),
  title: {
    default: "STAI — Signal & training for audit intelligence",
    template: "%s — STAI",
  },
  description:
    "The intelligence platform for audit, accountancy and finance professionals across Europe. Editorial analysis, an audit-grade prompt library, Ask STAI, podcasts, research, and live training programmes.",
};

export const viewport: Viewport = {
  themeColor: "#0E1726",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        <Header />
        <main id="main">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
