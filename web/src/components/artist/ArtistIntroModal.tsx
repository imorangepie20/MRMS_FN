"use client";

import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ModalTrackList, PlayAllButton } from "@/components/track/ModalTrackList";
import { fetchArtistIntro, type ArtistIntro } from "@/lib/api/artists";
import { useArtistModal } from "@/store/artist-modal";


export function ArtistIntroModal() {
  const name = useArtistModal((s) => s.name);
  const close = useArtistModal((s) => s.close);
  const [data, setData] = useState<ArtistIntro | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!name) {
      setData(null);
      setError(false);
      return;
    }
    let mounted = true;
    setData(null);
    setError(false);
    setLoading(true);
    fetchArtistIntro(name)
      .then((d) => mounted && setData(d))
      .catch(() => mounted && setError(true))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [name]);

  const hasContent = !!(
    data && (data.bio || data.image || (data.tracks?.length ?? 0) > 0)
  );
  // fetch 실패가 아니라 정상 응답인데 내용이 없을 때만 "정보 없어요".
  const empty = !loading && !error && !hasContent;

  return (
    <Dialog open={!!name} onOpenChange={(o) => !o && close()}>
      <DialogContent className="bg-(--mrms-paper) border-(--mrms-ink) sm:max-w-[720px] max-h-[82vh] overflow-hidden flex flex-col">
        <DialogHeader className="pr-8">
          <div className="flex gap-4 items-start">
            {data?.image && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.image}
                alt=""
                className="size-20 object-cover border border-(--mrms-rule) shrink-0"
              />
            )}
            <div className="min-w-0">
              <div className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">
                Artist
              </div>
              <DialogTitle className="font-display font-bold text-(--mrms-ink) text-[22px] md:text-[26px] leading-[1.1] mt-1 truncate">
                {name ?? "—"}
              </DialogTitle>
              {data?.genres?.length ? (
                <div className="mt-1 font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-soft) truncate">
                  {data.genres.slice(0, 4).join(" · ")}
                </div>
              ) : null}
            </div>
          </div>
        </DialogHeader>
        <div className="overflow-y-auto -mx-6 px-6">
          {loading && (
            <div className="py-8 text-center font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">
              Loading…
            </div>
          )}
          {!loading && data?.bio && (
            <p className="text-[14px] text-(--mrms-ink-soft) leading-relaxed mb-4">
              {data.bio}
            </p>
          )}
          {!loading && (data?.tracks?.length ?? 0) > 0 && (
            <>
              <div className="flex items-center justify-between mb-2 pb-2 border-b border-(--mrms-ink)">
                <span className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">
                  Tracks — {data!.tracks.length}
                </span>
                <PlayAllButton tracks={data!.tracks} />
              </div>
              <ModalTrackList tracks={data!.tracks} />
            </>
          )}
          {!loading && error && (
            <div className="py-8 text-center font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">
              아티스트 정보를 불러오지 못했어요
            </div>
          )}
          {empty && (
            <div className="py-8 text-center font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">
              이 아티스트 정보가 아직 없어요
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
