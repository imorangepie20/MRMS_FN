import type { Metadata } from "next";
import { DM_Mono } from "next/font/google";

import {
  ClassicalShowcase,
  type ShowcaseCopy,
} from "@/components/classical/ClassicalShowcase";
import { fetchVideoSection } from "@/lib/server/classical-fetch";

const dmMono = DM_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-dm-mono",
  display: "swap",
});

const JAZZ_COPY: ShowcaseCopy = {
  kicker: "Reel 01 · The Jazz Sessions",
  titleLead: "재즈 공연 ",
  titleEm: "실황",
  runline: "Play full set",
  slate: "세계 재즈 페스티벌 · Live Sets",
  sectionLabel: "The Sessions",
  footer: "MRMS · Jazz Archive — 클럽과 페스티벌의 밤, 첫 곡부터 앙코르까지",
  emptyTitle: "곧 무대가 열립니다",
  emptySub: "재즈 공연 실황 · 준비 중",
};

export const metadata: Metadata = {
  title: "재즈 공연 실황 · MRMS",
  description:
    "세계 재즈 페스티벌의 풀콘서트 — 노스시 재즈부터 몽트뢰까지, 첫 곡부터 앙코르까지.",
  openGraph: {
    title: "재즈 공연 실황 · MRMS",
    description: "세계 재즈 페스티벌 풀콘서트 아카이브",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "재즈 공연 실황 · MRMS",
    description: "세계 재즈 페스티벌 풀콘서트 아카이브",
  },
};

export const dynamic = "force-dynamic";

export default async function JazzPage() {
  const videos = await fetchVideoSection("video:jazz-live");
  return (
    <div className={dmMono.variable} style={{ background: "#0a0807", minHeight: "100vh" }}>
      <ClassicalShowcase videos={videos} copy={JAZZ_COPY} />
    </div>
  );
}
