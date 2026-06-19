"""GET /api/playback/tidal/video/{id} — Tidal 비디오 playbackinfo → m3u8.

respx로 Tidal API mock (외부호출 금지). 게스트 경로(x-tidal-token)는
`playbackinfo` 엔드포인트를 호출하고 manifest(base64) → urls[0]를 반환한다.
"""
import base64
import json

import httpx
import respx
from fastapi.testclient import TestClient

from mrms.api.main import app
from mrms.db.settings import get_setting, set_setting


def _manifest_b64() -> str:
    inner = {
        "mimeType": "application/vnd.apple.mpegurl",
        "urls": ["https://cdn.tidal.com/v.m3u8"],
    }
    return base64.b64encode(json.dumps(inner).encode()).decode()


@respx.mock
def test_video_playback_guest_preview(db_conn):
    """세션 없음 = 게스트 → x-tidal-token으로 playbackinfo, PREVIEW로 내려옴."""
    # set_setting은 내부 commit → dev DB의 실제 tidal_x_token을 덮어쓰므로
    # 원본을 저장해 두고 finally에서 복원 (mrms-test-db-not-isolated).
    original = get_setting(db_conn, "tidal_x_token")
    set_setting(db_conn, "tidal_x_token", "txTEST")
    try:
        guest = respx.get("https://api.tidal.com/v1/videos/123/playbackinfo").mock(
            return_value=httpx.Response(
                200, json={"assetPresentation": "PREVIEW", "manifest": _manifest_b64()}
            )
        )
        client = TestClient(app)  # 세션 쿠키 없음 = 게스트
        r = client.get("/api/playback/tidal/video/123")
        assert r.status_code == 200
        body = r.json()
        assert body["url"] == "https://cdn.tidal.com/v.m3u8"
        assert body["preview"] is True
        # 게스트는 x-tidal-token 헤더로 playbackinfo(postpaywall 아님)를 친다.
        assert guest.calls.last.request.headers.get("x-tidal-token") == "txTEST"
    finally:
        set_setting(db_conn, "tidal_x_token", original)


@respx.mock
def test_video_playback_member_full(db_conn, cleanup):
    """연결 회원(OAuth Bearer) → playbackinfopostpaywall, FULL(preview=False)."""
    from datetime import datetime, timedelta, timezone

    from mrms.db.user_track import get_or_create_user, upsert_oauth

    # 세션 + tidal OAuth 시드 (둘 다 commit → 별도 풀 connection이 보게). cleanup으로 제거.
    email = "video_member@test.com"
    user_id = get_or_create_user(db_conn, email)
    session_id = "vid-sess-" + "0" * 16
    expires = datetime.now(timezone.utc) + timedelta(days=1)
    cleanup('DELETE FROM "AuthSession" WHERE id = %s', (session_id,))
    cleanup('DELETE FROM "UserOAuth" WHERE "userId" = %s AND platform = %s', (user_id, "tidal"))
    with db_conn.cursor() as cur:
        cur.execute(
            'INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
            (session_id, user_id, expires),
        )
    upsert_oauth(
        db_conn, user_id, "tidal",
        access_token="MEMBER_ACCESS",
        refresh_token="MEMBER_REFRESH",
        expires_at=expires,
        scopes=["collection.read"],
    )
    db_conn.commit()

    member = respx.get(
        "https://api.tidal.com/v1/videos/123/playbackinfopostpaywall"
    ).mock(
        return_value=httpx.Response(
            200, json={"assetPresentation": "FULL", "manifest": _manifest_b64()}
        )
    )
    client = TestClient(app)
    client.cookies.set("mrms_session", session_id)
    r = client.get("/api/playback/tidal/video/123")
    assert r.status_code == 200
    body = r.json()
    assert body["url"] == "https://cdn.tidal.com/v.m3u8"
    assert body["preview"] is False
    # 회원은 Bearer로 postpaywall을 친다.
    assert member.calls.last.request.headers.get("authorization") == "Bearer MEMBER_ACCESS"


@respx.mock
def test_video_playback_member_fallback_to_preview(db_conn, cleanup):
    """회원 postpaywall 실패(비구독 401 등) → 게스트 x-tidal-token playbackinfo PREVIEW 폴백."""
    from datetime import datetime, timedelta, timezone

    from mrms.db.user_track import get_or_create_user, upsert_oauth

    original = get_setting(db_conn, "tidal_x_token")
    set_setting(db_conn, "tidal_x_token", "txTEST")
    try:
        email = "video_member_fb@test.com"
        user_id = get_or_create_user(db_conn, email)
        session_id = "vid-fb-sess-" + "0" * 16
        expires = datetime.now(timezone.utc) + timedelta(days=1)
        cleanup('DELETE FROM "AuthSession" WHERE id = %s', (session_id,))
        cleanup('DELETE FROM "UserOAuth" WHERE "userId" = %s AND platform = %s', (user_id, "tidal"))
        with db_conn.cursor() as cur:
            cur.execute(
                'INSERT INTO "AuthSession" (id, "userId", "expiresAt") VALUES (%s, %s, %s)',
                (session_id, user_id, expires),
            )
        upsert_oauth(
            db_conn, user_id, "tidal",
            access_token="MEMBER_ACCESS",
            refresh_token="MEMBER_REFRESH",
            expires_at=expires,
            scopes=["collection.read"],
        )
        db_conn.commit()

        # postpaywall(회원)은 401 실패, playbackinfo(게스트)는 PREVIEW 성공.
        member = respx.get(
            "https://api.tidal.com/v1/videos/123/playbackinfopostpaywall"
        ).mock(return_value=httpx.Response(401, json={"status": 401}))
        guest = respx.get("https://api.tidal.com/v1/videos/123/playbackinfo").mock(
            return_value=httpx.Response(
                200, json={"assetPresentation": "PREVIEW", "manifest": _manifest_b64()}
            )
        )
        client = TestClient(app)
        client.cookies.set("mrms_session", session_id)
        r = client.get("/api/playback/tidal/video/123")
        assert r.status_code == 200
        body = r.json()
        assert body["url"] == "https://cdn.tidal.com/v.m3u8"
        assert body["preview"] is True  # 폴백 = 프리뷰
        # postpaywall(Bearer) 시도 후 게스트 playbackinfo(x-tidal-token)로 폴백.
        assert member.called
        assert guest.calls.last.request.headers.get("x-tidal-token") == "txTEST"
    finally:
        set_setting(db_conn, "tidal_x_token", original)
