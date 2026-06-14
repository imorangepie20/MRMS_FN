"use client";

import { useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { togglePlaylistShare } from "@/lib/api/shared";


interface Props {
  playlistId: string;
  initialShareId: string | null;
}


export function SharePlaylistButton({ playlistId, initialShareId }: Props) {
  const [shareId, setShareId] = useState<string | null>(initialShareId);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = shareId
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/p/${shareId}`
    : null;

  const enable = async () => {
    setBusy(true);
    try {
      const { share_id } = await togglePlaylistShare(playlistId, true);
      setShareId(share_id);
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    setBusy(true);
    try {
      await togglePlaylistShare(playlistId, false);
      setShareId(null);
      setCopied(false);
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (!shareId) {
    return (
      <Button onClick={enable} disabled={busy} variant="outline" size="sm">
        <Share2 className="h-4 w-4 mr-1" /> 공유
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={shareUrl ?? ""}
        onFocus={(e) => e.currentTarget.select()}
        className="flex-1 min-w-0 bg-(--mrms-paper) border border-(--mrms-ink) px-2 py-1 font-mono text-[11px] text-(--mrms-ink)"
      />
      <Button onClick={copy} variant="outline" size="sm" aria-label="링크 복사">
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
      </Button>
      <Button onClick={disable} disabled={busy} variant="ghost" size="sm">
        공유 해제
      </Button>
    </div>
  );
}
