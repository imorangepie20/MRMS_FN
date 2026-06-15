# 공유 플레이리스트 Open Graph 미리보기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/p/{shareId}` 공유 링크를 에디터/SNS에 붙여넣으면 미리보기 카드에 **플레이리스트 제목 + 앨범 2×2 커버**가 보이도록 동적 OG 이미지 + 메타를 서버에서 생성한다.

**Architecture:** (1) `get_playlist_tracks`가 `EMPSource.cover_url`을 LATERAL로 끌어와 공유 트랙에 커버를 채운다(공유 페이지 본문도 부수 개선). (2) `p/[shareId]/page.tsx`를 server component로 전환해 `generateMetadata`를 달고, 현재 client UI는 `SharedPlaylistClient.tsx`로 분리. (3) `p/[shareId]/opengraph-image.tsx`가 공유 API를 서버 fetch해 `ImageResponse`(next/og)로 editorial 1200×630 카드를 렌더.

**Tech Stack:** Next 16 app router(`next/og` ImageResponse, `opengraph-image`, `generateMetadata`), raw psycopg, FastAPI 공유 API, pytest.

**참고 — 절대 경로:** 루트 `/Volumes/MacExtend 1/MRMS_FN`. 러너 `.venv/bin/pytest`, 린트 `.venv/bin/ruff`(line-length 100). 프론트 `web/`(`npx tsc --noEmit`, `pnpm lint`, `pnpm build`).

**editorial hex 토큰(ImageResponse는 CSS-var 불가 → 리터럴 사용):** bg `#f5f0e8` · paper `#faf6ee` · ink `#1a1815` · ink-soft `#5b554c` · ink-mute `#8a8378` · rule `#d8cfbf` · rust `#c44518`.

**⚠️ DB 격리:** dev DB 격리 안 됨 — 대상 파일만, 전체 `pytest tests/` 금지. 커버 적재(upsert_track_and_emp_source)는 내부 commit → cleanup 픽스처 등록.

---

### Task 1: 공유 트랙에 앨범 커버 채우기 (`get_playlist_tracks`)

**Files:**
- Modify: `src/mrms/db/playlist.py` (`get_playlist_tracks`)
- Test: `tests/db/test_playlist.py`

- [ ] **Step 1: 실패하는 테스트 추가**

`tests/db/test_playlist.py` 끝에 추가(파일 상단에 `from mrms.emp.base import upsert_track_and_emp_source` 없으면 추가):

```python
def test_get_playlist_tracks_includes_album_cover(db_conn, cleanup):
    """get_playlist_tracks가 EMPSource.cover_url을 album_cover로 채운다(공유 페이지/OG용)."""
    from mrms.emp.base import upsert_track_and_emp_source

    user_id = get_or_create_user(db_conn, f"plcov-{_uuid.uuid4().hex[:8]}@test.com")
    r = upsert_track_and_emp_source(
        db_conn, isrc=None, title="Cov Song", artist="Cov Artist",
        album_title="Cov Album", duration_ms=180000, platform="youtube",
        platform_track_id="YTPLCOV", source_type="station",
        source_id="station:plcov", source_name="Station",
        cover_url="https://example.com/plcov600.jpg",
    )
    tid = r["track_id"]
    db_conn.commit()
    cleanup('DELETE FROM "EMPSource" WHERE source_id = %s', ("station:plcov",))
    cleanup('DELETE FROM "TrackPlatform" WHERE "trackId" = %s', (tid,))
    cleanup('DELETE FROM "Track" WHERE id = %s', (tid,))
    cleanup('DELETE FROM "UserTrack" WHERE "userId" = %s', (user_id,))

    pid = create_playlist(
        db_conn, user_id=user_id, name="Cov PL", description=None, track_ids=[tid]
    )
    cleanup('DELETE FROM "Playlist" WHERE id = %s', (pid,))
    cleanup('DELETE FROM "PlaylistTrack" WHERE "playlistId" = %s', (pid,))

    tracks = get_playlist_tracks(db_conn, pid)
    assert len(tracks) == 1
    assert tracks[0]["album_cover"] == "https://example.com/plcov600.jpg"
```

