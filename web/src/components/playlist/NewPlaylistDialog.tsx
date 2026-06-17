"use client";

import { useEffect, useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { usePlaylistStore } from "@/store/playlist";
import { useNewPlaylistDialog } from "@/store/new-playlist-dialog";

export function NewPlaylistDialog() {
  const { open, initialTrackIds, close } = useNewPlaylistDialog();
  const create = usePlaylistStore((s) => s.create);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setBusy(false);
    }
  }, [open]);

  const submit = async () => {
    const n = name.trim();
    if (!n || busy) return;
    setBusy(true);
    const pl = await create(n, initialTrackIds);
    if (pl) close();
    else setBusy(false);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="bg-(--mrms-paper) border-(--mrms-ink) sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="font-display font-bold text-(--mrms-ink) text-[20px]">
            새 플레이리스트
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 pt-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="플레이리스트 이름"
            className="border border-(--mrms-rule) bg-transparent px-3 py-2 text-[14px] text-(--mrms-ink) focus:outline-none focus:border-(--mrms-rust)"
          />
          {initialTrackIds.length > 0 && (
            <div className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">
              곡 {initialTrackIds.length}개와 함께 생성
            </div>
          )}
          <button
            onClick={submit}
            disabled={!name.trim() || busy}
            className="self-end px-4 py-2 bg-(--mrms-rust) text-(--mrms-paper) font-mono text-[11px] tracking-editorial uppercase border-0 cursor-pointer disabled:opacity-40"
          >
            {busy ? "만드는 중…" : "만들기"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
