# 트랙 목록 단위 플레이리스트 동작 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 트랙 목록 화면 헤더에 "⋯" 케밥 메뉴를 달아, 목록 전체(MRT는 선택분/전체)를 새 플레이리스트로 만들거나 기존 플레이리스트에 일괄 추가한다.

**Architecture:** 단일트랙 `PlaylistMenuContent`를 `trackIds[]`로 일반화하고, 스토어에 벌크 `addTracks`를 추가(백엔드·클라이언트 이미 벌크). 신규 `TrackListPlaylistMenu`(케밥) 컴포넌트를 공용 헤더(TrackModalMasthead) + PGT 탭 + 검색 + MRT에 드롭인. 새 백엔드 없음.

**Tech Stack:** Next.js 16(App Router), zustand, sonner(토스트), lucide. 검증 `cd web && npx tsc --noEmit` + `pnpm build`. 스토어 단위테스트 `pnpm test:unit`(vitest).

**규약:** 프론트 전용. push/merge 금지, feat/list-playlist-actions에 머무름. 기존 파일은 명시 부분만 수술적으로.

**런너:** `cd "/Volumes/MacExtend 1/MRMS_FN/web"` 에서 `npx tsc --noEmit`, `pnpm build`, `pnpm test:unit`.

**그라운딩(확인된 사실):**
- 토스트 = `sonner`의 `toast` (store에서 이미 사용).
- `lib/api/playlists.ts`: `addTracksToPlaylist(playlistId, trackIds[]) → {added, skipped}`, `createPlaylist(name, description, trackIds)`.
- `useNewPlaylistDialog().openDialog(trackIds?: string[])` — 배열. `NewPlaylistDialog`는 DashboardShell에 전역 마운트됨.
- `usePlaylistActionsEnabled()`(playlist-actions-context) — 비활성(공유/비로그인)이면 메뉴 숨김. `AddToPlaylistMenu`가 이걸로 게이팅.
- `CreatePlaylistModal`은 `MrtDashboard`에서만 사용 → MRT 교체 후 제거 가능.
- vitest 인프라 존재(`src/store/player.test.ts`).

---

## File Structure

생성:
- `web/src/components/playlist/TrackListPlaylistMenu.tsx` — 케밥 → PlaylistMenuContent.
- `web/src/store/playlist.test.ts` — addTracks 단위테스트.

수정:
- `web/src/store/playlist.ts` — `addTracks` 추가, `addTrack` 제거.
- `web/src/components/playlist/PlaylistMenuContent.tsx` — `trackIds[]` 일반화.
- `web/src/components/playlist/AddToPlaylistMenu.tsx`, `web/src/components/playlist/TrackContextMenu.tsx` — `[trackId]` 전달.
- `web/src/components/track/TrackModalMasthead.tsx` — 케밥.
- `web/src/components/mrms/PgtLibrary.tsx` — SectionHeader action + 탭들.
- `web/src/components/search/SearchResults.tsx` — 검색 트랙 케밥.
- `web/src/components/mrms/MrtDashboard.tsx` — 선택-인지 케밥, CreatePlaylistModal 제거.

제거:
- `web/src/components/playlist/CreatePlaylistModal.tsx`.

---

## Task 1: 스토어 벌크 `addTracks` (TDD)

**Files:**
- Modify: `web/src/store/playlist.ts`
- Test: `web/src/store/playlist.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`web/src/store/playlist.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock("@/lib/api/playlists", () => ({
  addTracksToPlaylist: vi.fn(),
  createPlaylist: vi.fn(),
  deletePlaylist: vi.fn(),
  listPlaylists: vi.fn(),
  updatePlaylist: vi.fn(),
}));

import { usePlaylistStore } from "./playlist";
import { addTracksToPlaylist } from "@/lib/api/playlists";

