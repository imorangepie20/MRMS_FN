"use client";

import { useState } from "react";

import { expandContainer } from "@/lib/api/search";
import type { SearchContainer, SearchResponse } from "@/lib/types";
import type { EmpSectionItem } from "@/lib/types";
import { ModalTrackList } from "@/components/track/ModalTrackList";
import { EmpItemCard } from "@/components/emp/EmpItemCard";
import { ItemTracksModal } from "@/components/emp/ItemTracksModal";
import { TrackListPlaylistMenu } from "@/components/playlist/TrackListPlaylistMenu";
import { PhotoBackdrop } from "@/components/visual/PhotoBackdrop";


/** Map a SearchContainer to the EmpSectionItem shape that EmpItemCard + ItemTracksModal expect. */
function toEmpItem(c: SearchContainer): EmpSectionItem {
  return {
    id: `${c.platform}:${c.platform_id}`,
    item_type: c.type,
    item_id: c.platform_id,
    title: c.title,
    cover_url: c.cover_url,
    display_order: 0,
  };
}


function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute) border-b border-(--mrms-ink) pb-1 px-3 -mx-3 mb-4">
      <PhotoBackdrop variant="band" src="/visuals/band.jpg" />
      <span className="relative">{children}</span>
    </div>
  );
}


function ContainerGrid({
  containers,
  onCardClick,
}: {
  containers: SearchContainer[];
  onCardClick: (c: SearchContainer) => void;
}) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4 mb-8">
      {containers.map((c) => (
        <EmpItemCard
          key={`${c.platform}:${c.platform_id}`}
          item={toEmpItem(c)}
          coverClassName="aspect-square w-full"
          titleTooltip
          onClick={() => onCardClick(c)}
        />
      ))}
    </div>
  );
}


export function SearchResults({ data }: { data: SearchResponse }) {
  const [activeItem, setActiveItem] = useState<EmpSectionItem | null>(null);

  const handleCardClick = async (c: SearchContainer) => {
    // Trigger backend ingestion first (fire-and-forget, best-effort)
    try {
      await expandContainer(c.platform, c.type, c.platform_id);
    } catch {
      // Proceed to open modal even if expand fails
    }
    setActiveItem(toEmpItem(c));
  };

  return (
    <div>
      {/* Tracks */}
      {data.tracks.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <SectionHeading>Tracks — {data.tracks.length}</SectionHeading>
            <TrackListPlaylistMenu trackIds={data.tracks.map((t) => t.track_id)} />
          </div>
          <ModalTrackList tracks={data.tracks} />
        </div>
      )}

      {/* Albums */}
      {data.albums.length > 0 && (
        <div className="mb-8">
          <SectionHeading>Albums — {data.albums.length}</SectionHeading>
          <ContainerGrid containers={data.albums} onCardClick={handleCardClick} />
        </div>
      )}

      {/* Playlists */}
      {data.playlists.length > 0 && (
        <div className="mb-8">
          <SectionHeading>Playlists — {data.playlists.length}</SectionHeading>
          <ContainerGrid containers={data.playlists} onCardClick={handleCardClick} />
        </div>
      )}

      {/* ItemTracksModal — same open/close pattern as EmpBrowse */}
      {activeItem && (
        <ItemTracksModal item={activeItem} onClose={() => setActiveItem(null)} />
      )}
    </div>
  );
}
