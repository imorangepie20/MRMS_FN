"use client";

import { useDraggable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";

import { usePlaylistActionsEnabled } from "./playlist-actions-context";

function Grip({ trackId }: { trackId: string }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `track:${trackId}`,
    data: { type: "track", trackId },
  });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      aria-label="드래그해서 플레이리스트에 추가"
      onClick={(e) => e.stopPropagation()}
      className={`absolute left-0 top-0 bottom-0 z-10 hidden sm:flex items-center cursor-grab active:cursor-grabbing bg-transparent border-0 p-0 text-(--mrms-ink-mute) touch-none ${
        isDragging ? "opacity-40" : "opacity-0 group-hover:opacity-100"
      } transition-opacity`}
    >
      <GripVertical className="size-3.5" />
    </button>
  );
}

/** DnD 가용(대시보드)에서만 grip 렌더. 비대시보드/공유 페이지엔 DndContext가 없으므로
 *  null(useDraggable 미호출). */
export function TrackDragHandle({ trackId }: { trackId: string }) {
  const enabled = usePlaylistActionsEnabled();
  if (!enabled) return null;
  return <Grip trackId={trackId} />;
}
