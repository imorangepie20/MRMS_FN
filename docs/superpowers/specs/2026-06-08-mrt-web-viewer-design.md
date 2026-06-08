# Sub-project E.0+1+2: Read-only MRT Web Viewer (Design)

**날짜**: 2026-06-08
**상태**: 디자인 (사용자 리뷰 대기)
**범위**: E.0 (FastAPI) + E.1 (Next.js scaffold, SDTPL_ADM 포크) + E.2 (MRT 페이지) — 브라우저로 본인 MRT 시각화

## 1. Goal

CLI에서만 보던 MRT를 브라우저에서 시각화. 본인 페르소나/추천 트랙/추천 앨범을 SDTPL_ADM 디자인 위에 표시.

이 단계는 **read-only**:
- 오디오 재생 X (E.5)
- 액션 (좋아요 등) X (E.6)
- 어드민 X (E.9)
- 멀티 유저 X (E.8)

`https://mrms.approid.team`로 Cloudflare Tunnel 라우팅 — Mac/모바일 모두 접근, E.5 (스트리밍, HTTPS 강제) 인프라 사전 준비.

## 2. Success Criteria

```bash
$ make api      # 터미널 1 — FastAPI on :8000
$ make web      # 터미널 2 — Next.js on :3500
$ make tunnel   # 터미널 3 — cloudflared

$ open https://mrms.approid.team
```

기대 화면:
1. `/` → `/mrt` 자동 이동
2. 헤더에 본인 이메일 + persona 수 (3) 표시
3. **페르소나 카드 × 3** (각 카드: idx, 클러스터 크기, top 5 곡)
4. **추천 트랙 테이블** (TanStack Table, top 20, similarity 정렬 가능)
5. **추천 앨범 그리드** (top 5 카드)
6. SDTPL 다크/라이트 테마 토글 동작
7. 표시 데이터가 `python3 scripts/09_view_mrt.py --email jacinto68@onlinecmk.com` 출력과 일치

재실행 안전: 페이지 새로고침 시 동일 결과 (DB latest 3 PlaylistHistory 기반).

## 3. Architecture

```
Browser (Mac Chrome / 모바일)
   ↓ https://mrms.approid.team
Cloudflare Tunnel — path-based ingress
   ├── /api/*     → localhost:8000  (FastAPI)
   ├── /callback/* → localhost:8080 (OAuth CallbackServer — 기존, CLI 실행 시)
   └── /*         → localhost:3500  (Next.js)

Next.js (port 3500) — SDTPL_ADM fork at MRMS_FN/web/
   - Server Components → fetch(/api/mrt/latest)
   - SDTPL 컴포넌트 재사용 (Layout, Card, TanStack Table, ThemeToggle)
   - 커스텀: components/mrms/*

FastAPI (port 8000) — MRMS_FN/src/mrms/api/
   - mrms.db.user_embedding.fetch_latest_playlists 그대로 import
   - mrms.recsys.mrt.derive_recommended_tracks / _albums 그대로 import
   - JSON 응답

PostgreSQL (port 5433) — UserEmbedding/UserPersona/PlaylistHistory/Track/Artist/Album
```

**단일 origin** (mrms.approid.team) → CORS 설정 불필요.

## 4. API Spec (FastAPI)

모든 endpoint는 `GET`, 응답 JSON.

### 4.1 `GET /api/health`

```json
{"status": "ok"}
```

### 4.2 `GET /api/user`

DEFAULT_USER_EMAIL 환경변수의 사용자 정보.

```json
{
  "user_id": "c143062cef205af6d44beaceb",
  "email": "jacinto68@onlinecmk.com",
  "displayName": null,
  "country": "AR",
  "personas_count": 3,
  "user_tracks_count": 334
}
```

### 4.3 `GET /api/mrt/latest`

가장 최근 MRT generation (PlaylistHistory 최신 3행 + derive).

