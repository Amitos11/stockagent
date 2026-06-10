import type { Metadata } from "next";
import { Sora, Instrument_Sans, Spline_Sans_Mono } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sora",
  weight: ["500", "600", "700"],
});

const instrument = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument",
  weight: ["400", "500", "600"],
});

const splineMono = Spline_Sans_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-spline-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "StockAgent — Crystal Markets",
  description: "Live market screener — scan US & Israeli stocks, weighted by growth, profitability and valuation.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sora.variable} ${instrument.variable} ${splineMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
