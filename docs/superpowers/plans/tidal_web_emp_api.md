# Tidal Web API 활용해서 EMP로직 구현 계획

> **구현 완료** — 이 raw 캡처(브라우저 DevTools fetch) 기반 구현은 `src/mrms/emp/tidal.py`.
> 토큰/소스는 코드에 하드코딩하지 않고 Setting `'tidal_x_token'` / `'tidal_emp_sources'`
> (라인 형식: `home/<SECTION>`, `playlist/<uuid>`, `album/<id>`, `mix/<id>`)로 /admin/emp에서 설정.
> 아래 토큰 값은 `<X_TIDAL_TOKEN>`으로 치환됨.

## The HIT
    - fetch("https://tidal.com/v2/home/pages/THE_HITS/view-all?countryCode=US&locale=en_US&deviceType=BROWSER&platform=WEB&limit=50&offset=0", {
  "headers": {
    "accept": "application/json",
    "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7",
    "priority": "u=1, i",
    "sec-ch-device-memory": "32",
    "sec-ch-ua": "\"Google Chrome\";v=\"149\", \"Chromium\";v=\"149\", \"Not)A;Brand\";v=\"24\"",
    "sec-ch-ua-arch": "\"arm\"",
    "sec-ch-ua-full-version-list": "\"Google Chrome\";v=\"149.0.7827.102\", \"Chromium\";v=\"149.0.7827.102\", \"Not)A;Brand\";v=\"24.0.0.0\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-model": "\"\"",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "x-tidal-client-version": "2026.6.9",
    "x-tidal-token": "<X_TIDAL_TOKEN>"
  },
  "referrer": "https://tidal.com/home/pages/THE_HITS/view-all",
  "body": null,
  "method": "GET",
  "mode": "cors",
  "credentials": "include"
});

-- fetch("https://tidal.com/v1/playlists/edf3b7d2-cb42-41d7-93c0-afa2a395521b/items?offset=0&limit=50&countryCode=US&locale=en_US&deviceType=BROWSER", {
  "headers": {
    "accept": "application/json",
    "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7",
    "priority": "u=1, i",
    "sec-ch-device-memory": "32",
    "sec-ch-ua": "\"Google Chrome\";v=\"149\", \"Chromium\";v=\"149\", \"Not)A;Brand\";v=\"24\"",
    "sec-ch-ua-arch": "\"arm\"",
    "sec-ch-ua-full-version-list": "\"Google Chrome\";v=\"149.0.7827.102\", \"Chromium\";v=\"149.0.7827.102\", \"Not)A;Brand\";v=\"24.0.0.0\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-model": "\"\"",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "x-tidal-token": "<X_TIDAL_TOKEN>"
  },
  "referrer": "https://tidal.com/home/pages/THE_HITS/view-all",
  "body": null,
  "method": "GET",
  "mode": "cors",
  "credentials": "include"
});

........

## Latest spotlighted tracks + album page
(구 헤딩 "Popular albums"는 오기 — 아래 view-all 캡처는 LATEST_SPOTLIGHTED_TRACKS 섹션이고,
POPULAR_ALBUMS는 두 번째 album fetch의 referrer에만 등장. tidal.py DEFAULT_SOURCES에 POPULAR_ALBUMS 없음.)

--fetch("https://tidal.com/v2/home/pages/LATEST_SPOTLIGHTED_TRACKS/view-all?countryCode=US&locale=en_US&deviceType=BROWSER&platform=WEB&limit=50&offset=0", {
  "headers": {
    "accept": "application/json",
    "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7",
    "priority": "u=1, i",
    "sec-ch-device-memory": "32",
    "sec-ch-ua": "\"Google Chrome\";v=\"149\", \"Chromium\";v=\"149\", \"Not)A;Brand\";v=\"24\"",
    "sec-ch-ua-arch": "\"arm\"",
    "sec-ch-ua-full-version-list": "\"Google Chrome\";v=\"149.0.7827.102\", \"Chromium\";v=\"149.0.7827.102\", \"Not)A;Brand\";v=\"24.0.0.0\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-model": "\"\"",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "x-tidal-client-version": "2026.6.9",
    "x-tidal-token": "<X_TIDAL_TOKEN>"
  },
  "referrer": "https://tidal.com/home/pages/LATEST_SPOTLIGHTED_TRACKS/view-all",
  "body": null,
  "method": "GET",
  "mode": "cors",
  "credentials": "include"
});
-- fetch("https://tidal.com/v1/pages/album?albumId=500612897&countryCode=US&locale=en_US&deviceType=BROWSER", {
  "headers": {
    "accept": "application/json",
    "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7",
    "priority": "u=1, i",
    "sec-ch-device-memory": "32",
    "sec-ch-ua": "\"Google Chrome\";v=\"149\", \"Chromium\";v=\"149\", \"Not)A;Brand\";v=\"24\"",
    "sec-ch-ua-arch": "\"arm\"",
    "sec-ch-ua-full-version-list": "\"Google Chrome\";v=\"149.0.7827.102\", \"Chromium\";v=\"149.0.7827.102\", \"Not)A;Brand\";v=\"24.0.0.0\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-model": "\"\"",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "x-tidal-token": "<X_TIDAL_TOKEN>"
  },
  "referrer": "https://tidal.com/home/pages/POPULAR_ALBUMS/view-all",
  "body": null,
  "method": "GET",
  "mode": "cors",
  "credentials": "include"
});

