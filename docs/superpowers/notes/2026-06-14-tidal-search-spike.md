# Tidal 검색 spike (2026-06-14)

**상태:** 라이브 확인 **보류**(실 Tidal user access token 필요 — 사용자가 로컬에서 확인). 코드는 **degrade-capable**로 구현되어 spike 결과와 무관하게 동작.

## 확인할 것

```bash
TOKEN="<tidal user access token>"   # DB UserOAuth(tidal) 또는 앱 로그인 후
for T in albums playlists; do
  echo "=== /v1/search/$T ==="
  curl -s -o /dev/null -w "%{http_code}\n" \
    -H "Authorization: Bearer $TOKEN" \
    "https://api.tidal.com/v1/search/$T?query=newjeans&limit=3&countryCode=KR"
done
```

- `200` → Tidal 앨범/플레이리스트가 검색 결과에 채워짐(스펙대로).
- `404`/기타 → `src/mrms/search/tidal.py`의 `_get_items`가 `[]`를 반환 → **앨범/플레이리스트는 Spotify only로 degrade**(트랙은 Tidal 정상). 사용자 경험상 문제 없음.

## 결론 (확인 후 갱신)

- /v1/search/albums: `<HTTP code>`
- /v1/search/playlists: `<HTTP code>`
- 앨범 응답 track_count 키: `<numberOfTracks?>`
- 결정: per-type 사용 / degrade

> 참조: [spec §7](../specs/2026-06-14-search-emp-expansion-design.md), `src/mrms/search/tidal.py`(degrade-capable).
