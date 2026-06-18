"use client";

import { useState } from "react";

import { expandContainer } from "@/lib/api/search";
import type { SearchContainer, SearchResponse } from "@/lib/types";
import type { EmpSectionItem } from "@/lib/types";
import { ModalTrackList } from "@/components/track/ModalTrackList";
import { EmpItemCard } from "@/components/emp/EmpItemCard";
import { ItemTracksModal } from "@/components/emp/ItemTracksModal";
import { TrackListPlaylistMenu } from "@/components/playlist/TrackListPlaylistMenu";
import { SectionMasthead } from "@/components/visual/SectionMasthead";


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


function SectionHeading({ name, count }: { name: string; count: number }) {
  // imageKey=name(안정) → 결과 수가 바뀌어도 마스트헤드 사진 고정.
  return <SectionMasthead title={`${name} — ${count}`} imageKey={name} />;
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
            <SectionHeading name="Tracks" count={data.tracks.length} />
            <TrackListPlaylistMenu trackIds={data.tracks.map((t) => t.track_id)} />
          </div>
          <ModalTrackList tracks={data.tracks} />
        </div>
      )}

      {/* Albums */}
      {data.albums.length > 0 && (
        <div className="mb-8">
          <SectionHeading name="Albums" count={data.albums.length} />
          <ContainerGrid containers={data.albums} onCardClick={handleCardClick} />
        </div>
      )}

      {/* Playlists */}
      {data.playlists.length > 0 && (
        <div className="mb-8">
          <SectionHeading name="Playlists" count={data.playlists.length} />
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
