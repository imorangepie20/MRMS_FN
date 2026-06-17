import { ImageResponse } from "next/og";

import { fetchSharedMeta, resolveCoverGrid } from "@/lib/server/shared-fetch";

export const runtime = "nodejs";
export const alt = "Shared playlist on MRMS";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#f5f0e8";
const PAPER = "#faf6ee";
const INK = "#1a1815";
const MUTE = "#8a8378";
const RULE = "#d8cfbf";
const RUST = "#c44518";

export default async function Image({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const data = await fetchSharedMeta(shareId);

  const rawName = data?.playlist?.name ?? "Shared playlist";
  const title = rawName.length > 58 ? `${rawName.slice(0, 58)}…` : rawName;
  const owner = data?.playlist?.owner_name ?? null;
  const tracks = data?.tracks ?? [];
  // album_cover(EMPSource) 우선, 없으면 /api/artwork(iTunes)로 서버 resolve → 2×2 그리드.
  const covers = await resolveCoverGrid(tracks, 4);
  const cells: (string | null)[] = [
    covers[0] ?? null,
    covers[1] ?? null,
    covers[2] ?? null,
    covers[3] ?? null,
  ];
  const meta = `${tracks.length} tracks${owner ? ` · by ${owner}` : ""}`;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: BG,
          color: INK,
          padding: "52px 64px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", fontSize: 34, fontWeight: 800 }}>MRMS</div>
          <div
            style={{
              display: "flex",
              fontSize: 18,
              letterSpacing: 5,
              color: MUTE,
              textTransform: "uppercase",
            }}
          >
            Shared Playlist
          </div>
        </div>

        <div style={{ display: "flex", flex: 1, alignItems: "center", marginTop: 36 }}>
          {covers.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                // satori 기본 box-sizing=border-box — border 1px가 안쪽 폭을 458로 줄여
                // 230×2 셀이 한 줄로 못 들어가 1열로 깨짐. content-box로 안쪽 460 유지(2×2).
                boxSizing: "content-box",
                width: 460,
                height: 460,
                marginRight: 56,
                border: `1px solid ${RULE}`,
              }}
            >
              {cells.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    width: 230,
                    height: 230,
                    background: PAPER,
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {c ? (
                    <img src={c} width={230} height={230} style={{ objectFit: "cover" }} alt="" />
                  ) : (
                    <div style={{ display: "flex", fontSize: 56, color: RULE }}>♪</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                width: 300,
                height: 300,
                marginRight: 56,
                alignItems: "center",
                justifyContent: "center",
                border: `2px solid ${INK}`,
                fontSize: 120,
                fontWeight: 800,
              }}
            >
              ♪
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", fontSize: 64, fontWeight: 800, lineHeight: 1.05 }}>
              {title}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 24,
                letterSpacing: 2,
                color: MUTE,
                marginTop: 18,
                textTransform: "uppercase",
              }}
            >
              {meta}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 22,
                letterSpacing: 2,
                color: RUST,
                marginTop: 26,
                textTransform: "uppercase",
              }}
            >
              ▶ Listen on MRMS
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
