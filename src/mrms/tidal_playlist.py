"""연결 회원의 Tidal 계정에 플레이리스트 생성 + 트랙 추가 (레거시 v1 API, w_usr 스코프).

공유 플레이리스트를 듣는 사람이 자기 Tidal로 '가져가서' 재생하기 위한 용도.
v2(openapi) 쓰기는 playlists.write 스코프가 필요한데 앱 토큰은 r_usr/w_usr(레거시)뿐이라
api.tidal.com/v1 레거시 엔드포인트를 쓴다. 추가는 If-None-Match(ETag) 흐름이 필요.
(오픈소스 tidalapi 라이브러리의 create/add 흐름과 동일.)
"""
from __future__ import annotations

import json

import httpx

TIDAL_API = "https://api.tidal.com/v1"
TIDAL_OPENAPI = "https://openapi.tidal.com/v2"
ADD_BATCH = 50  # items 추가 배치 크기 (배치마다 ETag 재취득)


async def create_tidal_playlist(
    access_token: str,
    title: str,
    description: str | None,
    track_ids: list[str],
    *,
    timeout: float = 20.0,
) -> str:
    """플레이리스트 생성 + 트랙 추가 → 생성된 playlist uuid 반환.

    track_ids = Tidal track id 문자열 리스트. 못 찾는 트랙은 SKIP(전체 실패 방지).
    Tidal API 오류는 httpx.HTTPStatusError로 전파(호출부에서 502 매핑)."""
    auth = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=timeout) as http:
        # 1) userId + countryCode (OAuth Bearer로 sessions 조회)
        s = await http.get(f"{TIDAL_API}/sessions", headers=auth)
        s.raise_for_status()
        sess = s.json()
        user_id = sess["userId"]
        country = sess.get("countryCode") or "KR"

        # 2) 빈 플레이리스트 생성
        c = await http.post(
            f"{TIDAL_API}/users/{user_id}/playlists",
            headers=auth,
            params={"countryCode": country},
            data={"title": title[:100], "description": (description or "")[:500]},
        )
        c.raise_for_status()
        uuid = c.json()["uuid"]

        # 3) 트랙 추가 — 배치마다 ETag 재취득(추가 후 ETag가 바뀜)
        for i in range(0, len(track_ids), ADD_BATCH):
            batch = track_ids[i : i + ADD_BATCH]
            g = await http.get(
                f"{TIDAL_API}/playlists/{uuid}",
                headers=auth,
                params={"countryCode": country},
            )
            etag = g.headers.get("etag") or g.headers.get("ETag")
            headers = {**auth, "If-None-Match": etag} if etag else auth
            a = await http.post(
                f"{TIDAL_API}/playlists/{uuid}/items",
                headers=headers,
                params={
                    "countryCode": country,
                    "onArtifactNotFound": "SKIP",
                    "onDupes": "SKIP",
                },
                data={"trackIds": ",".join(batch)},
            )
            a.raise_for_status()

    return uuid


async def make_tidal_playlist_public(
    access_token: str, uuid: str, *, timeout: float = 10.0
) -> None:
    """플레이리스트를 공개(accessType=PUBLIC)로 전환. Tidal 플레이리스트는 기본 private라
    공개 안 하면 공유 링크가 404. 이미 만들어진 것도 복구할 수 있게 별도 헬퍼로 분리(멱등).

    실측 캡처 기준 — v2 openapi PATCH(JSON:API):
      PATCH openapi.tidal.com/v2/playlists/{uuid}?countryCode=XX
      Content-Type: application/vnd.api+json
      {"data":{"type":"playlists","id":uuid,"attributes":{"accessType":"PUBLIC"}}}
    """
    auth = {"Authorization": f"Bearer {access_token}"}
    async with httpx.AsyncClient(timeout=timeout) as http:
        s = await http.get(f"{TIDAL_API}/sessions", headers=auth)
        s.raise_for_status()
        country = s.json().get("countryCode") or "KR"
        r = await http.patch(
            f"{TIDAL_OPENAPI}/playlists/{uuid}",
            params={"countryCode": country},
            headers={
                **auth,
                "Content-Type": "application/vnd.api+json",
                "Accept": "application/vnd.api+json",
            },
            content=json.dumps({
                "data": {
                    "type": "playlists",
                    "id": uuid,
                    "attributes": {"accessType": "PUBLIC"},
                }
            }),
        )
        r.raise_for_status()
