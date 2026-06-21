import type { Metadata } from "next";
import { DM_Mono } from "next/font/google";

import { ClassicalShowcase } from "@/components/classical/ClassicalShowcase";
import { fetchClassicalVideos } from "@/lib/server/classical-fetch";

// 방송 자막식 라벨용 모노 — 이 페이지에만 스코프. CSS 변수 --font-dm-mono로 전달.
const dmMono = DM_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-dm-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "클래식 공연 실황 · MRMS",
  description:
    "세계 정상 오케스트라의 풀콘서트 — 베를린 필부터 KBS교향악단까지, 처음부터 끝까지.",
  openGraph: {
    title: "클래식 공연 실황 · MRMS",
    description: "세계 오케스트라 풀콘서트 아카이브",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "클래식 공연 실황 · MRMS",
    description: "세계 오케스트라 풀콘서트 아카이브",
  },
};

// 데이터가 자주 바뀌지 않지만 항상 최신 섹션을 반영하도록 매 요청 렌더.
export const dynamic = "force-dynamic";

export default async function ClassicalPage() {
  const videos = await fetchClassicalVideos();
  return (
    <div className={dmMono.variable} style={{ background: "#0a0807", minHeight: "100vh" }}>
      <ClassicalShowcase videos={videos} />
    </div>
  );
}
