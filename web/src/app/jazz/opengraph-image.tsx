import { ImageResponse } from "next/og";

import { fetchVideoSection } from "@/lib/server/classical-fetch";

export const runtime = "nodejs";
export const alt = "재즈 공연 실황 · MRMS";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#0a0807";
const ACCENT = "#e8b463";
const TEXT = "#f4ece0";
const MUTED = "#9a8d78";

// 다크 시네마틱 OG. 네이버 등이 1200×630을 자기 비율로 cover 크롭하며 좌우를 ~150px까지
// 잘라내므로, 콘텐츠를 가운데 정렬 + 작게 + 넉넉한 가로 여백으로 둬서 잘려도 여백만 잘리게.
export default async function Image() {
  const videos = await fetchVideoSection("video:jazz-live");
  const cover = videos[0]?.cover ?? null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
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
              filter: "grayscale(45%) sepia(28%) brightness(38%) contrast(108%)",
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(120% 95% at 50% 30%, rgba(232,180,99,0.18), transparent 58%)",
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(10,8,7,0.7), rgba(10,8,7,0.3) 50%, rgba(10,8,7,0.7))",
          }}
        />
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 46, background: BG }} />
        <div
          style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 46, background: BG }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "0 150px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontSize: 20,
              letterSpacing: 7,
              textTransform: "uppercase",
              color: ACCENT,
              marginBottom: 16,
            }}
          >
            MRMS · Jazz Archive
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              fontSize: 100,
              fontWeight: 800,
              lineHeight: 0.92,
              letterSpacing: -3,
              color: TEXT,
            }}
          >
            <div style={{ display: "flex" }}>JAZZ</div>
            <div style={{ display: "flex" }}>
              LIVE<div style={{ display: "flex", color: ACCENT }}>.</div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              marginTop: 26,
              fontSize: 22,
              letterSpacing: 1,
              color: MUTED,
            }}
          >
            <div
              style={{ width: 44, height: 2, background: ACCENT, marginRight: 14, display: "flex" }}
            />
            World jazz festivals — full sets, start to encore
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