```json
{
  "generated_at": "2026-06-08T17:30:12+00:00",
  "model_version": "our-v1.0+persona-K3",
  "personas": [
    {
      "persona_idx": 0,
      "track_count": 92,
      "playlist": [
        {
          "track_id": "c...",
          "title": "Move Away",
          "artist": "Culture Club",
          "album_id": "c...",
          "album_title": "This Time",
          "similarity": 0.988
        },
        ... (top-N 곡, query param top_n 기본 20)
      ]
    },
    ... (3 personas)
  ],
  "recommended_tracks": [
    {
      "track_id": "...",
      "title": "...",
      "artist": "...",
      "album_id": "...",
      "score": 0.988,
      "persona_idx": 0
    },
    ... (top-30)
  ],
  "recommended_albums": [
    {
      "album_id": "...",
      "title": "...",
      "artist": "...",
      "track_count": 2
    },
    ... (top-5)
  ]
}
```

Query params:
- `top_n` (default 20) — 페르소나당 표시 곡 수
- `top_tracks_n` (default 30) — 추천 트랙 갯수
- `top_albums_n` (default 15) — 추천 앨범 갯수

### 4.4 `GET /api/track/{track_id}` (선택, MVP 후속)

E.5에서 필요. 일단 E.0에선 구현 후순위.

## 5. Frontend Structure (Next.js / SDTPL_ADM fork)

`MRMS_FN/web/`:

```
src/
├── app/
│   ├── layout.tsx                # SDTPL 그대로 (theme provider, fonts)
│   ├── page.tsx                  # redirect /mrt
│   └── (dashboard)/
│       ├── layout.tsx            # SDTPL 그대로 (sidebar + header)
│       └── mrt/
│           └── page.tsx          # 메인 페이지 (Server Component)
├── components/
│   ├── (SDTPL 컴포넌트 그대로 — ui/, layout/)
│   └── mrms/                     # 우리 신규
│       ├── PersonaCard.tsx
│       ├── RecommendedTracksTable.tsx
│       └── RecommendedAlbumCard.tsx
├── lib/
│   ├── nav.ts                    # SDTPL 사이트맵 → 단순화 (MRT 1개만)
│   ├── api.ts                    # fetch wrapper
│   └── types.ts                  # API 응답 TS 타입
```

### 5.1 사이드바 간소화

`src/lib/nav.ts` 30+ 더미 라우트 → 단 1개로 변경:

```ts
export const NAV = [
  {
    title: 'Recommendations',
    items: [
      { label: 'MRT', href: '/mrt', icon: 'sparkles' }
    ]
  }
]
```

기타 라우트는 후속 E.x에서 활성화.

### 5.2 MRT 페이지 컴포넌트

```tsx
// app/(dashboard)/mrt/page.tsx
export default async function MrtPage() {
  const [user, mrt] = await Promise.all([
    fetch('/api/user').then(r => r.json()),
    fetch('/api/mrt/latest').then(r => r.json()),
  ])

  return (
    <div className="space-y-8">
      <Header user={user} />

      <section>
        <h2>페르소나</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {mrt.personas.map(p => <PersonaCard key={p.persona_idx} persona={p} />)}
        </div>
      </section>

      <section>
        <h2>추천 트랙</h2>
        <RecommendedTracksTable tracks={mrt.recommended_tracks} />
      </section>

      <section>
        <h2>추천 앨범</h2>
        <div className="grid md:grid-cols-5 gap-4">
          {mrt.recommended_albums.map(a => <RecommendedAlbumCard key={a.album_id} album={a} />)}
        </div>
      </section>
    </div>
  )
}
```

## 6. Data Flow

