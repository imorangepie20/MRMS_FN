"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";


// GET /api/auth/youtube/playlists → { playlists: [...], total }
interface YouTubePlaylist {
  id: string;
  name: string;
  count: number;
  thumbnail?: string | null;
}

interface PlaylistsResponse {
  playlists?: YouTubePlaylist[];
  total?: number;
  detail?: string;
  error?: string;
}

// POST /api/auth/youtube/import 응답 — 구현에 따라 필드명이 달라질 수 있어 넓게 받음
interface YouTubeImportResult {
  imported_count?: number;
  imported?: number;
  count?: number;
  tracks?: number;
  detail?: string;
  error?: string;
}


function pickImportedCount(r: YouTubeImportResult): number | null {
  const candidates = [r.imported_count, r.imported, r.count, r.tracks];
  for (const c of candidates) {
    if (typeof c === "number") return c;
  }
  return null;
}


export function YouTubeImportButton() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [playlists, setPlaylists] = useState<YouTubePlaylist[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const loadPlaylists = useCallback(async () => {
    setLoading(true);
    setError(null);
    setPlaylists(null);
    setSelected(new Set());
    try {
      const r = await fetch("/api/auth/youtube/playlists", {
        credentials: "include",
      });

      // 401(미인증) + 404(YouTube 미연동) 둘 다 '먼저 연결' 안내로 처리.
      // 백엔드 _get_access_token은 spotify/tidal과 동일하게 미연동 시 404를 낸다.
      if (r.status === 401 || r.status === 404) {
        toast.error("먼저 YouTube 계정을 연결해주세요");
        setOpen(false);
        return;
      }

      const data: PlaylistsResponse = await r.json().catch(() => ({}));

      if (!r.ok) {
        setError(data.detail ?? data.error ?? `목록을 불러오지 못했습니다 (${r.status})`);
        return;
      }

      setPlaylists(data.playlists ?? []);
    } catch (e) {
      setError(`목록을 불러오지 못했습니다: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleOpen = () => {
    setOpen(true);
    void loadPlaylists();
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleImport = async () => {
    if (importing || selected.size === 0) return;
    setImporting(true);
    try {
      const r = await fetch("/api/auth/youtube/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playlist_ids: Array.from(selected),
          include_liked: false,
        }),
        credentials: "include",
      });

      // 401(미인증) + 404(YouTube 미연동) 둘 다 '먼저 연결' 안내로 처리.
      if (r.status === 401 || r.status === 404) {
        toast.error("먼저 YouTube 계정을 연결해주세요");
        return;
      }

      const data: YouTubeImportResult = await r.json().catch(() => ({}));

      if (!r.ok) {
        toast.error(data.detail ?? data.error ?? `가져오기 실패 (${r.status})`);
        return;
      }

      const count = pickImportedCount(data);
      toast.success(
        count != null
          ? `YouTube에서 ${count}곡을 가져왔습니다`
          : "선택한 플레이리스트를 가져왔습니다",
      );
      setOpen(false);
    } catch (e) {
      toast.error(`가져오기 실패: ${(e as Error).message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <>
      <Button
        onClick={handleOpen}
        variant="ghost"
        className="w-full"
        size="lg"
      >
        내 YouTube 플레이리스트 가져오기
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>YouTube 플레이리스트 선택</DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
              <Spinner />
              목록을 불러오는 중...
            </div>
          ) : error ? (
            <div className="space-y-4">
              <p className="text-sm text-destructive">{error}</p>
              <Button onClick={() => void loadPlaylists()} className="w-full">
                다시 시도
              </Button>
            </div>
          ) : playlists && playlists.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              가져올 플레이리스트가 없습니다
            </p>
          ) : playlists ? (
            <div className="space-y-3">
              <ul className="max-h-72 space-y-1 overflow-y-auto">
                {playlists.map((pl) => {
                  const checked = selected.has(pl.id);
                  return (
                    <li key={pl.id}>
                      <label
                        className="flex cursor-pointer items-center gap-3 rounded-lg p-2 transition-colors hover:bg-muted"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggle(pl.id)}
                        />
                        {pl.thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={pl.thumbnail}
                            alt=""
                            className="size-10 shrink-0 rounded-md object-cover"
                          />
                        ) : (
                          <div className="size-10 shrink-0 rounded-md bg-muted" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{pl.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">
                            {pl.count}곡
                          </p>
                        </div>
                      </label>
                    </li>
                  );
                })}
              </ul>

              <Button
                onClick={handleImport}
                className="w-full"
                disabled={importing || selected.size === 0}
              >
                {importing
                  ? "가져오는 중..."
                  : `선택한 ${selected.size}개 가져오기`}
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
