"use client";

import { ListMusic } from "lucide-react";
import { useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { loadAndPlay } from "@/lib/tidal-player";
import { usePlayerStore } from "@/store/player";


export function QueueDrawer() {
  const [open, setOpen] = useState(false);
  const queue = usePlayerStore((s) => s.queue);
  const currentIdx = usePlayerStore((s) => s.currentIdx);

  const onJump = async (idx: number) => {
    usePlayerStore.setState({ currentIdx: idx, position: 0 });
    try {
      await loadAndPlay(queue[idx].tidal_track_id);
    } catch (e) {
      usePlayerStore.setState({ errorMsg: (e as Error).message });
    }
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Queue"
        className="inline-flex items-center justify-center h-9 w-9 rounded hover:bg-muted touch-manipulation"
      >
        <ListMusic className="h-4 w-4" />
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:w-96 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>큐 ({queue.length}곡)</SheetTitle>
        </SheetHeader>
        {queue.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">큐가 비어 있습니다.</p>
        ) : (
          <ol className="mt-4 space-y-1">
            {queue.map((t, i) => (
              <li key={`${t.track_id}_${i}`}>
                <button
                  onClick={() => onJump(i)}
                  className={`w-full text-left flex items-center gap-2 p-2 rounded hover:bg-muted touch-manipulation ${
                    i === currentIdx ? "bg-muted font-medium" : ""
                  }`}
                >
                  <span className="w-6 text-xs text-muted-foreground tabular-nums">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm">{t.title}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {t.artist}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ol>
        )}
      </SheetContent>
    </Sheet>
  );
}
