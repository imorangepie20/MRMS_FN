# Naver VIBE Web API — EMP 소스 (실측 검증 2026-06-11)

> **상태**: 토큰 0 으로 전 경로 동작 확인. 본인 취향(vocal jazz + 한국 가요) 직격 —
> GENRE 스테이션에 재즈 보컬/피아노, 60·70/80·90 가요, 국내 인디 등 정밀 분류.
>
> **Base**: `https://apis.naver.com/vibeWeb/musicapiweb`
> **헤더**: Accept: application/json, Referer: https://vibe.naver.com/, User-Agent(Chrome). 인증 불필요.
>
> ## 엔드포인트 (3종)
> 1. **테마 플리 모음**: `GET /vibe/v1/today/timethemepl`
>    → response.result.playlists[] : { plId, title, image.imageUrl }  (실측: 12개, 시간대별 변동)
> 2. **DJ 스테이션 목록**: `GET /vibe/v1/dj/station`
>    → response.result.stationContentList[] : { contentType('MOOD'|'GENRE'), djStationList[] }
>       각 station: { stationNo, stationName, imageUrl, stationType }  (실측: MOOD 14 + GENRE 28)
> 3. **플레이리스트 트랙**: `GET /vibe/v3/playlist/{plId}?includeOthersMix=false`
>    → response.result.playlist.tracks[]  (실측: 플리당 ~75곡)
> 4. **스테이션 트랙**: `GET /v1/station/{stationNo}/tracks?limit=50`
>    → response.result.stationList[0].tracks[]  (실측: 스테이션당 50곡)
>
> ## 트랙 파싱 (3·4 공통)
> ```
> trackId                          → platform_track_id
> trackTitle                       → title
> artists[].artistName             → 아티스트 (", " join, 첫번째 대표)
> album.albumTitle                 → album_title
> album.imageUrl                   → 커버
> album.releaseDate "YYYY.MM.DD"   → 발매일
> playTime "mm:ss"                 → durationMs (분:초 ×1000)
> ```
> ISRC 없음 (VIBE trackId만). platform-ID dedup + resolve API.
>
> ## MRMS 통합 (Melon/FLO 패턴)
> - `src/mrms/emp/vibe.py` (신규), platform='vibe'.
> - 소스 (Setting 'vibe_emp_sources'): `station/{no}` | `playlist/{plId}` | `theme`(timethemepl 자동) | `stations`(dj/station 전체 자동)
> - 기본값: ["stations", "theme"] — GENRE 28 + MOOD 14 스테이션 + 테마 플리 전부.
> - 섹션: MOOD/GENRE 그룹 또는 스테이션별. 아이템 = 스테이션/플리, 트랙 적재.

---

