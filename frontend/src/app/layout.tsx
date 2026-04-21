import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import DisclaimerBanner from "@/components/DisclaimerBanner";
import { LanguageProvider } from "@/lib/i18n/context";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "FintasTech · Research Lab",
  description:
    "Open-source educational framework for AI-driven stock research and on-chain paper-trading. NOT investment advice.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="flex min-h-screen pt-[26px]">
        <LanguageProvider>
          <DisclaimerBanner />
          <Sidebar />
          <main className="flex-1 overflow-y-auto lg:ml-60">{children}</main>
        </LanguageProvider>
      </body>
    </html>
  );
}