```
1. 브라우저 → https://mrms.approid.team/
2. Cloudflare Tunnel → localhost:3500 (Next.js)
3. Next.js: page.tsx → redirect /mrt
4. mrt/page.tsx (Server Component):
   - fetch('https://mrms.approid.team/api/user') → Tunnel → :8000 → FastAPI
   - fetch('https://mrms.approid.team/api/mrt/latest') → 동일
5. FastAPI:
   - get_or_create_user(DEFAULT_USER_EMAIL) → user_id
   - fetch_latest_playlists(conn, user_id, limit=3) → 3 페르소나 행
   - track_ids 모두 모아서 single ANY(%s) JOIN으로 메타 조회
   - playlists_with_scores 구성 → derive_recommended_tracks + derive_recommended_albums
   - JSON 응답
6. Next.js: SDTPL 레이아웃 + 우리 컴포넌트 렌더링
7. SDTPL 테마 (light/dark/system) + 사이드바 + 헤더 모두 동작
```

## 7. Dev Setup

### 7.1 새 디렉토리

```
MRMS_FN/web/             # SDTPL_ADM 복사 (SDTPL_ADM/src/, package.json, ...)
MRMS_FN/src/mrms/api/    # FastAPI 신규
```

`.gitignore` 추가:
```
web/node_modules/
web/.next/
web/.env.local
```

### 7.2 의존성

```
pyproject.toml: + fastapi>=0.110, + uvicorn[standard]>=0.27
web/package.json: SDTPL 그대로 (수정 X)
```

### 7.3 환경변수

```bash
# MRMS_FN/.env
DEFAULT_USER_EMAIL=jacinto68@onlinecmk.com
DATABASE_URL=postgresql://mrms:mrms@localhost:5433/mrms

# MRMS_FN/web/.env.local
NEXT_PUBLIC_API_BASE=/api   # same-origin이라 상대 경로
```

### 7.4 Cloudflare Tunnel config

`~/.cloudflared/config.yml`:

```yaml
tunnel: <UUID>
credentials-file: ~/.cloudflared/<UUID>.json
ingress:
  - hostname: mrms.approid.team
    path: /api/*
    service: http://localhost:8000
  - hostname: mrms.approid.team
    path: /callback/*
    service: http://localhost:8080
  - hostname: mrms.approid.team
    service: http://localhost:3500
  - service: http_status:404
```

기존 단일 서비스 라우팅에서 path-based로 변경.

### 7.5 Makefile

```makefile
.PHONY: api web tunnel install-web

install-web:
	cd web && pnpm install

api:
	.venv/bin/uvicorn mrms.api.main:app --host 127.0.0.1 --port 8000 --reload

web:
	cd web && pnpm dev -- --port 3500

tunnel:
	cloudflared tunnel run mrms
```

## 8. Error Handling

### 8.1 DB 연결 실패
- FastAPI startup 시 connection pool test → 실패 시 startup fail (로그 명시)

### 8.2 MRT 데이터 없음 (Generate 미실행)
- `/api/mrt/latest` 결과 `personas: []` → Next.js에서 "MRT 생성 필요 — `python3 scripts/09_generate_mrt.py --email <email>` 실행하세요" 메시지

### 8.3 환경변수 누락
- `DEFAULT_USER_EMAIL` 없으면 FastAPI startup fail
- `NEXT_PUBLIC_API_BASE` 기본값 `/api`

### 8.4 Tunnel down
- 브라우저: Cloudflare 1033 에러 → docs/cloudflare-tunnel-setup.md 참고 안내

## 9. Testing

### 9.1 단위 (FastAPI)
- `test_user_endpoint`: mock get_or_create_user → 200 + JSON 형식 검증
- `test_mrt_latest_endpoint`: mock fetch_latest_playlists + derive 함수 → 응답 구조 검증
- `test_no_mrt_data`: 빈 personas 응답

### 9.2 통합 (실제 DB)
- 본인 데이터로 endpoint hit → 200 + 정확한 트랙 수

### 9.3 E2E (Playwright — SDTPL_ADM 기존)
- `/` → `/mrt` redirect
- 페르소나 3개 카드 렌더링
- 테이블 정렬 동작
- 다크 모드 토글

