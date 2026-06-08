# Sub-project F: 회원가입 → 첫 추천 → 감상 (Design)

**날짜**: 2026-06-08
**상태**: 디자인 (사용자 승인 완료)
**범위**: Single hardcoded user 상태에서 **실제 다중 사용자 + UI 기반 onboarding flow**로 전환. Tidal OAuth로 회원가입 → 자동으로 첫 추천 생성 → /mrt에서 풀 곡 감상까지 한 사이클.

## 1. Goal + 사용자 의도

E.5까지의 모든 기능을 진짜 사용자가 "처음 들어와서 음악 듣는 경험"으로 묶음. 현재는 `DEFAULT_USER_EMAIL` env 하나로 single user 가정. 이걸 풀어서:

- 사용자가 /login 방문
- "Tidal로 시작하기" 클릭
- Tidal 동의 → 자동으로 백그라운드에서 첫 임베딩 + 페르소나 + MRT 생성
- /mrt 진입 → 풀 곡 재생 가능

A1, B-full, E.0+1+2, E.5의 모든 기능이 진짜 사용자 입장에서 자연스럽게 연결되게 만듦.

## 2. Success Criteria

- [ ] 새 사용자가 `/login`에서 시작 → 5분 안에 /mrt에서 음악 재생 시작
- [ ] AuthSession cookie 기반 다중 사용자 동시 사용 가능 (테스트 DB로 검증)
- [ ] 모든 백엔드 endpoint가 cookie 기반 user_id 사용 (DEFAULT_USER_EMAIL env 의존성 제거)
- [ ] Tidal 즐겨찾기 0개 또는 매칭 트랙 부족 시 명확한 에러 메시지
- [ ] 세션 만료/위변조 시 자동 /login redirect

## 3. Architecture

```
[1. /login]
   ↓ "Tidal로 시작하기" 클릭
[2. TidalConnectModal]
   POST /api/auth/tidal/device-code/init
   → Tidal device_authorization 요청
   → user_code "ABC123" + verification_uri_complete 반환
   → Modal에 코드 표시 + 새 탭 자동 열기
   → 5초마다 POST .../poll
   ↓ Tidal 동의 완료
[3. /onboarding]
   poll 성공 → User+UserOAuth+AuthSession 생성 + Cookie set
   → 백그라운드 job: Tidal favorites → embedding → cluster → MRT
   → 프론트가 /api/onboarding/status 폴링 (1초)
   → 단계별 진행 메시지 + ProgressBar
   ↓ done
[4. /mrt]
   기존 페이지 (E.0+1+2 + E.5). 첫 진입 시 환영 메시지
```

## 4. Data Model + API

### 4.1 Prisma — AuthSession 신규

```prisma
model AuthSession {
  id        String   @id @default(cuid())  // 이 값이 cookie에 저장
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  expiresAt DateTime
  createdAt DateTime @default(now())
  userAgent String?

  @@index([userId])
}
```

User 모델에 relation 추가:
```prisma
model User {
  // 기존 필드 유지
  authSessions AuthSession[]
}
```

### 4.2 신규 endpoints

| Endpoint | 역할 |
|---|---|
| `POST /api/auth/tidal/device-code/init` | Tidal에 device_authorization 요청. 응답: `{user_code, verification_uri_complete, device_code, expires_in, interval}`. **device_code는 stateless — 클라이언트가 보관 후 poll 시 함께 전송**. 서버 in-memory 저장 X. |
| `POST /api/auth/tidal/device-code/poll` | body: `{device_code}`. Tidal /token 호출. 성공 시: JWT에서 Tidal user_id 추출 → User upsert → UserOAuth upsert → AuthSession 생성 → Set-Cookie `mrms_session=...; HttpOnly; SameSite=Lax; Max-Age=2592000` → `{status: 'success', has_mrt: bool}` 반환 (has_mrt로 /mrt vs /onboarding 분기). 401 + pending: `{status: 'pending'}`. expired: `{status: 'expired'}`. |
| `GET /api/auth/me` | Cookie 읽어서 현재 user info 반환 (UserInfo 스키마). cookie 없거나 expired AuthSession이면 401. |
| `POST /api/auth/logout` | AuthSession 삭제 + Set-Cookie (만료된 값) clear. |
| `POST /api/onboarding/start` | 백그라운드 job 시작 (FastAPI BackgroundTasks). 이미 진행 중이거나 done이면 idempotent. |
| `GET /api/onboarding/status` | 현재 user의 onboarding 상태 반환: `{step: 'fetching_favorites'\|'matching_tracks'\|'computing_embedding'\|'clustering'\|'generating_mrt'\|'done'\|'error', progress: 0~100, message?: string, error?: string}` |