describe("playlist store addTracks", () => {
  beforeEach(() => {
    usePlaylistStore.setState({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      playlists: [{ id: "p1", name: "P", track_count: 2 } as any],
      loaded: true,
    });
    vi.clearAllMocks();
  });

  it("벌크 추가 시 added만큼 bumpCount + {added,skipped} 반환", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (addTracksToPlaylist as any).mockResolvedValue({ added: 3, skipped: 1 });
    const res = await usePlaylistStore.getState().addTracks("p1", ["a", "b", "c", "d"]);
    expect(addTracksToPlaylist).toHaveBeenCalledWith("p1", ["a", "b", "c", "d"]);
    expect(res).toEqual({ added: 3, skipped: 1 });
    expect(usePlaylistStore.getState().playlists.find((p) => p.id === "p1")!.track_count).toBe(5);
  });

  it("빈 배열이면 API 호출 안 하고 {added:0,skipped:0}", async () => {
    const res = await usePlaylistStore.getState().addTracks("p1", []);
    expect(addTracksToPlaylist).not.toHaveBeenCalled();
    expect(res).toEqual({ added: 0, skipped: 0 });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && pnpm test:unit src/store/playlist.test.ts`
Expected: FAIL — `addTracks is not a function`.

- [ ] **Step 3: 구현**

`web/src/store/playlist.ts` `PlaylistState` 인터페이스에 추가(`addTrack` 줄을 `addTracks`로 교체):

```ts
  addTracks: (playlistId: string, trackIds: string[]) => Promise<{ added: number; skipped: number }>;
```

(주의: 이 태스크에서는 `addTrack` 줄을 **남겨두고** `addTracks`를 **추가만** 한다 — `addTrack` 제거는 Task 2에서 호출부 교체와 함께. 인터페이스에 둘 다 둔다.)

인터페이스에 `addTrack`은 그대로 두고 `addTracks`를 추가:
```ts
  addTrack: (playlistId: string, trackId: string) => Promise<void>;
  addTracks: (playlistId: string, trackIds: string[]) => Promise<{ added: number; skipped: number }>;
```

구현부(기존 `addTrack` 구현 아래)에 추가:
```ts
  addTracks: async (playlistId, trackIds) => {
    if (trackIds.length === 0) return { added: 0, skipped: 0 };
    const pl = get().playlists.find((p) => p.id === playlistId);
    const label = pl?.name ?? "플레이리스트";
    try {
      const { added, skipped } = await addTracksToPlaylist(playlistId, trackIds);
      if (added > 0) {
        get().bumpCount(playlistId, added);
        toast.success(
          skipped > 0 ? `'${label}'에 ${added}곡 추가 · ${skipped}곡 중복` : `'${label}'에 ${added}곡 추가`,
        );
      } else if (skipped > 0) {
        toast(`이미 '${label}'에 다 있어요`);
      }
      return { added, skipped };
    } catch (e) {
      toast.error((e as Error).message);
      return { added: 0, skipped: 0 };
    }
  },
```

- [ ] **Step 4: 통과 확인**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && pnpm test:unit src/store/playlist.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Commit**

```bash
git add web/src/store/playlist.ts web/src/store/playlist.test.ts
git commit -m "feat(playlist): 스토어 벌크 addTracks 액션"
```

---

## Task 2: PlaylistMenuContent `trackIds[]` 일반화 + 호출부 + addTrack 제거

**Files:**
- Modify: `web/src/components/playlist/PlaylistMenuContent.tsx`, `web/src/components/playlist/AddToPlaylistMenu.tsx`, `web/src/components/playlist/TrackContextMenu.tsx`, `web/src/store/playlist.ts`

- [ ] **Step 1: PlaylistMenuContent를 trackIds[]로**

`web/src/components/playlist/PlaylistMenuContent.tsx` 전체 교체:

```tsx
"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { usePlaylistStore } from "@/store/playlist";
import { useNewPlaylistDialog } from "@/store/new-playlist-dialog";

/** ＋버튼·우클릭·목록 케밥이 공유하는 2단계 메뉴. trackIds 1개=단일, N개=목록단위. */
export function PlaylistMenuContent({
  trackIds,
  onClose,
}: {
  trackIds: string[];
  onClose: () => void;
}) {
  const playlists = usePlaylistStore((s) => s.playlists);
  const addTracks = usePlaylistStore((s) => s.addTracks);
  const openNew = useNewPlaylistDialog((s) => s.openDialog);
  const [mode, setMode] = useState<"root" | "add">("root");
  const n = trackIds.length;
  const suffix = n > 1 ? ` (${n}곡)` : "";

  if (mode === "add") {
    return (
      <div>
        <button
          onClick={() => setMode("root")}
          className="w-full text-left px-3 py-2 font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute) border-0 border-b border-(--mrms-rule) bg-transparent cursor-pointer hover:bg-(--mrms-bg) flex items-center gap-1"
        >
          <ChevronLeft className="size-3" /> 뒤로
        </button>
        {playlists.length === 0 ? (
          <div className="px-3 py-2 font-mono text-[10px] text-(--mrms-ink-mute)">
            플레이리스트 없음
          </div>
        ) : (
          playlists.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                addTracks(p.id, trackIds);
                onClose();
              }}
              className="w-full text-left px-3 py-2 text-[12px] text-(--mrms-ink) border-0 border-b border-(--mrms-rule) last:border-b-0 bg-transparent cursor-pointer hover:bg-(--mrms-bg) truncate"
            >
              {p.name}
            </button>
          ))
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={() => {
          openNew(trackIds);
          onClose();
        }}
        className="w-full text-left px-3 py-2 font-mono text-[11px] tracking-editorial uppercase text-(--mrms-rust) border-0 border-b border-(--mrms-rule) bg-transparent cursor-pointer hover:bg-(--mrms-bg) flex items-center gap-1.5"
      >
        <Plus className="size-3" /> 플레이리스트 만들기{suffix}
      </button>
      <button
        onClick={() => setMode("add")}
        className="w-full text-left px-3 py-2 text-[12px] text-(--mrms-ink) border-0 bg-transparent cursor-pointer hover:bg-(--mrms-bg) flex items-center justify-between"
      >
        플레이리스트에 추가{suffix}
        <ChevronRight className="size-3.5 text-(--mrms-ink-mute)" />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: AddToPlaylistMenu 호출부**

`web/src/components/playlist/AddToPlaylistMenu.tsx`의 `<PlaylistMenuContent trackId={trackId} ... />` 를:
```tsx
          <PlaylistMenuContent trackIds={[trackId]} onClose={() => setOpen(false)} />
```

- [ ] **Step 3: TrackContextMenu 호출부**

`web/src/components/playlist/TrackContextMenu.tsx`의 `<PlaylistMenuContent trackId={trackId} onClose={close} />` 를:
```tsx
      <PlaylistMenuContent trackIds={[trackId]} onClose={close} />
```

- [ ] **Step 4: store에서 addTrack 제거**

먼저 다른 사용처 확인:
```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web" && grep -rn "\.addTrack\b\|addTrack:" src/ | grep -v addTracks
```
Expected: store 정의 2줄(인터페이스 + 구현)만 남음(호출부는 위에서 addTracks로 교체됨). 그러면 `web/src/store/playlist.ts`에서 `addTrack` 인터페이스 줄과 구현 블록(`addTrack: async (playlistId, trackId) => { ... },`)을 삭제.

- [ ] **Step 5: 타입체크 + 회귀 테스트**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit && pnpm test:unit src/store/playlist.test.ts`
Expected: tsc 에러 없음, 2 passed.

- [ ] **Step 6: Commit**

```bash
git add web/src/components/playlist/PlaylistMenuContent.tsx web/src/components/playlist/AddToPlaylistMenu.tsx web/src/components/playlist/TrackContextMenu.tsx web/src/store/playlist.ts
git commit -m "feat(playlist): PlaylistMenuContent trackIds[] 일반화 + addTrack→addTracks 통일"
```

---

## Task 3: TrackListPlaylistMenu (케밥)

**Files:**
- Create: `web/src/components/playlist/TrackListPlaylistMenu.tsx`

- [ ] **Step 1: 구현**

`web/src/components/playlist/TrackListPlaylistMenu.tsx` (AddToPlaylistMenu 드롭다운 패턴 미러, 트리거만 케밥):

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { MoreHorizontal } from "lucide-react";

import { usePlaylistActionsEnabled } from "./playlist-actions-context";
import { PlaylistMenuContent } from "./PlaylistMenuContent";

/** 트랙 목록 헤더용 "⋯" 케밥 — 목록 전체(trackIds)를 새 플레이리스트로 만들거나 추가. */
export function TrackListPlaylistMenu({ trackIds }: { trackIds: string[] }) {
  const enabled = usePlaylistActionsEnabled();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!enabled) return null;

  return (
    <div ref={ref} className="relative">
      <button
        aria-label="목록을 플레이리스트로"
        disabled={trackIds.length === 0}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="bg-transparent border-0 cursor-pointer p-1 disabled:opacity-30 disabled:cursor-default"
      >
        <MoreHorizontal className="size-4" stroke="var(--mrms-ink-mute)" strokeWidth={1.6} />
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="fixed inset-x-2 bottom-2 z-50 sm:absolute sm:inset-auto sm:right-0 sm:top-8 sm:bottom-auto sm:w-48 border border-(--mrms-ink) bg-(--mrms-paper) shadow-xl max-h-[50vh] overflow-y-auto"
        >
          <PlaylistMenuContent trackIds={trackIds} onClose={() => setOpen(false)} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: 타입체크 + Commit**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit`
Expected: 에러 없음.

```bash
git add web/src/components/playlist/TrackListPlaylistMenu.tsx
git commit -m "feat(playlist): TrackListPlaylistMenu 케밥 컴포넌트"
```

---

## Task 4: TrackModalMasthead 적용 (모달 일괄)

**Files:**
- Modify: `web/src/components/track/TrackModalMasthead.tsx`

- [ ] **Step 1: 케밥 추가**

`web/src/components/track/TrackModalMasthead.tsx` 상단 import에 추가:
```tsx
import { TrackListPlaylistMenu } from "@/components/playlist/TrackListPlaylistMenu";
```

`<PlayAllButton tracks={tracks} />` 줄 아래(같은 flex 안)에 케밥 추가:
```tsx
          <div className="flex items-center gap-2 shrink-0">
            <PlayAllButton tracks={tracks} />
            <TrackListPlaylistMenu trackIds={tracks.map((t) => t.track_id)} />
            {trailing}
          </div>
```

- [ ] **Step 2: 타입체크 + 빌드**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit && pnpm build`
Expected: tsc 에러 없음, `Compiled successfully`.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/track/TrackModalMasthead.tsx
git commit -m "feat(playlist): 트랙 모달 masthead에 목록 케밥(앨범/플레이리스트/EMP/검색앨범 일괄)"
```

---

## Task 5: PgtLibrary 적용 (좋아요/취향저격/앨범/아티스트)

**Files:**
- Modify: `web/src/components/mrms/PgtLibrary.tsx`

- [ ] **Step 1: import + SectionHeader에 action 슬롯**

`PgtLibrary.tsx` 상단 import에 추가:
```tsx
import { type ReactNode } from "react";
import { TrackListPlaylistMenu } from "@/components/playlist/TrackListPlaylistMenu";
```
(이미 `from "react"` import 줄이 있으면 거기에 `type ReactNode`만 추가.)

`SectionHeader` 컴포넌트를 action 슬롯 받도록 수정:
```tsx
function SectionHeader({
  num,
  title,
  meta,
  action,
}: {
  num: string;
  title: string;
  meta?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex justify-between items-baseline pb-2.5 border-b border-[var(--mrms-ink)] mb-6">
      <div>
        <span className="font-mono text-[10px] tracking-editorial uppercase text-[var(--mrms-ink-mute)]">
          {num}
        </span>
        &nbsp;&nbsp;
        <span className="font-display font-bold text-[20px]">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        {meta && (
          <span className="font-mono text-[11px] text-[var(--mrms-ink-soft)]">{meta}</span>
        )}
        {action}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: LikedTab / PctTab 케밥**

`LikedTab`의 `<SectionHeader num="L1" title="Liked tracks" meta={`${count} tracks`} />` 를:
```tsx
      <SectionHeader
        num="L1"
        title="Liked tracks"
        meta={`${count} tracks`}
        action={<TrackListPlaylistMenu trackIds={tracks.map((t) => t.track_id)} />}
      />
```
`PctTab`의 `<SectionHeader num="L5" title="PCT — 취향저격" meta={`${count} tracks`} />` 를:
```tsx
      <SectionHeader
        num="L5"
        title="PCT — 취향저격"
        meta={`${count} tracks`}
        action={<TrackListPlaylistMenu trackIds={tracks.map((t) => t.track_id)} />}
      />
```

- [ ] **Step 3: AlbumsTab / ArtistsTab 선택뷰 케밥**

`AlbumsTab`의 선택뷰 back 헤더(`selected &&` 블록의 `flex items-baseline gap-3` div)에서 `</button>`(back)·title·artist span 뒤, `<TrackList>` 직전에 케밥을 우측으로:
```tsx
          <div className="flex items-baseline gap-3 pb-2 mb-4 border-b border-[var(--mrms-ink)]">
            <button
              onClick={() => { setSelected(null); setTracks([]); }}
              className="bg-transparent border-0 p-0 cursor-pointer font-mono text-[10px] tracking-editorial uppercase text-[var(--mrms-ink-mute)] hover:text-[var(--mrms-rust)]"
            >
              ← back
            </button>
            <span className="font-display font-semibold text-[18px] leading-tight truncate">
              {selected.title}
            </span>
            <span className="font-mono text-[11px] text-[var(--mrms-ink-soft)]">
              <ArtistLink name={selected.artist} />
            </span>
            <div className="ml-auto">
              <TrackListPlaylistMenu trackIds={tracks.map((t) => t.track_id)} />
            </div>
          </div>
```
`ArtistsTab`의 선택뷰 back 헤더도 **동일 구조**(← back + 이름 span)다. 그 헤더 div의 마지막에 같은 `<div className="ml-auto"><TrackListPlaylistMenu trackIds={tracks.map((t) => t.track_id)} /></div>` 추가.

- [ ] **Step 4: 타입체크 + Commit**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit`
Expected: 에러 없음.

```bash
git add web/src/components/mrms/PgtLibrary.tsx
git commit -m "feat(playlist): PGT 좋아요/취향저격/앨범/아티스트 목록에 케밥"
```

---

## Task 6: 검색 트랙 적용

**Files:**
- Modify: `web/src/components/search/SearchResults.tsx`

- [ ] **Step 1: 케밥 추가**

`SearchResults.tsx` import에 추가:
```tsx
import { TrackListPlaylistMenu } from "@/components/playlist/TrackListPlaylistMenu";
```
Tracks 섹션(`data.tracks.length > 0 &&` 블록)의 `<SectionHeading>Tracks — {data.tracks.length}</SectionHeading>` 를, 헤딩과 케밥을 한 줄에 두도록:
```tsx
          <div className="flex items-center justify-between">
            <SectionHeading>Tracks — {data.tracks.length}</SectionHeading>
            <TrackListPlaylistMenu trackIds={data.tracks.map((t) => t.track_id)} />
          </div>
          <ModalTrackList tracks={data.tracks} />
```

- [ ] **Step 2: 타입체크 + Commit**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit`
Expected: 에러 없음.

```bash
git add web/src/components/search/SearchResults.tsx
git commit -m "feat(playlist): 검색 트랙 목록에 케밥"
```

---

## Task 7: MRT 통일 (선택-인지) + CreatePlaylistModal 제거

**Files:**
- Modify: `web/src/components/mrms/MrtDashboard.tsx`
- Remove: `web/src/components/playlist/CreatePlaylistModal.tsx`

- [ ] **Step 1: MRT "+ playlist" 버튼 → 케밥(선택-인지)**

`MrtDashboard.tsx` import에서 `CreatePlaylistModal` import 제거하고 추가:
```tsx
import { TrackListPlaylistMenu } from "@/components/playlist/TrackListPlaylistMenu";
```

기존 "+ playlist" 버튼(`disabled={selectedTracks.size === 0} onClick={() => setCreateOpen(true)}` 블록, line ~166–171)을 케밥으로 교체:
```tsx
          <TrackListPlaylistMenu
            trackIds={
              selectedTracks.size > 0
                ? [...selectedTracks]
                : mrt.recommended_tracks.map((t) => t.track_id)
            }
          />
```
(라벨 "Multi · select to make a playlist…"는 그대로 둬도 무방 — 선택 없으면 전체 대상이 됨.)

- [ ] **Step 2: createOpen 상태 + CreatePlaylistModal 렌더 제거**

`const [createOpen, setCreateOpen] = useState(false);` 줄(line ~41) 제거. 파일 하단 `<CreatePlaylistModal open={createOpen} onOpenChange={setCreateOpen} trackIds={[...selectedTracks]} ... />` 블록(line ~368–) 제거.

- [ ] **Step 3: CreatePlaylistModal 파일 삭제**

다른 사용처 없음 재확인 후 삭제:
```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web" && grep -rn "CreatePlaylistModal" src/ | grep -v "components/playlist/CreatePlaylistModal.tsx:"
```
Expected: 출력 없음(= MrtDashboard에서 제거됨). 그러면:
```bash
git rm web/src/components/playlist/CreatePlaylistModal.tsx
```

- [ ] **Step 4: 타입체크 + 빌드**

Run: `cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit && pnpm build`
Expected: tsc 에러 없음(미사용 import 0), `Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add web/src/components/mrms/MrtDashboard.tsx
git commit -m "feat(playlist): MRT 케밥 통일(선택분/전체) + CreatePlaylistModal 제거"
```

---

## 최종 검증 (모든 태스크 후)

- [ ] **단위테스트 + 타입 + 빌드**:
```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web" && pnpm test:unit src/store/playlist.test.ts && npx tsc --noEmit && pnpm build
```
Expected: vitest 2 passed, tsc 0, `Compiled successfully`.

- [ ] **수동 무회귀 확인 포인트**(리뷰용):
  - 단일트랙 ＋버튼/우클릭 메뉴가 기존대로(1곡 만들기/추가) 동작.
  - 모달(앨범/플레이리스트/EMP)·검색·PGT(좋아요/취향저격/앨범/아티스트)·MRT 헤더에 "⋯" 케밥 노출, 만들기/추가 동작.
  - 추가 시 토스트 "N곡 추가(+중복)".
