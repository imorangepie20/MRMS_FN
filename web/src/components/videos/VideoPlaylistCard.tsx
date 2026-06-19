"use client";

import { duotoneStyle, coverInitial } from "@/lib/cover-art";
import { useVideoPlaylist } from "@/store/video-playlist";

/** "New" 섹션의 장르 비디오 플레이리스트 카드. 클릭 → 그 플레이리스트 영상 모달. */
export function VideoPlaylistCard({
  uuid,
  title,
  coverUrl,
}: {
  uuid: string;
  title: string;
  coverUrl: string | null;
}) {
  const open = useVideoPlaylist((s) => s.open);
  return (
    <button
      onClick={() => open(uuid, title)}
      style={{ containerType: "inline-size" }}
      className="group w-full text-left bg-transparent border-0 p-0 cursor-pointer"
    >
      <div className="relative w-full aspect-square overflow-hidden bg-(--mrms-rule)">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center" style={duotoneStyle(title)}>
            <span
              className="font-serif font-bold text-(--mrms-paper)"
              style={{ fontSize: "40cqw", textShadow: "0 2px 10px rgba(31,26,22,.32)" }}
            >
              {coverInitial(title)}
            </span>
          </div>
        )}
        <span className="absolute top-1.5 left-1.5 px-1.5 py-px bg-(--mrms-paper)/90 border border-(--mrms-ink) text-(--mrms-ink) font-mono text-[9px] tracking-editorial uppercase leading-none">
          videos
        </span>
      </div>
      <div className="mt-1.5 font-display font-medium text-[12px] leading-snug text-(--mrms-ink) truncate group-hover:text-(--mrms-rust) transition-colors">
        {title}
      </div>
    </button>
  );
}
