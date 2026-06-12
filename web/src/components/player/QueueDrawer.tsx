"use client";

import { ListMusic, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AlbumArt } from "@/components/mrms/AlbumArt";
import { loadAndPlay } from "@/lib/player";
import { usePlayerStore } from "@/store/player";


export function QueueDrawer() {
  const [open, setOpen] = useState(false);
  const queue = usePlayerStore((s) => s.queue);
  const currentIdx = usePlayerStore((s) => s.currentIdx);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentRef = useRef<HTMLLIElement | null>(null);

  // 드로어 열릴 때 현재 재생 트랙으로 스크롤 (Sheet 애니메이션 후)
  useEffect(() => {
    if (!open) return;
    const id = setTimeout(() => {
      currentRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 200);
    return () => clearTimeout(id);
  }, [open, currentIdx]);

  const onJump = async (idx: number) => {
    usePlayerStore.setState({ currentIdx: idx, position: 0 });
    try {
      await loadAndPlay(queue[idx]);
    } catch (e) {
      usePlayerStore.setState({ errorMsg: (e as Error).message });
    }
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger
        aria-label="Queue"
        className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-editorial uppercase text-[var(--mrms-paper)]/55 hover:text-[var(--mrms-paper)] bg-transparent border-0 cursor-pointer"
      >
        <ListMusic className="size-3.5" />
        Queue {queue.length}
      </SheetTrigger>
      <SheetContent
        side="right"
        className="w-full sm:w-[420px] bg-[var(--mrms-bg)] border-l border-[var(--mrms-ink)] p-0 flex flex-col"
      >
        <SheetHeader className="px-6 pt-6 pb-3 border-b border-[var(--mrms-ink)]">
          <div className="font-mono text-[10px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
            Player · Queue
          </div>
          <SheetTitle className="font-display font-bold text-[22px] text-[var(--mrms-ink)] leading-tight flex justify-between items-baseline">
            Up next
            <span className="font-mono text-[11px] not-italic font-normal text-[var(--mrms-ink-soft)] tracking-normal normal-case">
              {queue.length} {queue.length === 1 ? "track" : "tracks"}
            </span>
          </SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto flex-1">
          {queue.length === 0 ? (
            <div className="py-16 text-center font-mono text-[11px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
              — queue empty —
            </div>
          ) : (
            <ol className="px-6 py-2">
              {queue.map((t, i) => {
                const isCurrent = i === currentIdx;
                return (
                  <li key={`${t.track_id}_${i}`} ref={isCurrent ? currentRef : undefined}>
                    <button
                      onClick={() => onJump(i)}
                      aria-current={isCurrent ? "true" : undefined}
                      className={`group w-full text-left grid grid-cols-[24px_44px_1fr] gap-3 py-2 items-center border-b border-[var(--mrms-rule)] last:border-b-0 cursor-pointer border-x-0 border-t-0 ${
                        isCurrent
                          ? "bg-[var(--mrms-rust)]/[0.07] -mx-6 px-6 border-b-transparent"
                          : "bg-transparent hover:bg-[var(--mrms-paper)]"
                      }`}
                    >
                      <span className="relative size-4 flex items-center justify-end">
                        {isCurrent ? (
                          <span
                            className="flex items-end justify-end gap-[2px] h-3.5"
                            aria-label={isPlaying ? "재생 중" : "일시정지"}
                          >
                            {[0, 1, 2].map((b) => (
                              <span
                                key={b}
                                className={`w-[2px] bg-[var(--mrms-rust)] ${isPlaying ? "mrms-eq-bar" : ""}`}
                                style={
                                  isPlaying
                                    ? { height: "100%", animationDelay: `${b * 0.18}s` }
                                    : { height: ["45%", "70%", "55%"][b] }
                                }
                              />
                            ))}
                          </span>
                        ) : (
                          <>
                            <span className="font-mono text-[11px] text-[var(--mrms-ink-mute)] tabular-nums group-hover:opacity-0 transition-opacity">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <span className="absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-end transition-opacity">
                              <Play
                                className="size-3 fill-[var(--mrms-ink)]"
                                stroke="none"
                              />
                            </span>
                          </>
                        )}
                      </span>
                      <AlbumArt
                        artist={t.artist}
                        album={t.album_title ?? null}
                        initialUrl={t.album_cover ?? null}
                        className="size-11"
                      />
                      <div className="min-w-0">
                        <div
                          className={`font-display text-[14px] leading-tight truncate ${isCurrent ? "font-bold text-[var(--mrms-rust)]" : "font-semibold text-[var(--mrms-ink)]"}`}
                          title={t.title}
                        >
                          {t.title}
                        </div>
                        <div
                          className="font-mono text-[11px] text-[var(--mrms-ink-soft)] mt-0.5 truncate"
                          title={t.artist}
                        >
                          {t.artist}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