(파일 상단 import에 `get_playlist_tracks`가 이미 있는지 확인 — `from mrms.db.playlist import (... get_playlist_tracks ...)`. 없으면 추가. `_uuid`/`get_or_create_user`/`create_playlist`는 이미 import됨.)

- [ ] **Step 2: 테스트 실패 확인**

Run: `.venv/bin/pytest tests/db/test_playlist.py::test_get_playlist_tracks_includes_album_cover -v`
Expected: FAIL — 현재 `album_cover`가 항상 None이라 단언 실패.

- [ ] **Step 3: get_playlist_tracks 수정**

`src/mrms/db/playlist.py`의 `get_playlist_tracks`를 다음으로 교체(EMPSource LATERAL + album_cover 채움):

```python
def get_playlist_tracks(
    conn: psycopg.Connection, playlist_id: str
) -> list[dict]:
    """Playlist 안 트랙 (position 순). album_cover는 EMPSource.cover_url(있으면)."""
    with conn.cursor() as cur:
        cur.execute(
            '''SELECT t.id, t.title, a.name AS artist,
                      al.id AS album_id, al.title AS album_title,
                      tp_tidal."platformTrackId" AS tidal_track_id,
                      tp_spotify."platformTrackId" AS spotify_track_id,
                      t."durationMs" AS duration_ms,
                      ec.cover_url AS album_cover
               FROM "PlaylistTrack" pt
               JOIN "Track" t ON t.id = pt."trackId"
               JOIN "Artist" a ON a.id = t."artistId"
               LEFT JOIN "Album" al ON al.id = t."albumId"
               LEFT JOIN "TrackPlatform" tp_tidal
                 ON tp_tidal."trackId" = t.id AND tp_tidal.platform = 'tidal'
               LEFT JOIN "TrackPlatform" tp_spotify
                 ON tp_spotify."trackId" = t.id AND tp_spotify.platform = 'spotify'
               LEFT JOIN LATERAL (
                 SELECT cover_url FROM "EMPSource"
                 WHERE "trackId" = t.id AND cover_url IS NOT NULL LIMIT 1
               ) ec ON TRUE
               WHERE pt."playlistId" = %s
               ORDER BY pt.position''',
            (playlist_id,),
        )
        rows = cur.fetchall()
    return [
        {
            "track_id": r[0],
            "title": r[1],
            "artist": r[2],
            "album_id": r[3],
            "album_title": r[4],
            "album_cover": r[8],
            "tidal_track_id": r[5],
            "spotify_track_id": r[6],
            "duration_ms": r[7],
        }
        for r in rows
    ]
```

- [ ] **Step 4: 테스트 통과 + 회귀 확인**

Run: `.venv/bin/pytest tests/db/test_playlist.py -v`
Expected: PASS (신규 + 기존 — 기존 테스트들은 album_cover를 단언 안 하므로 무영향).

- [ ] **Step 5: lint + Commit**

Run: `.venv/bin/ruff check src/mrms/db/playlist.py tests/db/test_playlist.py`
Expected: 신규 위반 없음.

```bash
git add src/mrms/db/playlist.py tests/db/test_playlist.py
git commit -m "feat(share): get_playlist_tracks에 EMPSource.cover_url(공유 트랙 커버) — OG/공유페이지용"
```

---

### Task 2: 공유 페이지 server 전환 + generateMetadata + client 분리

**Files:**
- Create: `web/src/lib/server/shared-fetch.ts` (서버 fetch 헬퍼 — generateMetadata·opengraph-image 공용)
- Create: `web/src/components/share/SharedPlaylistClient.tsx` (현재 client UI 이동)
- Modify: `web/src/app/p/[shareId]/page.tsx` (server component로 전환)

- [ ] **Step 1: 서버 fetch 헬퍼 작성**

`web/src/lib/server/shared-fetch.ts` 신규:

```typescript
// 서버(generateMetadata·opengraph-image)에서 공유 플레이리스트를 무인증 조회.
// next.config rewrites와 동일 소스(NEXT_PUBLIC_MRMS_API_URL)로 백엔드 직접 호출.
export interface SharedMeta {
  playlist: { name: string; description: string | null; owner_name: string | null };
  tracks: { album_cover: string | null }[];
}

export async function fetchSharedMeta(shareId: string): Promise<SharedMeta | null> {
  const base = process.env.NEXT_PUBLIC_MRMS_API_URL ?? "http://127.0.0.1:8000";
  try {
    const r = await fetch(`${base}/api/shared/${encodeURIComponent(shareId)}`, {
      cache: "no-store",
    });
    if (!r.ok) return null;
    return (await r.json()) as SharedMeta;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: 현재 client UI를 SharedPlaylistClient로 이동**

`web/src/components/share/SharedPlaylistClient.tsx` 신규(현재 `page.tsx` 본문을 `shareId` prop 받게 옮김 — `use(params)` 제거):

```tsx
"use client";

import { useEffect, useState } from "react";

import { ConnectToPlay } from "@/components/player/ConnectToPlay";
import { ModalTrackList, PlayAllButton } from "@/components/track/ModalTrackList";
import { useUser } from "@/lib/hooks/use-user";
import { getShared, type SharedPlaylist } from "@/lib/api/shared";


function CenteredNote({ text }: { text: string }) {
  return (
    <div className="py-20 text-center font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">
      {text}
    </div>
  );
}