### 4.3 기존 endpoints — Session 기반으로 전환

다음 4개 endpoint (이미 존재):
- `GET /api/user`
- `GET /api/mrt/latest`
- `GET /api/auth/tidal/token`
- `POST /api/auth/tidal/refresh`
- `GET /api/playback/tidal/stream/{track_id}`

모두 `get_default_user_email()` → `get_current_user_id(request)` 교체.

### 4.4 Onboarding pipeline

`src/mrms/onboarding/pipeline.py`:

```python
async def run_onboarding(user_id: str, status: OnboardingStatus):
    status.set("fetching_favorites", 0)
    favorites = await fetch_tidal_favorites(user_id)
    
    status.set("matching_tracks", 25)
    matched = match_tidal_to_internal(favorites)
    save_user_tracks(user_id, matched)
    
    status.set("computing_embedding", 50)
    embeddings = compute_user_embeddings(user_id)
    
    status.set("clustering", 75)
    personas = cluster_kmeans(embeddings, k=3)
    save_user_personas(user_id, personas)
    
    status.set("generating_mrt", 90)
    mrt = generate_mrt_playlists(user_id, personas)
    save_playlist_history(user_id, mrt)
    
    status.set("done", 100)
```

기존 scripts/05~07의 로직을 함수화. Status는 in-memory dict (key: user_id, value: OnboardingStatus 객체).

## 5. Frontend

### 5.1 페이지

```
web/src/app/
├── (auth)/
│   ├── login/page.tsx          # 기존 — Tidal 버튼 연결 + redirect 처리
│   └── onboarding/page.tsx     # 신규
└── (dashboard)/
    └── mrt/page.tsx            # 기존 — Server Component에서 session 체크
```

### 5.2 신규 컴포넌트

**`TidalConnectModal.tsx`**:
- mount 시 `/api/auth/tidal/device-code/init` 호출
- `user_code` + `verification_uri_complete` 받으면 Modal 표시
- `window.open(verification_uri_complete, '_blank')` 자동 새 탭
- 5초마다 `/poll` 호출
- 성공: modal 닫고 `router.push('/onboarding' if !has_mrt else '/mrt')`
- 만료/에러: alert + 재시도 버튼

```tsx
<Dialog>
  <DialogContent>
    <DialogTitle>Tidal 계정 연결</DialogTitle>
    <div className="text-4xl font-mono tracking-wider text-center">{userCode}</div>
    <a href={verificationUriComplete} target="_blank" className="...">
      Tidal에서 동의하기 →
    </a>
    <p className="text-sm text-muted-foreground">
      새 탭에서 동의 완료되면 자동으로 진행됩니다
    </p>
    <Countdown remainingSec={remainingSec} />
  </DialogContent>
</Dialog>
```

**`/onboarding/page.tsx`** (Client Component):
- mount 시 `/api/onboarding/start` 호출 (idempotent)
- 1초마다 `/api/onboarding/status` 폴링
- 단계별 메시지 + ProgressBar (shadcn/ui Progress)
- 매핑:
  - `fetching_favorites`: "Tidal 즐겨찾기 가져오는 중..."
  - `matching_tracks`: "트랙 매칭 중..."
  - `computing_embedding`: "음악 취향 분석 중..."
  - `clustering`: "페르소나 추출 중..."
  - `generating_mrt`: "추천 생성 중..."
  - `done`: `router.push('/mrt')`
  - `error`: 에러 메시지 + 재시도 버튼

### 5.3 Auth state

**`useUser()` hook**:
```typescript
// web/src/lib/hooks/use-user.ts
export function useUser() {
  const { data, error, isLoading } = useSWR<UserInfo>('/api/auth/me');
  return { user: data, isLoading, error };
}
```

**Server-side**:
```typescript
// web/src/lib/server/auth.ts
export async function getServerSideUser() {
  const cookieStore = cookies();
  const session = cookieStore.get('mrms_session');
  if (!session) redirect('/login');
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { Cookie: `mrms_session=${session.value}` },
    cache: 'no-store',
  });
  if (res.status === 401) redirect('/login');
  return res.json() as Promise<UserInfo>;
}
```

`/mrt` Server Component 시작 시 `await getServerSideUser()` 호출.

### 5.4 Middleware (선택)

`web/middleware.ts` — `(dashboard)` 경로에서 cookie 빠른 체크:
```typescript
export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/mrt')) {
    if (!request.cookies.get('mrms_session')) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }
}
```

## 6. Error handling

