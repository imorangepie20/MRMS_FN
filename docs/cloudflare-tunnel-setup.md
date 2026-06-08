# Cloudflare Tunnel 셋업 — mrms.approid.team → localhost:8080

OAuth redirect URI용으로 고정 HTTPS 서브도메인이 필요해서
Cloudflare Tunnel로 `mrms.approid.team`을 로컬 8080 포트에 연결.

## 사전 조건

- `approid.team` 도메인이 Cloudflare DNS로 관리 중이어야 함
- Cloudflare 계정 로그인 가능

## 1. cloudflared 설치

```bash
brew install cloudflared
```

## 2. Cloudflare 로그인

```bash
cloudflared tunnel login
```
→ 브라우저 열리며 인증. `approid.team` 영역 선택 후 승인.

## 3. 터널 생성

```bash
cloudflared tunnel create mrms
```
→ 출력에 tunnel ID 나옴 (예: `a1b2c3d4-...`)
→ credentials 파일은 `~/.cloudflared/<tunnel-id>.json` 에 저장됨

## 4. DNS 라우팅

```bash
cloudflared tunnel route dns mrms mrms.approid.team
```
→ Cloudflare DNS에 CNAME 자동 추가됨.

## 5. 설정 파일

`~/.cloudflared/config.yml` 작성:

```yaml
tunnel: <tunnel-id>
credentials-file: /Users/woosungjo/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: mrms.approid.team
    service: http://localhost:8080
  - service: http_status:404
```

`<tunnel-id>`는 step 3에서 받은 UUID로 교체.

## 6. 실행

수동:
```bash
cloudflared tunnel run mrms
```

또는 macOS service로 백그라운드 상시 실행:
```bash
sudo cloudflared service install
```
→ 부팅 시 자동 실행.

## 7. 확인

다른 터미널에서:
```bash
python -m http.server 8080 &
curl -I https://mrms.approid.team
```
→ HTTP/200 + 디렉토리 리스팅 보이면 성공.

## 8. OAuth Dev Portal 등록

- Tidal: https://developer.tidal.com → My Apps → Redirect URI 에
  `https://mrms.approid.team/callback/tidal` 추가
- Spotify: https://developer.spotify.com/dashboard → 앱 → Redirect URIs 에
  `https://mrms.approid.team/callback/spotify` 추가

## 트러블슈팅

**"failed to dial https://mrms.approid.team"**
→ 8080 포트에 서비스가 안 떠 있음. OAuth 콜백 서버 먼저 시작.

**"Tunnel is disconnected"**
→ `cloudflared tunnel list` 로 상태 확인. `cloudflared tunnel cleanup mrms` 후 재실행.

**OAuth 콜백 후 "Connection refused"**
→ 로컬 콜백 서버(우리 OAuth 모듈)가 안 떠 있음.
   OAuth flow 시작 직전에 콜백 서버 띄우는 게 우리 코드 패턴.
