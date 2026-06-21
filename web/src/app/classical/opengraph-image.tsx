import { ImageResponse } from "next/og";

import { fetchClassicalVideos } from "@/lib/server/classical-fetch";

export const runtime = "nodejs";
export const alt = "클래식 공연 실황 · MRMS";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0a0807";
const ACCENT = "#e8b463";
const TEXT = "#f4ece0";
const MUTED = "#9a8d78";

// 다크 시네마틱 OG — 첫 공연 썸네일을 어둡게 깐 백드롭 + 레터박스 바 + 텅스텐 앰버.
// 영문 카피(Satori 기본 폰트로 안정 렌더). 커버 없으면 디자인된 다크 배경만.
export default async function Image() {
  const videos = await fetchClassicalVideos();
  const cover = videos[0]?.cover ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          background: BG,
          color: TEXT,
          fontFamily: "sans-serif",
        }}
      >
        {cover && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            width={1200}
            height={630}
            alt=""
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: "grayscale(45%) sepia(28%) brightness(42%) contrast(108%)",
            }}
          />
        )}
        {/* spotlight + cinematic floor */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(120% 95% at 50% 20%, rgba(232,180,99,0.18), transparent 56%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, #0a0807 9%, rgba(10,8,7,0.42) 46%, rgba(10,8,7,0.62))",
          }}
        />
        {/* letterbox bars */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 50,
            background: BG,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 64px",
            fontSize: 18,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "rgba(232,180,99,0.72)",
          }}
        >
          <div style={{ display: "flex" }}>Archive Broadcast — Restored Edition</div>
          <div style={{ display: "flex" }}>· 24 FPS</div>
        </div>
        <div
          style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 50, background: BG }}
        />
        {/* content */}
        <div
          style={{
            position: "absolute",
            left: 64,
            bottom: 104,
            display: "flex",
            flexDirection: "column",
            maxWidth: 1000,
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 22,
              letterSpacing: 8,
              textTransform: "uppercase",
              color: ACCENT,
              marginBottom: 20,
            }}
          >
            MRMS · Classical Archive
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              fontSize: 138,
              fontWeight: 800,
              lineHeight: 0.9,
              letterSpacing: -4,
              color: TEXT,
            }}
          >
            <div style={{ display: "flex" }}>CLASSICAL</div>
            <div style={{ display: "flex" }}>
              LIVE<div style={{ display: "flex", color: ACCENT }}>.</div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: 30,
              fontSize: 27,
              letterSpacing: 1,
              color: MUTED,
            }}
          >
            <div
              style={{ width: 56, height: 2, background: ACCENT, marginRight: 18, display: "flex" }}
            />
            World-orchestra full concerts — start to finish
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