| 상황 | 처리 |
|---|---|
| Device Code 만료 (5분 초과) | Modal에 "재시도" 버튼 — 다시 init |
| `access_denied` (사용자 거부) | "Tidal 동의 거부됨" 메시지 + login 복귀 |
| Polling 네트워크 끊김 | 자동 재시도 3회 → 실패 시 에러 표시 |
| Tidal 즐겨찾기 0개 | "Tidal에 즐겨찾기 트랙이 필요합니다" + 안내 |
| 매칭 트랙 너무 적음 (<10) | "음악 데이터 부족 — 최소 10곡 좋아요 필요" |
| 세션 만료 (30일 후) | 401 → /login redirect |
| Cookie 위변조 (DB에 없는 session_id) | 401 + clear cookie + /login |
| 백그라운드 job 실패 | status에 "error" + 에러 메시지 → "재시도" UI |

## 7. Testing

### 7.1 백엔드 (pytest)

- `test_auth_me.py`: 유효 cookie / 무 cookie / 만료 cookie / 위변조 cookie
- `test_device_code.py`: init 응답 형식 / poll pending / poll success → User+UserOAuth+AuthSession 생성 + cookie set
- `test_logout.py`: AuthSession deleted + cookie cleared
- `test_endpoints_with_session.py`: 기존 `/api/user`, `/api/mrt/latest` 등이 session 기반으로 동작
- `test_onboarding_pipeline.py`: 함수 단위 — fake Tidal 응답 mock → DB row 생성 검증

### 7.2 프론트엔드 (Playwright)

- `signup-flow.spec.ts`:
  1. /login 방문
  2. Tidal 버튼 클릭
  3. Modal에 user_code 보임 확인
  4. (Tidal poll mock 응답을 fixture로 성공 강제)
  5. /onboarding 자동 이동 확인
  6. status 폴링 → done → /mrt 확인

### 7.3 수동 검증

본인 계정으로 한 사이클 실제 진행. AuthSession 생성, MRT 생성, 풀 곡 재생까지 모두 확인.

## 8. Out of Scope

- 회원 탈퇴 / 데이터 삭제
- Profile 편집 (displayName, country 등)
- 비밀번호 / 이메일 백업
- 여러 Tidal 계정 동시 연결
- Tidal 외 플랫폼 (Spotify 등)
- 추천 재생성 (주기적 재계산은 별도 cron sub-project)
- Email 알림 / 진행 상황 알림

## 9. Migration 경로

기존 DB의 8명 User row (jacinto68 + VWorld 부산물 등):
- jacinto68 사용자의 UserOAuth(tidal)는 유지
- 신규 AuthSession 테이블은 비어있음 → 본인이 다시 로그인 한 번 거쳐야 cookie 받음
- DEFAULT_USER_EMAIL env는 제거 가능 (또는 dev seed 스크립트 전용으로 보존)

## 10. File Changes

| File | 변경 |
|---|---|
| `prisma/schema.prisma` | AuthSession 모델 + User relation 추가 |
| `prisma/migrations/` | 신규 migration |
| `src/mrms/api/deps.py` | `get_current_user_id(request, conn)` 추가 |
| `src/mrms/api/auth_session.py` (신규) | Device Code init/poll + me + logout endpoints |
| `src/mrms/api/onboarding.py` (신규) | start + status endpoints |
| `src/mrms/api/main.py` | router include + 기존 endpoint의 user dependency 교체 |
| `src/mrms/api/auth_tidal.py` | get_default_user_email → get_current_user_id |
| `src/mrms/onboarding/pipeline.py` (신규) | run_onboarding 함수 |
| `src/mrms/onboarding/status.py` (신규) | OnboardingStatus in-memory store |
| `web/src/app/(auth)/login/page.tsx` | Tidal 버튼 + Modal 호출 |
| `web/src/app/(auth)/onboarding/page.tsx` (신규) | 진행 화면 |
| `web/src/components/auth/TidalConnectModal.tsx` (신규) | Device Code modal |
| `web/src/lib/hooks/use-user.ts` (신규) | useUser SWR hook |
| `web/src/lib/server/auth.ts` (신규) | getServerSideUser helper |
| `web/middleware.ts` (신규) | dashboard 경로 cookie 체크 |
| `web/src/app/(dashboard)/mrt/page.tsx` | getServerSideUser 호출 추가 |
| tests/* | 신규 + 기존 회귀 |

## 11. Follow-up

이 sub-project 완료 후 자연스럽게 이어지는 작업:
- Profile 페이지 (G?)
- 회원 탈퇴 / 데이터 삭제 (compliance)
- 추천 재생성 cron (배치)
- Spotify 등 추가 플랫폼 연결
- 본인 음원 업로드 + 임베딩 (V3?)