### 9.4 수동 검증
- Mac 브라우저 + 모바일 (같은 WiFi 또는 외부) 접속 확인

## 10. Out of Scope

- ❌ 오디오 재생 / preview / 플레이어 (E.5)
- ❌ "내 취향이에요" 액션 / write (E.6)
- ❌ 비주얼 EQ (E.7)
- ❌ Auth / 멀티 유저 / 세션 (E.8)
- ❌ 어드민 (E.9)
- ❌ PGT/PCT 페이지 (E.3)
- ❌ EMP 페이지 (E.4)
- ❌ 디자인 변경 (SDTPL 컬러/타이포 그대로)
- ❌ 검색
- ❌ 무한 스크롤 / 가상화
- ❌ 모바일 최적화 (SDTPL 반응형 그대로 사용)
- ❌ Service Worker / PWA
- ❌ i18n
- ❌ 알림 / Toast
- ❌ 차트 (recharts 미사용)

## 11. 파일 변경 목록

### 신규
- `src/mrms/api/__init__.py`
- `src/mrms/api/main.py` (~100줄: FastAPI app, 4 endpoints, lifespan)
- `src/mrms/api/deps.py` (~40줄: DB connection)
- `tests/api/__init__.py`
- `tests/api/test_main.py`
- `web/` (SDTPL_ADM 전체 복사 + 커스터마이징)
  - `web/src/app/page.tsx`
  - `web/src/app/(dashboard)/mrt/page.tsx`
  - `web/src/components/mrms/PersonaCard.tsx`
  - `web/src/components/mrms/RecommendedTracksTable.tsx`
  - `web/src/components/mrms/RecommendedAlbumCard.tsx`
  - `web/src/lib/api.ts`
  - `web/src/lib/types.ts`
  - `web/src/lib/nav.ts` (단순화)
  - `web/.env.local.example`
- `Makefile`
- `.env.example` 업데이트 (DEFAULT_USER_EMAIL)
- `.gitignore` (web/ 항목)

### 수정
- `pyproject.toml`: + `fastapi>=0.110`, + `uvicorn[standard]>=0.27`
- `docs/cloudflare-tunnel-setup.md` — path-based ingress 추가

## 12. 가정 + 명시적 결정

- 본인 머신에서만 dev. cloudflared tunnel 본인이 관리
- DEFAULT_USER_EMAIL 환경변수 고정 (멀티 유저 X — E.8)
- SDTPL_ADM 코드 그대로 복사. fork 아닌 단방향 분리
- 단일 origin (mrms.approid.team) → CORS 불필요
- Next.js Server Components로 데이터 fetch (CSR 불필요)
- 테마 / 사이드바 / 명령 팔레트 등 SDTPL 기본 기능 그대로 유지

## 13. 구현 시 검증 필요 사항

1. **SDTPL_ADM Next.js 16 + React 19 호환성** — 모든 deps가 우리 노드 버전과 동작하는지 (Node 20+ 가정)
2. **TanStack Table v8 사용법** — SDTPL 코드 참고하여 추천 트랙 테이블 구현
3. **Cloudflare path-based ingress** — `/api/*` 매칭이 의도대로 동작 (curl로 검증)
4. **Server Component → API fetch** — `fetch()` 절대 URL 사용 시 SSR에서도 동작 확인

## 14. 후속 작업

- **E.3**: PGT/PCT 페이지 (사이드바에 추가, 동일 패턴)
- **E.4**: EMP 페이지 (페이지네이션 필요 — 166k 트랙)
- **E.5**: 오디오 플레이어 (Web Audio API + 큐 상태)
- **E.6**: write actions ("내 취향이에요" 버튼 → UserTrack INSERT)
- **E.7**: 비주얼 EQ (E.5 player에 통합, Canvas + analyser node)
- **E.8**: 멀티 유저 auth (NextAuth or Supabase Auth)
- **E.9**: 어드민 (스케줄링 UI + 모델 버전 관리)