## (원본 DevTools 캡처)
# Naver Vive Web - API Integration Plan
## Gen-Z 플리 모음
-
fetch("https://apis.naver.com/vibeWeb/musicapiweb/vibe/v1/today/timethemepl", {
  "headers": {
    "accept": "application/json",
    "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Google Chrome\";v=\"149\", \"Chromium\";v=\"149\", \"Not)A;Brand\";v=\"24\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site"
  },
  "referrer": "https://vibe.naver.com/timethemepl",
  "body": null,
  "method": "GET",
  "mode": "cors",
  "credentials": "include"
});
    {
    "response": {
        "result": {
            "title": "Gen-Z 플리 모음 ✨",
            "playlistCount": 81,
            "playlists": [
                {
                    "plId": "mood_genz_0009",
                    "title": "간판 없는 에스프레소바 사장님이 되어",
                    "subTitle": "VIBE",
                    "desc": "깊고 진한 원두 향과 함께 커피 머신이 돌아가는 소리가 반가운 작은 공간. 굳이 요란한 간판과 유행하는 인테리어 대신, 나만의 감성으로 꽉 채운 에스프레소 바 사장님이 되어. 커피 내릴 때 듣고 싶은 카페 음악을 소개합니다. 마음에 드는 곡은 좋아요를 눌러 보관함에 담아두세요.",
                    "isUpdateTag": "Y",
                    "image": {
                        "baseImageUrl": "https://music-phinf.pstatic.net/20220916_235/1663324440006hAf18_PNG/VIBE_%C0%CF%BB%F3_%B0%A3%C6%C7%BE%F8%B4%C2%BF%A1%BD%BA%C7%C1%B7%B9%BC%D2%B9%D9%BB%E7%C0%E5%B4%D4%C0%CC%B5%C7%BE%EE.png?type=r480",
                        "imageUrl": "https://music-phinf.pstatic.net/20220916_235/1663324440006hAf18_PNG/VIBE_%C0%CF%BB%F3_%B0%A3%C6%C7%BE%F8%B4%C2%BF%A1%BD%BA%C7%C1%B7%B9%BC%D2%B9%D9%BB%E7%C0%E5%B4%D4%C0%CC%B5%C7%BE%EE.png?type=r480"
                    },
                    "isStorable": false,
                    "playlistDataType": "MANUAL",
                    "storable": false,
                    "type": "MANUAL"
                },
                {
                    "plId": "mood_genz_0076",
                    "title": "힙한 와인바 사장님이 되어",
                    "subTitle": "VIBE",
                    "desc": "어두운 골목 끝, 따스한 불빛이 흘러나오는 작은 와인바. 매장은 작지만 요리와 와인에 진심인 힙한 와인바 사장님이 되어, 음악과 술에 취하고 싶을 때 듣기 좋은 음악들. 마음에 드는 곡은 좋아요를 눌러 보관함에 담아두세요. \r\n",
                    "isUpdateTag": "N",
                    "image": {
                        "baseImageUrl": "https://music-phinf.pstatic.net/20231004_213/1696383009063Ic5TC_PNG/VIBE_Z%BC%BC%B4%EB_%C8%FC%C7%D1%BF%CD%C0%CE%B9%D9%BB%E7%C0%E5%B4%D4%C0%CC%B5%C7%BE%EE.png?type=r480",
                        "imageUrl": "https://music-phinf.pstatic.net/20231004_213/1696383009063Ic5TC_PNG/VIBE_Z%BC%BC%B4%EB_%C8%FC%C7%D1%BF%CD%C0%CE%B9%D9%BB%E7%C0%E5%B4%D4%C0%CC%B5%C7%BE%EE.png?type=r480"
                    },
                    "isStorable": false,
                    "playlistDataType": "MANUAL",
                    "storable": false,
                    "type": "MANUAL"
                },
                {
--
fetch("https://apis.naver.com/vibeWeb/musicapiweb/vibe/v3/playlist/mood_genz_0009?includeOthersMix=false", {
  "headers": {
    "accept": "application/json",
    "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Google Chrome\";v=\"149\", \"Chromium\";v=\"149\", \"Not)A;Brand\";v=\"24\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site"
  },
  "referrer": "https://vibe.naver.com/playlist/mood_genz_0009",
  "body": null,
  "method": "GET",
  "mode": "cors",
  "credentials": "include"
});
    {
    "response": {
        "result": {
            "playlist": {
                "plId": "mood_genz_0009",
                "refId": "mood_genz_0009",
                "playlistDataType": "MANUAL",
                "title": "간판 없는 에스프레소바 사장님이 되어",
                "subTitle": "VIBE",
                "subTitleAction": "",
                "date": 1781136000000,
                "updateTime": "2026-06-11T09:00:00.000+0900",
                "image": {
                    "baseImageUrl": "https://music-phinf.pstatic.net/20220916_235/1663324440006hAf18_PNG/VIBE_%C0%CF%BB%F3_%B0%A3%C6%C7%BE%F8%B4%C2%BF%A1%BD%BA%C7%C1%B7%B9%BC%D2%B9%D9%BB%E7%C0%E5%B4%D4%C0%CC%B5%C7%BE%EE.png?type=r480",
                    "imageUrl": "https://music-phinf.pstatic.net/20220916_235/1663324440006hAf18_PNG/VIBE_%C0%CF%BB%F3_%B0%A3%C6%C7%BE%F8%B4%C2%BF%A1%BD%BA%C7%C1%B7%B9%BC%D2%B9%D9%BB%E7%C0%E5%B4%D4%C0%CC%B5%C7%BE%EE.png?type=r480"
                },
                "tracks": [
                    {
                        "trackId": 58681942,
                        "trackTitle": "You Me",
                        "represent": false,
                        "discNumber": 1,
                        "trackNumber": 2,
                        "artists": [
                            {
                                "artistId": 387635,
                                "artistName": "Penny Lane"
                            }
                        ],
                        "album": {
                            "albumId": 8364827,
                            "albumTitle": "No Show",
                            "releaseDate": "2020.12.04",
                            "imageUrl": "https://musicmeta-phinf.pstatic.net/album/008/364/8364827.jpg?type=r480Fll&v=20230331085033",
                            "artists": [
                                {
                                    "artistId": 387635,
                                    "artistName": "Penny Lane"
                                }
                            ],
                            "artistTotalCount": 1
                        },
                        "hasLyric": false,
                        "hasSyncLyric": false,
                        "isStreaming": true,
                        "isDownload": true,
                        "isMobileDownload": true,
                        "isAdult": false,
                        "representDownloadPrice": 700,
                        "isPrdd": true,
                        "isAodd": true,
                        "isOversea": true,
                        "playTime": "04:07",
                        "isKaraokeEnabled": true,
                        "isDolbyAtmos": false,
                        "hasDolbyAtmos": false,
                        "likeCount": 63
                    },
                    {
                        "trackId": 58681967,
                        "trackTitle": "Windows",
                        "represent": false,
                        "discNumber": 1,
                        "trackNumber": 1,
                        "artists": [
                            {
                                "artistId": 546602,
                                "artistName": "Revel Day"
                            },
                            {
                                "artistId": 5891435,
                                "artistName": "MIA MOR"
                            }
                        ],
                        "album": {
                            "albumId": 8364843,
                            "albumTitle": "Windows",
                            "releaseDate": "2020.11.20",
                            "imageUrl": "https://musicmeta-phinf.pstatic.net/album/008/364/8364843.jpg?type=r480Fll&v=20230331085032",
                            "artists": [
                                {
                                    "artistId": 546602,
                                    "artistName": "Revel Day"
                                },
                                {
                                    "artistId": 5891435,
                                    "artistName": "MIA MOR"
                                }
                            ],
                            "artistTotalCount": 2
                        },
                        "hasLyric": false,
                        "hasSyncLyric": false,
                        "isStreaming": true,
                        "isDownload": true,
                        "isMobileDownload": true,
                        "isAdult": false,
                        "representDownloadPrice": 700,
                        "isPrdd": true,
                        "isAodd": true,
                        "isOversea": true,
                        "playTime": "03:49",
                        "isKaraokeEnabled": true,
                        "isDolbyAtmos": false,
                        "hasDolbyAtmos": false,
                        "likeCount": 26
                    },
                    {
                        "trackId": 58702169,
                        "trackTitle": "Part of the Game",
                        "represent": false,
                        "discNumber": 1,
                        "trackNumber": 1,
                        "artists": [
                            {
                                "artistId": 580709,
                                "artistName": "Velveteen"
                            }
                        ],
                        "album": {
                            "albumId": 8369059,
                            "albumTitle": "Part of the Game",
                            "releaseDate": "2019.07.12",
                            "imageUrl": "https://musicmeta-phinf.pstatic.net/album/008/369/8369059.jpg?type=r480Fll&v=20230331085007",
                            "artists": [
                                {
                                    "artistId": 580709,
                                    "artistName": "Velveteen"
                                }
                            ],
                            "artistTotalCount": 1
                        },
                        "hasLyric": true,
                        "hasSyncLyric": true,
                        "isStreaming": true,
                        "isDownload": true,
                        "isMobileDownload": true,
                        "isAdult": false,
                        "representDownloadPrice": 700,
                        "isPrdd": true,
                        "isAodd": true,
                        "isOversea": true,
                        "playTime": "03:15",
                        "isKaraokeEnabled": true,
                        "isDolbyAtmos": false,
                        "hasDolbyAtmos": false,
                        "likeCount": 88
                    },
                    {
                        "trackId": 58734727,
                        "trackTitle": "Can't Make Up My Mind",
                        "represent": false,
                        "discNumber": 1,
                        "trackNumber": 4,
                        "artists": [
                            {
                                "artistId": 5629921,
                                "artistName": "Gloria Tells"
                            }
                        ],
                        "album": {
                            "albumId": 8377522,
                            "albumTitle": "Shine On You",
                            "releaseDate": "2019.01.18",
                            "imageUrl": "https://musicmeta-phinf.pstatic.net/album/008/377/8377522.jpg?type=r480Fll&v=20230331084915",
                            "artists": [
                                {
                                    "artistId": 5629921,
                                    "artistName": "Gloria Tells"
                                }
                            ],
                            "artistTotalCount": 1
                        },
                        "hasLyric": false,
                        "hasSyncLyric": false,
                        "isStreaming": true,
                        "isDownload": true,
                        "isMobileDownload": true,
                        "isAdult": false,
                        "representDownloadPrice": 700,
                        "isPrdd": true,
                        "isAodd": true,
                        "isOversea": true,
                        "playTime": "03:06",
                        "isKaraokeEnabled": true,
                        "isDolbyAtmos": false,
                        "hasDolbyAtmos": false,
                        "likeCount": 145
                    },
                    {
## DJ 스테이션
-
fetch("https://apis.naver.com/vibeWeb/musicapiweb/vibe/v1/dj/station", {
  "headers": {
    "accept": "application/json",
    "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Google Chrome\";v=\"149\", \"Chromium\";v=\"149\", \"Not)A;Brand\";v=\"24\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site"
  },
  "referrer": "https://vibe.naver.com/dj-station",
  "body": null,
  "method": "GET",
  "mode": "cors",
  "credentials": "include"
});

느낌별 스테이션("contentType": "MOOD") / 장르별 스테이션("contentType": "GENRE")
    {
        "response": {
            "result": {
                "stationContentTotalCount": 2,
                "stationContentList": [
                    {
                        "contentType": "MOOD",
                        "djStationList": [
                            {
                                "stationNo": 10000010,
                                "stationName": "휴식할때",
                                "title": "휴식할때",
                                "imageUrl": "https://music-phinf.pstatic.net/20181204_193/1543918895074bt55B_PNG/mood_10_Relax.png?type=w720",
                                "stationType": "REST",
                                "contentType": "MOOD"
                            },
                            {
                                "stationNo": 10000003,
                                "stationName": "신났을때",
                                "title": "신났을때",
                                "imageUrl": "https://music-phinf.pstatic.net/20181204_11/1543918826895DFvFt_PNG/mood_3_Happy.png?type=w720",
                                "stationType": "EXCITED",
                                "contentType": "MOOD"
                            },
                            {
                                "stationNo": 10000006,
                                "stationName": "사랑했을때",
                                "title": "사랑했을때",
                                "imageUrl": "https://music-phinf.pstatic.net/20181204_31/1543918854261L2yhu_PNG/mood_6_Broken.png?type=w720",
                                "stationType": "FAREWELL",
                                "contentType": "MOOD"
                            },
                            {
                                "stationNo": 10000005,
                                "stationName": "사랑할때",
                                "title": "사랑할때",
                                "imageUrl": "https://music-phinf.pstatic.net/20181204_26/1543918838129f4Jv3_PNG/mood_5_Love.png?type=w720",
                                "stationType": "LOVE",
                                "contentType": "MOOD"
                            },
                            {
                                "stationNo": 10000009,
                                "stationName": "운동할때",
                                "title": "운동할때",
                                "imageUrl": "https://music-phinf.pstatic.net/20181204_251/1543918889382acDmF_PNG/mood_9_Wokrout.png?type=w720",
                                "stationType": "WORKOUT",
                                "contentType": "MOOD"
                            },
                            {
                                "stationNo": 10000008,
                                "stationName": "멍때릴때",
                                "title": "멍때릴때",
                                "imageUrl": "https://music-phinf.pstatic.net/20181204_238/1543918865951D4jqi_PNG/mood_8_Blankly.png?type=w720",
                                "stationType": "BLANKLY",
                                "contentType": "MOOD"
                            },
                            {
                                "stationNo": 10000004,
                                "stationName": "우울할때",
                                "title": "우울할때",
                                "imageUrl": "https://music-phinf.pstatic.net/20181204_2/1543918833159wpHlc_PNG/mood_4_Sad.png?type=w720",
                                "stationType": "DEPRESSED",
                                "contentType": "MOOD"
                            },
                            {
                                "stationNo": 10000002,
                                "stationName": "힙터질때",
                                "title": "힙터질때",
                                "imageUrl": "https://music-phinf.pstatic.net/20181204_1/1543917558419bLOt5_PNG/mood_2_Hip.png?type=w720",
                                "stationType": "HIP",
                                "contentType": "MOOD"
                            },
                            {
                                "stationNo": 10000007,
                                "stationName": "집중할때",
                                "title": "집중할때",
                                "imageUrl": "https://music-phinf.pstatic.net/20181204_143/1543918860459dh7Hq_PNG/mood_7_Focus.png?type=w720",
                                "stationType": "FOCUS",
                                "contentType": "MOOD"
                            },
                            {
                                "stationNo": 10000001,
                                "stationName": "지금인기",
                                "title": "지금인기",
                                "imageUrl": "https://music-phinf.pstatic.net/20181204_83/1543917552142Qd1y6_PNG/mood_1_NowHot.png?type=w720",
                                "stationType": "HOT",
                                "contentType": "MOOD"
                            },
                            {
                                "stationNo": 10000012,
                                "stationName": "외로울때",
                                "title": "외로울때",
                                "imageUrl": "https://music-phinf.pstatic.net/20181204_181/1543918921317J7KCs_PNG/mood_12_Lonely.png?type=w720",
                                "stationType": "LONELY",
                                "contentType": "MOOD"
                            },
                            {
                                "stationNo": 10000013,
                                "stationName": "덜깼을때",
                                "title": "덜깼을때",
                                "imageUrl": "https://music-phinf.pstatic.net/20181204_236/1543918927254Fiokq_PNG/mood_13_Morning.png?type=w720",
                                "stationType": "WAKEUP",
                                "contentType": "MOOD"
                            },
                            {
                                "stationNo": 10000011,
                                "stationName": "파티할때",
                                "title": "파티할때",
                                "imageUrl": "https://music-phinf.pstatic.net/20181204_203/1543918901105PmOS5_PNG/mood_11_Party.png?type=w720",
                                "stationType": "PARTY",
                                "contentType": "MOOD"
                            },
                            {
                                "stationNo": 10000014,
                                "stationName": "잠안올때",
                                "title": "잠안올때",
                                "imageUrl": "https://music-phinf.pstatic.net/20181204_80/1543918932898PPj9P_PNG/mood_14_Night.png?type=w720",
                                "stationType": "SLEEP",
                                "contentType": "MOOD"
                            }
                        ]
                    },
                    {
                        "contentType": "GENRE",
                        "djStationList": [
                            {
                                "stationNo": 20000011,
                                "stationName": "재즈 보컬",
                                "title": "재즈 보컬",
                                "imageUrl": "https://music-phinf.pstatic.net/20190717_96/1563372036114l44fO_PNG/dj_3_genre_11.png",
                                "stationType": "VOCAL_JAZZ",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000016,
                                "stationName": "90년대 Pop",
                                "title": "90년대 Pop",
                                "imageUrl": "https://music-phinf.pstatic.net/20190717_25/1563372086749r0Jfe_PNG/dj_3_genre_16.png",
                                "stationType": "NINETY_POP",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000001,
                                "stationName": "요즘 K-POP",
                                "title": "요즘 K-POP",
                                "imageUrl": "https://music-phinf.pstatic.net/20190717_280/1563371916540i7TdP_PNG/dj_3_genre_1.png",
                                "stationType": "SONG",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000009,
                                "stationName": "요즘 락",
                                "title": "요즘 락",
                                "imageUrl": "https://music-phinf.pstatic.net/20190717_4/15633720146099qp8G_PNG/dj_3_genre_9.png",
                                "stationType": "ROCK",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000007,
                                "stationName": "요즘 국힙",
                                "title": "요즘 국힙",
                                "imageUrl": "https://music-phinf.pstatic.net/20190717_19/1563371989398zXTlJ_PNG/dj_3_genre_7.png",
                                "stationType": "DOMESTIC_HIPHOP",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000008,
                                "stationName": "요즘 외힙",
                                "title": "요즘 외힙",
                                "imageUrl": "https://music-phinf.pstatic.net/20190717_156/1563372004386TBVUz_PNG/dj_3_genre_8.png",
                                "stationType": "OVERSEA_HIPHOP",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000027,
                                "stationName": "EDM",
                                "title": "EDM",
                                "imageUrl": "https://music-phinf.pstatic.net/20200408_95/1586329462461vEXWy_PNG/dj_3_genre_27_EDM.png",
                                "stationType": "EDM",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000012,
                                "stationName": "재즈 피아노",
                                "title": "재즈 피아노",
                                "imageUrl": "https://music-phinf.pstatic.net/20190717_200/1563372046523807as_PNG/dj_3_genre_12.png",
                                "stationType": "PIANO_JAZZ",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000019,
                                "stationName": "60, 70년대 가요",
                                "title": "60, 70년대 가요",
                                "imageUrl": "https://music-phinf.pstatic.net/20190717_294/15633721206892HiBL_PNG/dj_3_genre_19.png",
                                "stationType": "OLD_SONG",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000005,
                                "stationName": "슬픈 발라드",
                                "title": "슬픈 발라드",
                                "imageUrl": "https://music-phinf.pstatic.net/20190717_231/1563371969001XG9e6_PNG/dj_3_genre_5.png",
                                "stationType": "BALAD",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000010,
                                "stationName": "락 레전드",
                                "title": "락 레전드",
                                "imageUrl": "https://music-phinf.pstatic.net/20190717_174/1563372025425QcCYF_PNG/dj_3_genre_10.png",
                                "stationType": "ROCK_CLASSIC",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000025,
                                "stationName": "클래식 피아노",
                                "title": "클래식 피아노",
                                "imageUrl": "https://music-phinf.pstatic.net/20190717_221/1563372166411eyvsw_PNG/dj_3_genre_24.png",
                                "stationType": "PIANO_CLASSIC",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000023,
                                "stationName": "잔잔한 클래식",
                                "title": "잔잔한 클래식",
                                "imageUrl": "https://music-phinf.pstatic.net/20190717_160/1563372155556RiooH_PNG/dj_3_genre_23.png",
                                "stationType": "CLASSIC",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000026,
                                "stationName": "CCM",
                                "title": "CCM",
                                "imageUrl": "https://music-phinf.pstatic.net/20190717_68/1563372186717aejjU_PNG/dj_3_genre_26.png",
                                "stationType": "CCM",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000002,
                                "stationName": "요즘 Pop",
                                "title": "요즘 Pop",
                                "imageUrl": "https://music-phinf.pstatic.net/20190717_294/1563371930617qgT9H_PNG/dj_3_genre_2.png",
                                "stationType": "POP",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000013,
                                "stationName": "국내 인디",
                                "title": "국내 인디",
                                "imageUrl": "https://music-phinf.pstatic.net/20190717_144/1563372056614GXUwM_PNG/dj_3_genre_13.png",
                                "stationType": "DOMESTIC_INDIE",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000014,
                                "stationName": "해외 인디",
                                "title": "해외 인디",
                                "imageUrl": "https://music-phinf.pstatic.net/20190717_194/1563372066530GVknv_PNG/dj_3_genre_14.png",
                                "stationType": "INDIE_POP",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000003,
                                "stationName": "여자 아이돌",
                                "title": "여자 아이돌",
                                "imageUrl": "https://music-phinf.pstatic.net/20190717_279/1563371941301koKcB_PNG/dj_3_genre_3.png",
                                "stationType": "GIRLGROUP",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000015,
                                "stationName": "90년대 가요",
                                "title": "90년대 가요",
                                "imageUrl": "https://music-phinf.pstatic.net/20190717_71/1563372076149daOFL_PNG/dj_3_genre_15.png",
                                "stationType": "NINETY",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000028,
                                "stationName": "테크노",
                                "title": "테크노",
                                "imageUrl": "https://music-phinf.pstatic.net/20200408_23/15863294839281Xdrt_PNG/dj_3_genre_28_TECHNO.png",
                                "stationType": "TECHNO",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000018,
                                "stationName": "80년대 Pop",
                                "title": "80년대 Pop",
                                "imageUrl": "https://music-phinf.pstatic.net/20190717_109/15633721096810fFma_PNG/dj_3_genre_18.png",
                                "stationType": "EIGHTY_POP",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000020,
                                "stationName": "60, 70년대 Pop",
                                "title": "60, 70년대 Pop",
                                "imageUrl": "https://music-phinf.pstatic.net/20190717_261/1563372129689dcr5i_PNG/dj_3_genre_20.png",
                                "stationType": "OLD_POP",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000024,
                                "stationName": "인기 동요",
                                "title": "인기 동요",
                                "imageUrl": "https://music-phinf.pstatic.net/20190717_123/1563372175687SzUib_PNG/dj_3_genre_25.png",
                                "stationType": "CHILDREN",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000017,
                                "stationName": "80년대 가요",
                                "title": "80년대 가요",
                                "imageUrl": "https://music-phinf.pstatic.net/20190717_12/1563372097890NSssB_PNG/dj_3_genre_17.png",
                                "stationType": "EIGHTY",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000022,
                                "stationName": "영화 OST",
                                "title": "영화 OST",
                                "imageUrl": "https://music-phinf.pstatic.net/20190717_113/1563372147355UlM0D_PNG/dj_3_genre_22.png",
                                "stationType": "MOVIE_OST",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000004,
                                "stationName": "남자아이돌",
                                "title": "남자아이돌",
                                "imageUrl": "https://music-phinf.pstatic.net/20190717_99/1563371956581gtQrS_PNG/dj_3_genre_4.png",
                                "stationType": "BOYGROUP",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000006,
                                "stationName": "편안한 알앤비",
                                "title": "편안한 알앤비",
                                "imageUrl": "https://music-phinf.pstatic.net/20190717_232/1563371979830g7WlP_PNG/dj_3_genre_6.png",
                                "stationType": "SOUL",
                                "contentType": "GENRE"
                            },
                            {
                                "stationNo": 20000021,
                                "stationName": "드라마 OST",
                                "title": "드라마 OST",
                                "imageUrl": "https://music-phinf.pstatic.net/20190717_160/1563372138920EHpAE_PNG/dj_3_genre_21.png",
                                "stationType": "DRAMA_OST",
                                "contentType": "GENRE"
                            }
                        ]
                    }
                ]
            }
        }
    }

--
fetch("https://apis.naver.com/vibeWeb/musicapiweb/v1/station/10000010/tracks?limit=10", {
  "headers": {
    "accept": "application/json",
    "accept-language": "en-US,en;q=0.9,ko-KR;q=0.8,ko;q=0.7",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Google Chrome\";v=\"149\", \"Chromium\";v=\"149\", \"Not)A;Brand\";v=\"24\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site"
  },
  "referrer": "https://vibe.naver.com/dj-station",
  "body": null,
  "method": "GET",
  "mode": "cors",
  "credentials": "include"
});
    {
    "response": {
        "result": {
            "stationTotalCount": 1,
            "stationList": [
                {
                    "stationNo": 10000010,
                    "stationName": "휴식할때",
                    "stationType": "REST",
                    "stationImage": "http://music.phinf.naver.net/20180430_173/1525093357197uB6ln_PNG/dj_1_mood_10.png",
                    "title": "휴식할때",
                    "trackTotalCount": 10,
                    "tracks": [
                        {
                            "trackId": 104412691,
                            "trackTitle": "철부지 사랑",
                            "represent": true,
                            "discNumber": 1,
                            "trackNumber": 1,
                            "artists": [
                                {
                                    "artistId": 566040,
                                    "artistName": "구수경",
                                    "imageUrl": "https://musicmeta-phinf.pstatic.net/artist/000/566/566040.jpg?type=r300&v=20260227153909"
                                }
                            ],
                            "album": {
                                "albumId": 37565048,
                                "albumTitle": "철부지 사랑 (from 사랑을 처방해 드립니다 OST Part 12)",
                                "releaseDate": "2026.06.07",
                                "imageUrl": "https://musicmeta-phinf.pstatic.net/album/037/565/37565048.jpg?type=r480Fll&v=20260604142705",
                                "artists": [
                                    {
                                        "artistId": 566040,
                                        "artistName": "구수경",
                                        "imageUrl": "https://musicmeta-phinf.pstatic.net/artist/000/566/566040.jpg?type=r300&v=20260227153909"
                                    }
                                ],
                                "artistTotalCount": 1
                            },
                            "hasLyric": true,
                            "hasSyncLyric": false,
                            "isStreaming": true,
                            "isDownload": true,
                            "isMobileDownload": true,
                            "isAdult": false,
                            "representDownloadPrice": 700,
                            "isPrdd": true,
                            "isAodd": true,
                            "isOversea": false,
                            "playTime": "03:14",
                            "isKaraokeEnabled": true,
                            "isDolbyAtmos": false,
                            "hasDolbyAtmos": false
                        },