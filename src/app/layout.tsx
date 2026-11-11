import type { Metadata } from "next";
import { IBM_Plex_Sans_Thai, Mitr, Quicksand } from "next/font/google";
import "./globals.css";

const plexThai = IBM_Plex_Sans_Thai({
  variable: "--font-plex-thai",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
});

const mitr = Mitr({
  variable: "--font-mitr",
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600"],
});

const quicksand = Quicksand({
  variable: "--font-quicksand",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "Rimlay", template: "%s · Rimlay" },
  description: "ระบบจองโต๊ะร้าน Rimlay",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${plexThai.variable} ${mitr.variable} ${quicksand.variable} h-full`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
