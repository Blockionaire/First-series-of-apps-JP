import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Theme is server-rendered from the cookie — no flash of wrong theme.
  const theme = (await cookies()).get("stai_theme")?.value === "light" ? "light" : "dark";
  return (
    <html lang="en" data-theme={theme}>
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
