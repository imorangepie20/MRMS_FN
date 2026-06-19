"use client";

import { useEffect, useRef } from "react";

import { usePlaylistActionsEnabled } from "./playlist-actions-context";
import { PlaylistMenuContent } from "./PlaylistMenuContent";
import { useTrackContextMenu } from "@/store/track-context-menu";
import { useRequireAuth } from "@/lib/hooks/use-require-auth";

/** 전역 단일 인스턴스(대시보드 레이아웃에 마운트). 모든 트랙 행(data-track-id) 위에서
 *  우클릭 시 브라우저 기본 메뉴 대신 add-to-playlist 메뉴를 커서 위치에 띄운다. */
export function TrackContextMenu() {
  const enabledCtx = usePlaylistActionsEnabled();
  const { isGuest } = useRequireAuth();
  // 비회원: 우클릭 플레이리스트 메뉴 비활성(공개 EMP 등에서 401 방지).
  const enabled = enabledCtx && !isGuest;
  const open = useTrackContextMenu((s) => s.open);
  const x = useTrackContextMenu((s) => s.x);
  const y = useTrackContextMenu((s) => s.y);
  const trackId = useTrackContextMenu((s) => s.trackId);
  const openAt = useTrackContextMenu((s) => s.openAt);
  const close = useTrackContextMenu((s) => s.close);
  const ref = useRef<HTMLDivElement>(null);

  // 전역 우클릭 가로채기 — data-track-id 요소 위에서만 동작.
  useEffect(() => {
    if (!enabled) return;
    const onCtx = (e: MouseEvent) => {
      const target = e.target as Element | null;
      const el = target?.closest?.("[data-track-id]");
      const id = el?.getAttribute("data-track-id");
      if (!id) return;
      e.preventDefault();
      openAt(e.clientX, e.clientY, id);
    };
    document.addEventListener("contextmenu", onCtx);
    return () => document.removeEventListener("contextmenu", onCtx);
  }, [enabled, openAt]);

  // 외부 클릭 / Esc 닫기.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  if (!enabled || !open || !trackId) return null;

  // 화면 밖으로 넘치지 않게 대략 클램프.
  const vw = typeof window !== "undefined" ? window.innerWidth : 0;
  const vh = typeof window !== "undefined" ? window.innerHeight : 0;
  const left = vw ? Math.min(x, vw - 200) : x;
  const top = vh ? Math.min(y, vh - 220) : y;

  return (
    <div
      ref={ref}
      onClick={(e) => e.stopPropagation()}
      style={{ left, top }}
      className="fixed z-[60] w-48 border border-(--mrms-ink) bg-(--mrms-paper) shadow-xl max-h-[60vh] overflow-y-auto"
    >
      <PlaylistMenuContent trackIds={[trackId]} onClose={close} />
    </div>
  );
}
