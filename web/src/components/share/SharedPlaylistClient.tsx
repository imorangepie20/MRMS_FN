"use client";

import { useEffect, useState } from "react";

import { ConnectToPlay } from "@/components/player/ConnectToPlay";
import { ModalTrackList, PlayAllButton, type ModalTrack } from "@/components/track/ModalTrackList";
import { useUser } from "@/lib/hooks/use-user";
import { getShared, type SharedPlaylist } from "@/lib/api/shared";


function CenteredNote({ text }: { text: string }) {
  return (
    <div className="py-32 text-center font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">
      {text}
    </div>
  );
}

function fmtDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

/** 첫 트랙 커버들을 살짝 회전·겹쳐 부채꼴 스택으로 — 히어로 우측 장식(데스크톱). */
function CoverFan({ tracks }: { tracks: ModalTrack[] }) {
  const covers = tracks
    .map((t) => t.album_cover)
    .filter((c): c is string => !!c)
    .slice(0, 4);
  if (covers.length === 0) return null;
  const mid = (covers.length - 1) / 2;
  return (
    <div className="pointer-events-none absolute bottom-12 right-8 z-10 hidden items-end lg:flex xl:right-16">
      {covers.map((c, i) => (
        <div
          key={i}
          className="relative -ml-12 size-[150px] overflow-hidden rounded-[2px] ring-1 ring-(--mrms-paper)/45 shadow-[0_22px_55px_-12px_rgba(31,26,22,.75)] first:ml-0 xl:size-[176px]"
          style={{
            transform: `rotate(${(i - mid) * 6}deg) translateY(${Math.abs(i - mid) * 10}px)`,
            zIndex: i,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={c} alt="" className="size-full object-cover" />
        </div>
      ))}
    </div>
  );
}


export function SharedPlaylistClient({ shareId }: { shareId: string }) {
  const { user } = useUser();
  const [data, setData] = useState<SharedPlaylist | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getShared(shareId)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [shareId]);

  const connected = !!user?.primary_platform;

  if (loading) return <CenteredNote text="Loading…" />;
  if (error || !data) return <CenteredNote text="공유가 없거나 해제된 링크입니다" />;

  const { playlist, tracks } = data;
  const totalMs = tracks.reduce((a, t) => a + (t.duration_ms ?? 0), 0);
  const dot = <span className="text-(--mrms-paper)/35">·</span>;

  return (
    <div>
      {/* ─── 히어로 (풀블리드) ─── */}
      <section className="relative w-full overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/visuals/share-hero.jpg"
          alt=""
          className="absolute inset-0 size-full object-cover object-center"
        />
        {/* 좌측 워밍 스크림(텍스트 가독) + 하단 페이드(페이지 bg로 연결) */}
        <div className="absolute inset-0 bg-gradient-to-r from-(--mrms-ink)/88 via-(--mrms-ink)/55 to-(--mrms-ink)/10" />
        <div className="absolute inset-x-0 bottom-0 h-36 bg-gradient-to-t from-(--mrms-bg) to-transparent" />

        <CoverFan tracks={tracks} />

        <div className="relative mx-auto flex min-h-[380px] max-w-[900px] flex-col justify-end px-5 pb-12 pt-20 md:min-h-[480px] md:px-8 md:pb-16 md:pt-28">
          <div className="max-w-[640px]">
            <div className="font-mono text-[11px] uppercase tracking-editorial text-(--mrms-paper)/70">
              <span className="text-(--mrms-rust)">◆</span> Shared Playlist
              {playlist.owner_name ? ` · ${playlist.owner_name}` : ""}
            </div>
            <h1
              className="mt-2 font-serif font-bold leading-[1.0] tracking-[-0.02em] text-(--mrms-paper) text-[42px] md:text-[68px]"
              style={{ textShadow: "0 2px 28px rgba(31,26,22,.5)" }}
            >
              {playlist.name}
            </h1>
            {playlist.description && (
              <p className="mt-3 max-w-[520px] text-[15px] leading-relaxed text-(--mrms-paper)/80">
                {playlist.description}
              </p>
            )}
            <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] uppercase tracking-editorial text-(--mrms-paper)/85">
              <span className="tabular-nums">{tracks.length} tracks</span>
              {totalMs > 0 && (
                <>
                  {dot}
                  <span className="tabular-nums">{fmtDuration(totalMs)}</span>
                </>
              )}
              {dot}
              <span>on MRMS</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── 본문 ─── */}
      <div className="mx-auto max-w-[900px] px-5 md:px-8">
        <div className="-mt-1 mb-9">
          {connected ? <PlayAllButton tracks={tracks} /> : <ConnectToPlay />}
        </div>

        <div className="mb-3 flex items-end justify-between gap-4 border-b border-(--mrms-ink) pb-1">
          <h2 className="font-serif font-bold leading-none text-(--mrms-ink) text-[20px] md:text-[24px]">
            Tracklist
          </h2>
          <span className="shrink-0 font-mono text-[10px] uppercase tracking-editorial tabular-nums text-(--mrms-ink-mute)">
            {tracks.length} tracks
          </span>
        </div>
        <ModalTrackList tracks={tracks} showCover />
      </div>
    </div>
  );
}
