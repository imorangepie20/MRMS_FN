"use client";

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";

import { usePlaylistStore } from "@/store/playlist";
import { useNewPlaylistDialog } from "@/store/new-playlist-dialog";

export function PlaylistDndProvider({ children }: { children: React.ReactNode }) {
  const addTrack = usePlaylistStore((s) => s.addTrack);
  const openNew = useNewPlaylistDialog((s) => s.openDialog);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const onDragEnd = (e: DragEndEvent) => {
    const trackId = e.active.data.current?.trackId as string | undefined;
    const overId = e.over?.id;
    if (!trackId || overId == null) return;
    if (overId === "playlist-new") {
      openNew([trackId]);
    } else if (typeof overId === "string" && overId.startsWith("playlist:")) {
      addTrack(overId.slice("playlist:".length), trackId);
    }
  };

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      {children}
    </DndContext>
  );
}
