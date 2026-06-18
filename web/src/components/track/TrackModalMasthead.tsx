"use client";

import type { ReactNode } from "react";

import { TrackListPlaylistMenu } from "@/components/playlist/TrackListPlaylistMenu";
import { duotoneStyle, coverInitial } from "@/lib/cover-art";

import {
  type ModalTrack,
  PlayAllButton,
  formatTotalDuration,
} from "./ModalTrackList";


/** 트랙 모달 공용 masthead — 커버 + 킥커(타입·곡수·총길이) + 타이틀 + Play All.
 *  ItemTracksModal / AlbumDetailModal / PlaylistDetailModal 공용.
 *  titleSlot: Dialog 기반 모달은 a11y용 DialogTitle을 직접 넘김. */
export function TrackModalMasthead({
  kicker,
  title,
  titleSlot,
  cover,
  coverFallback,
  description,
  tracks,
  trailing,
}: {
  kicker: string;
  title: string;
  titleSlot?: ReactNode;
  cover?: string | null;
  coverFallback?: ReactNode;
  description?: string | null;
  tracks: ModalTrack[];
  trailing?: ReactNode;
}) {
  const total = formatTotalDuration(tracks);

  return (
    <div className="flex gap-4 items-start border-b-2 border-(--mrms-ink) pb-4">
      <div className="size-24 md:size-28 bg-(--mrms-rule) shrink-0 overflow-hidden">
        {cover ? (
          <img src={cover} alt="" className="size-full object-cover" />
        ) : (
          coverFallback ?? (
            <div
              className="size-full flex items-center justify-center"
              style={duotoneStyle(title)}
            >
              <span
                className="font-serif font-bold text-(--mrms-paper) leading-none"
                style={{ fontSize: "48px", textShadow: "0 2px 10px rgba(31,26,22,.32)" }}
              >
                {coverInitial(title)}
              </span>
            </div>
          )
        )}
      </div>

      <div className="min-w-0 flex-1 self-stretch flex flex-col">
        <div className="flex justify-between items-start gap-3">
          <div className="font-mono text-[9px] tracking-editorial uppercase text-(--mrms-ink-mute) pt-0.5">
            {kicker} · {tracks.length} tracks
            {total ? ` · ${total}` : ""}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <PlayAllButton tracks={tracks} />
            <TrackListPlaylistMenu trackIds={tracks.map((t) => t.track_id)} />
            {trailing}
          </div>
        </div>

        {titleSlot ?? (
          <h3
            className="font-display font-bold text-[22px] md:text-[26px] leading-[1.1] text-(--mrms-ink) mt-1 truncate"
            title={title}
          >
            {title}
          </h3>
        )}

        {description && (
          <p className="font-display italic text-[12px] text-(--mrms-ink-soft) line-clamp-2 mt-1">
            {description}
          </p>
        )}
      </div>
    </div>
  );
}
