import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Header } from "@/components/Header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Forecast Buddy",
  description: "A forecasting workbench for time-series data",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const year = new Date().getFullYear();

  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#0b0f1a] text-slate-200 min-h-screen`}
      >
        <Header />
        <main className="pt-16">{children}</main>
        <footer className="border-t border-slate-800 bg-slate-950/70">
          <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <p className="text-sm text-slate-500">
              © {year} ForecastBuddy. All rights reserved.
            </p>
            <nav className="flex flex-wrap items-center gap-4 text-sm">
              <Link href="/about" className="text-slate-400 hover:text-white transition-colors">
                About Us
              </Link>
              <Link href="/terms" className="text-slate-400 hover:text-white transition-colors">
                Terms & Conditions
              </Link>
              <Link href="/create" className="text-slate-400 hover:text-white transition-colors">
                Build
              </Link>
              <Link href="/explore" className="text-slate-400 hover:text-white transition-colors">
                Explore
              </Link>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
