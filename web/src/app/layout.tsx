import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const plexSans = IBM_Plex_Sans({
  variable: "--font-sans-base",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});
const fraunces = Fraunces({
  variable: "--font-serif-base",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  // og:image 등 메타데이터의 절대 URL 기준. 미설정 시 self-host에선 localhost로 생성돼
  // 외부 크롤러(SNS/에디터)가 opengraph-image를 못 받아 미리보기 이미지가 안 뜬다.
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://mrms.approid.team",
  ),
  title: "MRMS",
  description: "Music Recommendation, personally curated",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${plexSans.variable} ${plexMono.variable} ${fraunces.variable} antialiased`}>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} disableTransitionOnChange>
          {children}
          <Toaster richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