## Popuar mixex
- fetch("https://tidal.com/v2/home/pages/POPULAR_MIXES/view-all?countryCode=US&locale=en_US&deviceType=BROWSER&platform=WEB&limit=50&offset=0", {
  "headers": {
    "accept": "application/json",
    "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7",
    "priority": "u=1, i",
    "sec-ch-device-memory": "32",
    "sec-ch-ua": "\"Google Chrome\";v=\"149\", \"Chromium\";v=\"149\", \"Not)A;Brand\";v=\"24\"",
    "sec-ch-ua-arch": "\"arm\"",
    "sec-ch-ua-full-version-list": "\"Google Chrome\";v=\"149.0.7827.102\", \"Chromium\";v=\"149.0.7827.102\", \"Not)A;Brand\";v=\"24.0.0.0\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-model": "\"\"",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "x-tidal-client-version": "2026.6.9",
    "x-tidal-token": "<X_TIDAL_TOKEN>"
  },
  "referrer": "https://tidal.com/home/pages/POPULAR_MIXES/view-all",
  "body": null,
  "method": "GET",
  "mode": "cors",
  "credentials": "include"
});

-- fetch("https://tidal.com/v1/pages/mix?mixId=00042cc52d0397491c4b9a4a87286a&countryCode=US&locale=en_US&deviceType=BROWSER", {
  "headers": {
    "accept": "application/json",
    "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7",
    "priority": "u=1, i",
    "sec-ch-device-memory": "32",
    "sec-ch-ua": "\"Google Chrome\";v=\"149\", \"Chromium\";v=\"149\", \"Not)A;Brand\";v=\"24\"",
    "sec-ch-ua-arch": "\"arm\"",
    "sec-ch-ua-full-version-list": "\"Google Chrome\";v=\"149.0.7827.102\", \"Chromium\";v=\"149.0.7827.102\", \"Not)A;Brand\";v=\"24.0.0.0\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-model": "\"\"",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "x-tidal-token": "<X_TIDAL_TOKEN>"
  },
  "referrer": "https://tidal.com/home/pages/POPULAR_MIXES/view-all",
  "body": null,
  "method": "GET",
  "mode": "cors",
  "credentials": "include"
});

## Popular playlists on Tidal
- fetch("https://tidal.com/v2/home/pages/POPULAR_PLAYLISTS/view-all?countryCode=US&locale=en_US&deviceType=BROWSER&platform=WEB&limit=50&offset=0", {
  "headers": {
    "accept": "application/json",
    "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7",
    "priority": "u=1, i",
    "sec-ch-device-memory": "32",
    "sec-ch-ua": "\"Google Chrome\";v=\"149\", \"Chromium\";v=\"149\", \"Not)A;Brand\";v=\"24\"",
    "sec-ch-ua-arch": "\"arm\"",
    "sec-ch-ua-full-version-list": "\"Google Chrome\";v=\"149.0.7827.102\", \"Chromium\";v=\"149.0.7827.102\", \"Not)A;Brand\";v=\"24.0.0.0\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-model": "\"\"",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "x-tidal-client-version": "2026.6.9",
    "x-tidal-token": "<X_TIDAL_TOKEN>"
  },
  "referrer": "https://tidal.com/home/pages/POPULAR_PLAYLISTS/view-all",
  "body": null,
  "method": "GET",
  "mode": "cors",
  "credentials": "include"
});

-- fetch("https://tidal.com/v1/playlists/34c543c9-bb74-4b79-91a8-feb6d815f43c/items?offset=0&limit=50&countryCode=US&locale=en_US&deviceType=BROWSER", {
  "headers": {
    "accept": "application/json",
    "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7",
    "priority": "u=1, i",
    "sec-ch-device-memory": "32",
    "sec-ch-ua": "\"Google Chrome\";v=\"149\", \"Chromium\";v=\"149\", \"Not)A;Brand\";v=\"24\"",
    "sec-ch-ua-arch": "\"arm\"",
    "sec-ch-ua-full-version-list": "\"Google Chrome\";v=\"149.0.7827.102\", \"Chromium\";v=\"149.0.7827.102\", \"Not)A;Brand\";v=\"24.0.0.0\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-model": "\"\"",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "x-tidal-token": "<X_TIDAL_TOKEN>"
  },
  "referrer": "https://tidal.com/home/pages/POPULAR_PLAYLISTS/view-all",
  "body": null,
  "method": "GET",
  "mode": "cors",
  "credentials": "include"
});