"use client";

import { use, useEffect, useState } from "react";

import { ConnectToPlay } from "@/components/player/ConnectToPlay";
import { ModalTrackList, PlayAllButton } from "@/components/track/ModalTrackList";
import { useUser } from "@/lib/hooks/use-user";
import { getShared, type SharedPlaylist } from "@/lib/api/shared";


function CenteredNote({ text }: { text: string }) {
  return (
    <div className="py-20 text-center font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">
      {text}
    </div>
  );
}


export default function SharedPlaylistPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = use(params);
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

  return (
    <div className="mx-auto max-w-[760px] px-4 md:px-0 py-8">
      <div className="font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">
        Shared Playlist
        {data.playlist.owner_name ? ` · ${data.playlist.owner_name}` : ""}
      </div>
      <h1 className="font-display font-bold text-(--mrms-ink) text-[28px] md:text-[34px] leading-[1.1] mt-1">
        {data.playlist.name}
      </h1>
      {data.playlist.description && (
        <p className="mt-2 text-(--mrms-ink-soft) text-sm">
          {data.playlist.description}
        </p>
      )}

      <div className="mt-4">
        {connected ? <PlayAllButton tracks={data.tracks} /> : <ConnectToPlay />}
      </div>

      <div className="mt-6">
        <ModalTrackList tracks={data.tracks} />
      </div>
    </div>
  );
}