export function SharedPlaylistClient({ shareId }: { shareId: string }) {
  const { user } = useUser();
  const [data, setData] = useState<SharedPlaylist | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getShared(shareId)
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [shareId]);

  const connected = !!user?.primary_platform;

  if (loading) return <CenteredNote text="Loading…" />;
  if (error || !data) return <CenteredNote text="공유가 없거나 해제된 링크입니다" />;

  return (
    <div className="mx-auto max-w-[760px] px-4 md:px-0 py-8">
      <div className="font-mono text-[11px] tracking-editorial uppercase text-(--mrms-ink-mute)">
        Shared Playlist
        {data.playlist.owner_name ? ` · ${data.playlist.owner_name}` : ""}
      </div>
      <h1 className="font-display font-bold text-(--mrms-ink) text-[28px] md:text-[34px] leading-[1.1] mt-1">
        {data.playlist.name}
      </h1>
      {data.playlist.description && (
        <p className="mt-2 text-(--mrms-ink-soft) text-sm">
          {data.playlist.description}
        </p>
      )}

      <div className="mt-4">
        {connected ? <PlayAllButton tracks={data.tracks} /> : <ConnectToPlay />}
      </div>

      <div className="mt-6">
        <ModalTrackList tracks={data.tracks} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: page.tsx를 server component로 교체**

`web/src/app/p/[shareId]/page.tsx`를 다음으로 **전체 교체**(`"use client"` 제거 → server, generateMetadata + client child 렌더):

```tsx
import type { Metadata } from "next";

import { SharedPlaylistClient } from "@/components/share/SharedPlaylistClient";
import { fetchSharedMeta } from "@/lib/server/shared-fetch";


export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareId: string }>;
}): Promise<Metadata> {
  const { shareId } = await params;
  const data = await fetchSharedMeta(shareId);
  const name = data?.playlist?.name ?? "Shared playlist";
  const count = data?.tracks?.length ?? 0;
  const description = data
    ? `${count} tracks · shared on MRMS`
    : "Shared playlist on MRMS";
  // og:image / twitter:image는 같은 폴더의 opengraph-image.tsx가 Next에 의해 자동 주입됨.
  return {
    title: `${name} · MRMS`,
    description,
    openGraph: { title: name, description, type: "music.playlist" },
    twitter: { card: "summary_large_image", title: name, description },
  };
}


export default async function SharedPlaylistPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  return <SharedPlaylistClient shareId={shareId} />;
}
```

- [ ] **Step 4: 타입체크 + lint + 빌드**

Run:
```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit -p tsconfig.json
```
Expected: 에러 없음.

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web" && pnpm lint 2>&1 | grep -E "SharedPlaylistClient|shared-fetch|p/\[shareId\]" | grep -iv "canonical" || echo "NO NON-CANONICAL FINDINGS"
```
Expected: `NO NON-CANONICAL FINDINGS`(또는 pre-existing canonical-class 경고만).

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web" && pnpm build 2>&1 | grep -E "Compiled successfully|Failed|Error:|/p/\[shareId\]" | head
```
Expected: `Compiled successfully` + `/p/[shareId]` 라우트 존재(컴파일 에러 없음).

- [ ] **Step 5: Commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/lib/server/shared-fetch.ts web/src/components/share/SharedPlaylistClient.tsx web/src/app/p/[shareId]/page.tsx
git commit -m "feat(share): 공유 페이지 server 전환 + generateMetadata(og 메타) + SharedPlaylistClient 분리"
```

---

### Task 3: 동적 OG 이미지 (`opengraph-image.tsx`)

**Files:**
- Create: `web/src/app/p/[shareId]/opengraph-image.tsx`

editorial 1200×630 카드 — 좌측 2×2 앨범 커버 그리드 + 우측 제목/메타/CTA. 404·커버 0개 폴백. `next/og` `ImageResponse`(satori: 자식 2개 이상 div는 `display:'flex'` 필수, 리터럴 hex).

- [ ] **Step 1: opengraph-image 작성**

`web/src/app/p/[shareId]/opengraph-image.tsx` 신규:

```tsx
import { ImageResponse } from "next/og";

import { fetchSharedMeta } from "@/lib/server/shared-fetch";

export const runtime = "nodejs";
export const alt = "Shared playlist on MRMS";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BG = "#f5f0e8";
const PAPER = "#faf6ee";
const INK = "#1a1815";
const MUTE = "#8a8378";
const RULE = "#d8cfbf";
const RUST = "#c44518";

export default async function Image({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  const data = await fetchSharedMeta(shareId);

  const rawName = data?.playlist?.name ?? "Shared playlist";
  const title = rawName.length > 58 ? `${rawName.slice(0, 58)}…` : rawName;
  const owner = data?.playlist?.owner_name ?? null;
  const tracks = data?.tracks ?? [];
  const covers = tracks
    .map((t) => t.album_cover)
    .filter((c): c is string => !!c)
    .slice(0, 4);
  const cells: (string | null)[] = [covers[0] ?? null, covers[1] ?? null,
    covers[2] ?? null, covers[3] ?? null];
  const meta = `${tracks.length} tracks${owner ? ` · by ${owner}` : ""}`;

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: BG,
          color: INK,
          padding: "52px 64px",
          fontFamily: "sans-serif",
        }}
      >
        {/* 상단바 */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", fontSize: 34, fontWeight: 800 }}>MRMS</div>
          <div
            style={{
              display: "flex",
              fontSize: 18,
              letterSpacing: 5,
              color: MUTE,
              textTransform: "uppercase",
            }}
          >
            Shared Playlist
          </div>
        </div>

        {/* 본문: 커버 그리드 + 텍스트 */}
        <div style={{ display: "flex", flex: 1, alignItems: "center", marginTop: 36 }}>
          {covers.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                width: 460,
                height: 460,
                marginRight: 56,
                border: `1px solid ${RULE}`,
              }}
            >
              {cells.map((c, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    width: 230,
                    height: 230,
                    background: PAPER,
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  {c ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c} width={230} height={230} style={{ objectFit: "cover" }} alt="" />
                  ) : (
                    <div style={{ display: "flex", fontSize: 56, color: RULE }}>♪</div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                width: 300,
                height: 300,
                marginRight: 56,
                alignItems: "center",
                justifyContent: "center",
                border: `2px solid ${INK}`,
                fontSize: 120,
                fontWeight: 800,
              }}
            >
              ♪
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
            <div style={{ display: "flex", fontSize: 64, fontWeight: 800, lineHeight: 1.05 }}>
              {title}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 24,
                letterSpacing: 2,
                color: MUTE,
                marginTop: 18,
                textTransform: "uppercase",
              }}
            >
              {meta}
            </div>
            <div
              style={{
                display: "flex",
                fontSize: 22,
                letterSpacing: 2,
                color: RUST,
                marginTop: 26,
                textTransform: "uppercase",
              }}
            >
              ▶ Listen on MRMS
            </div>
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
```

- [ ] **Step 2: 타입체크 + 빌드**

Run:
```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web" && npx tsc --noEmit -p tsconfig.json
```
Expected: 에러 없음.

```bash
cd "/Volumes/MacExtend 1/MRMS_FN/web" && pnpm build 2>&1 | grep -E "Compiled successfully|Failed|Error:|opengraph-image|/p/\[shareId\]" | head
```
Expected: `Compiled successfully` + `/p/[shareId]/opengraph-image` 라우트가 빌드에 잡힘(에러 없음).

> ImageResponse(satori) 렌더는 요청 시점이라 빌드만으론 완전 검증 불가 → Step 3 수동 검증.

- [ ] **Step 3: 수동 검증 (dev 또는 빌드 서버, 백엔드 `:8000` 기동 상태)**

1. 실제 공유 토큰으로 `GET /p/{shareId}/opengraph-image` → **200 + image/png**, 카드에 제목·커버·메타 보임.
2. `GET /p/{shareId}` 페이지 소스에 `<meta property="og:image" ...>`, `<meta property="og:title" ...>` 존재.
3. 없는 토큰 `GET /p/INVALID/opengraph-image` → 200 PNG(브랜드 폴백 카드, 그리드 없음, 제목 "Shared playlist").
4. 커버 없는 플레이리스트 → 폴백(♪ placeholder 셀 또는 그리드 생략) 정상.

(자동화는 satori 런타임 의존이라 생략 — tsc/build + 위 수동 확인이 검증.)

- [ ] **Step 4: Commit**

```bash
cd "/Volumes/MacExtend 1/MRMS_FN"
git add web/src/app/p/[shareId]/opengraph-image.tsx
git commit -m "feat(share): /p/[shareId] 동적 OG 이미지 — 제목+앨범 2×2 커버 editorial 카드"
```

---

## 수동 검증 (전체 완료 후)

1. 백엔드 배포 후 공유 페이지 본문에도 앨범 커버가 뜸(Task 1 부수 효과).
2. 공유 링크를 카카오톡/슬랙/이지웍에디터에 붙여넣기 → 제목 + 2×2 커버 카드 미리보기.
3. og 디버거(예: opengraph.xyz, 카톡)에서 `og:title`=제목, `og:image`=카드 확인.

---

## Self-Review (작성자 체크 결과)

**Spec coverage:** (1) `get_playlist_tracks` EMPSource.cover_url = Task 1, (2) page server 전환 + generateMetadata + client 분리 = Task 2, (3) opengraph-image 동적 카드(2×2 + 제목 + 폴백) = Task 3. 404/커버 0~3 폴백·editorial 톤·서버 fetch(NEXT_PUBLIC_MRMS_API_URL) 모두 반영. IBM Plex 폰트 로딩은 spec에서 YAGNI(시스템 sans).

**Placeholder scan:** 모든 스텝 실제 코드·명령·기대출력. satori 렌더 자동테스트는 런타임 의존이라 수동 검증으로 명시 위임(placeholder 아님). 그 외 없음.

**Type consistency:** `fetchSharedMeta`(shared-fetch.ts) 반환 `SharedMeta{playlist{name,description,owner_name}, tracks[]{album_cover}}` ↔ page generateMetadata·opengraph-image 사용 일치. `SharedPlaylistClient({shareId})` ↔ page 렌더 일치. `get_playlist_tracks` album_cover=r[8] ↔ SELECT 9번째 컬럼 ec.cover_url 일치 ↔ 공유 API `tracks[].album_cover` ↔ 프론트 ModalTrack/SharedMeta 일치. hex 리터럴 = globals.css 값과 일치.
