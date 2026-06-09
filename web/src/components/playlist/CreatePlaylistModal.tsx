"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { createPlaylist } from "@/lib/api/playlists";


interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trackIds: string[];
  onCreated?: (playlistId: string) => void;
}


export function CreatePlaylistModal({
  open,
  onOpenChange,
  trackIds,
  onCreated,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("이름을 입력하세요");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const pl = await createPlaylist(
        trimmed,
        description.trim() || null,
        trackIds,
      );
      onOpenChange(false);
      setName("");
      setDescription("");
      onCreated?.(pl.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--mrms-paper)] border-[var(--mrms-ink)] sm:max-w-[460px]">
        <DialogHeader>
          <DialogTitle className="font-display font-bold text-[var(--mrms-ink)] text-[20px]">
            New playlist
          </DialogTitle>
          <DialogDescription className="font-mono text-[10px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
            {trackIds.length} {trackIds.length === 1 ? "track" : "tracks"} selected
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-1">
          <Input
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            className="font-display"
          />
          <Textarea
            placeholder="Description (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="font-display resize-none"
          />
          {error && (
            <p className="font-mono text-[10px] uppercase tracking-editorial text-[var(--mrms-rust)]">
              {error}
            </p>
          )}
        </div>
        <DialogFooter className="gap-2">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="px-3 py-1.5 font-mono text-[10px] tracking-editorial uppercase border border-[var(--mrms-ink)] bg-transparent text-[var(--mrms-ink)] cursor-pointer disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="px-3 py-1.5 font-mono text-[10px] tracking-editorial uppercase border-0 bg-[var(--mrms-rust)] text-[var(--mrms-paper)] cursor-pointer disabled:opacity-40"
          >
            {submitting ? "Creating…" : "Create"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
