# Spotify Web Scrapping Source Code

## Popular albums and singles
-
fetch("https://api-partner.spotify.com/pathfinder/v2/query", {
  "headers": {
    "accept": "application/json",
    "accept-language": "en",
    "app-platform": "WebPlayer",
    "authorization": "Bearer BQAvScNjQAxdmPdzOGL8VtFZL8rlqCRQETrvp6AF3_71fyNn_EBtFQW6NE9nr2Fn95dKTudiqpNmSNKIbW43G4GDYoCphK5hwO_7xCgX1QUabOOkgykch8hkw_4LSQYZ4AU2zchMBvlO",
    "client-token": "AAB6K5RUTMUWp7/s3RnoBsCC4K0sTPq4YqckJRZA2LfgmLkXbMVftPJaCImXZht2a61nCdQY0r0Ewf2EQeMWXPTyE9RZ1Q5QHl/uW6mWtl2Hos0KldwQd/S00pAbvCDe9IYpSpB7AIglMhBMESg4/WelwwuwXUsROBKKuw4Gq549QSLNeknhriAOFmtUgFF7BIomyp5GDX+O4QGIxOivB/fekXb9gKYepqNp0Ja26eDvM4e2mgUpgOTDtd3wlm2dmIDXWpqlek/qIwa34+ZlNbSX59S/XyDDnbyZuLKxEYL2JR6WvKBt9kLox285erXF/GFV9TjWhvjoU6AHJEQ5+6JdN63Viw==",
    "content-type": "application/json;charset=UTF-8",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Google Chrome\";v=\"149\", \"Chromium\";v=\"149\", \"Not)A;Brand\";v=\"24\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "spotify-app-version": "1.2.93.74.g96d1110e"
  },
  "referrer": "https://open.spotify.com/",
  "body": "{\"variables\":{\"uri\":\"spotify:section:0JQ5DAnM3wGh0gz1MXnu3B\",\"homeEndUserIntegration\":\"INTEGRATION_WEB_PLAYER\",\"timeZone\":\"Asia/Seoul\",\"sp_t\":\"fd1823f5-68aa-4752-bf41-f810d5747330\",\"sectionItemsOffset\":0,\"sectionItemsLimit\":20},\"operationName\":\"homeSection\",\"extensions\":{\"persistedQuery\":{\"version\":1,\"sha256Hash\":\"40c1423fc26ea0d68cd8f212e79ca47df7968fc40d83d184e756af54fd043143\"}}}",
  "method": "POST",
  "mode": "cors",
  "credentials": "include"
});

    {
        "data": {
            "homeSections": {
                "__typename": "HomeSectionCollection",
                "sections": [
                    {
                        "__typename": "HomeSection",
                        "data": {
                            "__typename": "HomeGenericSectionData",
                            "headerEntity": {
                                "__typename": "UnknownType"
                            },
                            "subtitle": {
                                "transformedLabel": "",
                                "translatedBaseText": null
                            },
                            "title": {
                                "transformedLabel": "Popular albums",
                                "translatedBaseText": "Popular albums"
                            }
                        },
                        "sectionItems": {
                            "items": [
                                {
                                    "content": {
                                        "__typename": "AlbumResponseWrapper",
                                        "data": {
                                            "__typename": "Album",
                                            "artists": {
                                                "items": [
                                                    {
                                                        "profile": {
                                                            "name": "PLAVE"
                                                        },
                                                        "uri": "spotify:artist:0k2zyzGq6HX383VlMBOvRG"
                                                    }
                                                ]
                                            },
                                            "coverArt": {
                                                "extractedColors": {
                                                    "colorDark": {
                                                        "hex": "#535353",
                                                        "isFallback": true
                                                    }
                                                },
                                                "sources": [
                                                    {
                                                        "height": 300,
                                                        "url": "https://i.scdn.co/image/ab67616d00001e02ca59009b95be7b850357de10",
                                                        "width": 300
                                                    },
                                                    {
                                                        "height": 64,
                                                        "url": "https://i.scdn.co/image/ab67616d00004851ca59009b95be7b850357de10",
                                                        "width": 64
                                                    },
                                                    {
                                                        "height": 640,
                                                        "url": "https://i.scdn.co/image/ab67616d0000b273ca59009b95be7b850357de10",
                                                        "width": 640
                                                    }
                                                ]
                                            },
                                            "name": "Caligo Pt.1",
                                            "playability": {
                                                "playable": true,
                                                "reason": "PLAYABLE"
                                            },
                                            "albumType": "EP",
                                            "uri": "spotify:album:6EgR5UlxMx9JksQUqR9Yep"
                                        }
                                    },
                                    "data": null,
                                    "uri": "spotify:album:6EgR5UlxMx9JksQUqR9Yep"
                                },
                                {
                                    "content": {
                                        "__typename": "AlbumResponseWrapper",
                                        "data": {
                                            "__typename": "Album",
                                            "artists": {
                                                "items": [
                                                    {
                                                        "profile": {
                                                            "name": "Lim Young Woong"
                                                        },
                                                        "uri": "spotify:artist:75MOYjGEyyH5U4ZFHOPvxR"
                                                    }
                                                ]
                                            },
                                            "coverArt": {
                                                "extractedColors": {
                                                    "colorDark": {
                                                        "hex": "#85745A",
                                                        "isFallback": false
                                                    }
                                                },
                                                "sources": [
                                                    {
                                                        "height": 300,
                                                        "url": "https://i.scdn.co/image/ab67616d00001e028f116e476da669a9a3e7dcaa",
                                                        "width": 300
                                                    },
                                                    {
                                                        "height": 64,
                                                        "url": "https://i.scdn.co/image/ab67616d000048518f116e476da669a9a3e7dcaa",
                                                        "width": 64
                                                    },
                                                    {
                                                        "height": 640,
                                                        "url": "https://i.scdn.co/image/ab67616d0000b2738f116e476da669a9a3e7dcaa",
                                                        "width": 640
                                                    }
                                                ]
                                            },
                                            "name": "IM HERO",
                                            "playability": {
                                                "playable": true,
                                                "reason": "PLAYABLE"
                                            },
                                            "albumType": "ALBUM",
                                            "uri": "spotify:album:5ITErfEiF1nEo8KTRgLv43"
                                        }
                                    },
                                    "data": null,
                                    "uri": "spotify:album:5ITErfEiF1nEo8KTRgLv43"
                                },

--
fetch("https://api-partner.spotify.com/pathfinder/v2/query", {
  "headers": {
    "accept": "application/json",
    "accept-language": "en",
    "app-platform": "WebPlayer",
    "authorization": "Bearer BQAvScNjQAxdmPdzOGL8VtFZL8rlqCRQETrvp6AF3_71fyNn_EBtFQW6NE9nr2Fn95dKTudiqpNmSNKIbW43G4GDYoCphK5hwO_7xCgX1QUabOOkgykch8hkw_4LSQYZ4AU2zchMBvlO",
    "client-token": "AAB6K5RUTMUWp7/s3RnoBsCC4K0sTPq4YqckJRZA2LfgmLkXbMVftPJaCImXZht2a61nCdQY0r0Ewf2EQeMWXPTyE9RZ1Q5QHl/uW6mWtl2Hos0KldwQd/S00pAbvCDe9IYpSpB7AIglMhBMESg4/WelwwuwXUsROBKKuw4Gq549QSLNeknhriAOFmtUgFF7BIomyp5GDX+O4QGIxOivB/fekXb9gKYepqNp0Ja26eDvM4e2mgUpgOTDtd3wlm2dmIDXWpqlek/qIwa34+ZlNbSX59S/XyDDnbyZuLKxEYL2JR6WvKBt9kLox285erXF/GFV9TjWhvjoU6AHJEQ5+6JdN63Viw==",
    "content-type": "application/json;charset=UTF-8",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Google Chrome\";v=\"149\", \"Chromium\";v=\"149\", \"Not)A;Brand\";v=\"24\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "spotify-app-version": "896000000"
  },
  "referrer": "https://open.spotify.com/",
  "body": "{\"variables\":{\"uri\":\"spotify:album:6EgR5UlxMx9JksQUqR9Yep\",\"locale\":\"\",\"offset\":0,\"limit\":50},\"operationName\":\"getAlbum\",\"extensions\":{\"persistedQuery\":{\"version\":1,\"sha256Hash\":\"b9bfabef66ed756e5e13f68a942deb60bd4125ec1f1be8cc42769dc0259b4b10\"}}}",
  "method": "POST",
  "mode": "cors",
  "credentials": "include"
});

            "sharingInfo": {
                "shareId": "WRVnY4K-Qfea6p9Zlckkwg",
                "shareUrl": "https://open.spotify.com/album/6EgR5UlxMx9JksQUqR9Yep?si=WRVnY4K-Qfea6p9Zlckkwg"
            },
            "tracksV2": {
                "items": [
                    {
                        "track": {
                            "artists": {
                                "items": [
                                    {
                                        "profile": {
                                            "name": "PLAVE"
                                        },
                                        "uri": "spotify:artist:0k2zyzGq6HX383VlMBOvRG"
                                    }
                                ]
                            },
                            "associationsV3": {
                                "videoAssociations": {
                                    "totalCount": 0
                                }
                            },
                            "contentRating": {
                                "label": "NONE"
                            },
                            "discNumber": 1,
                            "duration": {
                                "totalMilliseconds": 210826
                            },
                            "name": "Chroma Drift",
                            "playability": {
                                "playable": true
                            },
                            "playcount": "24016682",
                            "relinkingInformation": null,
                            "saved": false,
                            "trackNumber": 1,
                            "uri": "spotify:track:0BA3uoKlu9CsHgXIeAiXmJ"
                        },
                        "uid": "44ad16a82124ca346a1f"
                    },
                    {
                        "track": {
                            "artists": {
                                "items": [
                                    {
                                        "profile": {
                                            "name": "PLAVE"
                                        },
                                        "uri": "spotify:artist:0k2zyzGq6HX383VlMBOvRG"
                                    }
                                ]
                            },
                            "associationsV3": {
                                "videoAssociations": {
                                    "totalCount": 1
                                }
                            },
                            "contentRating": {
                                "label": "NONE"
                            },
                            "discNumber": 1,
                            "duration": {
                                "totalMilliseconds": 174533
                            },
                            "name": "Dash",
                            "playability": {
                                "playable": true
                            },
                            "playcount": "27537429",
                            "relinkingInformation": null,
                            "saved": false,
                            "trackNumber": 2,
                            "uri": "spotify:track:2sDcIrosoXqiGv1D5OQUvF"
                        },
                        "uid": "a12f7975de361590d2e7"
                    },
                    {
                        "track": {
                            "artists": {
                                "items": [
                                    {
                                        "profile": {
                                            "name": "PLAVE"
                                        },
                                        "uri": "spotify:artist:0k2zyzGq6HX383VlMBOvRG"
                                    }
                                ]
                            },
                            "associationsV3": {
                                "videoAssociations": {
                                    "totalCount": 0
                                }
                            },
                            "contentRating": {
                                "label": "NONE"
                            },
                            "discNumber": 1,
                            "duration": {
                                "totalMilliseconds": 164733
                            },
                            "name": "RIZZ",
                            "playability": {
                                "playable": true
                            },
                            "playcount": "14988814",
                            "relinkingInformation": null,
                            "saved": false,
                            "trackNumber": 3,
                            "uri": "spotify:track:6JbyOUBLnkMadKcPQoQeTR"
                        },
                        "uid": "4e4b9394ab6f16bfc044"
                    },

## Trending songs
-
fetch("https://api-partner.spotify.com/pathfinder/v2/query", {
  "headers": {
    "accept": "application/json",
    "accept-language": "en",
    "app-platform": "WebPlayer",
    "authorization": "Bearer BQAvScNjQAxdmPdzOGL8VtFZL8rlqCRQETrvp6AF3_71fyNn_EBtFQW6NE9nr2Fn95dKTudiqpNmSNKIbW43G4GDYoCphK5hwO_7xCgX1QUabOOkgykch8hkw_4LSQYZ4AU2zchMBvlO",
    "client-token": "AABc5mcfg5zyQY8voF28LWPijUcvmVrnSg/vWOjYZpCzx67/G3JV6+Gw3BtM9zkD0bqpQ7ccgnwwJrPVd26nSZLt+V4HblItLo7onCwYSxxmCwpOzevB4sdCf+2oqT/ecSjyEOTMXyX5oCJM83rxie4qLD2Yt0kIzmKuf0Bc/W5lSUOJb/Z/pBgFZIV8A9AviuCefgpyL9YpfxzhpxjJ6lUfpGO2Pg2XUPx1NmvMJkx0Iaghoxshh36yLs6VO05+W039jr3sqtIWOahh/97ZnKX43c71awW6YZYOL0UI2iRIMmru4OVfcbgT8WIgYjXele70xEbE7pW6pL8tkYXLmNkAJSi29Q==",
    "content-type": "application/json;charset=UTF-8",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Google Chrome\";v=\"149\", \"Chromium\";v=\"149\", \"Not)A;Brand\";v=\"24\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "spotify-app-version": "1.2.93.74.g96d1110e"
  },
  "referrer": "https://open.spotify.com/",
  "body": "{\"variables\":{\"uri\":\"spotify:section:0JQ5DB5E8N831KzFzsBBQ2\",\"homeEndUserIntegration\":\"INTEGRATION_WEB_PLAYER\",\"timeZone\":\"Asia/Seoul\",\"sp_t\":\"fd1823f5-68aa-4752-bf41-f810d5747330\",\"sectionItemsOffset\":0,\"sectionItemsLimit\":20},\"operationName\":\"homeSection\",\"extensions\":{\"persistedQuery\":{\"version\":1,\"sha256Hash\":\"40c1423fc26ea0d68cd8f212e79ca47df7968fc40d83d184e756af54fd043143\"}}}",
  "method": "POST",
  "mode": "cors",
  "credentials": "include"
});
    {
    "data": {
        "homeSections": {
            "__typename": "HomeSectionCollection",
            "sections": [
                {
                    "__typename": "HomeSection",
                    "data": {
                        "__typename": "HomeGenericSectionData",
                        "headerEntity": {
                            "__typename": "UnknownType"
                        },
                        "subtitle": {
                            "transformedLabel": "",
                            "translatedBaseText": null
                        },
                        "title": {
                            "transformedLabel": "Trending songs",
                            "translatedBaseText": "Trending songs"
                        }
                    },
                    "sectionItems": {
                        "items": [
                            {
                                "content": {
                                    "__typename": "TrackResponseWrapper",
                                    "data": {
                                        "__typename": "Track",
                                        "albumOfTrack": {
                                            "coverArt": {
                                                "extractedColors": {
                                                    "colorDark": {
                                                        "hex": "#6B7F00",
                                                        "isFallback": false
                                                    }
                                                },
                                                "sources": [
                                                    {
                                                        "height": 300,
                                                        "url": "https://i.scdn.co/image/ab67616d00001e027a4dc71da2ae44bb97ae12c7",
                                                        "width": 300
                                                    },
                                                    {
                                                        "height": 64,
                                                        "url": "https://i.scdn.co/image/ab67616d000048517a4dc71da2ae44bb97ae12c7",
                                                        "width": 64
                                                    },
                                                    {
                                                        "height": 640,
                                                        "url": "https://i.scdn.co/image/ab67616d0000b2737a4dc71da2ae44bb97ae12c7",
                                                        "width": 640
                                                    }
                                                ]
                                            },
                                            "name": "LEMONADE - The 2nd Album",
                                            "uri": "spotify:album:5dscbWbSUuO5SNnrtiCVSB"
                                        },
                                        "artists": {
                                            "items": [
                                                {
                                                    "profile": {
                                                        "name": "aespa"
                                                    },
                                                    "uri": "spotify:artist:6YVMFz59CuY7ngCxTxjpxE"
                                                }
                                            ]
                                        },
                                        "associationsV3": {
                                            "audioAssociations": {
                                                "items": []
                                            }
                                        },
                                        "contentRating": {
                                            "label": "NONE"
                                        },
                                        "name": "LEMONADE",
                                        "uri": "spotify:track:7a3iH9vM5Z58GqOMqXBU1M"
                                    }
                                },
                                "data": null,
                                "uri": "spotify:track:7a3iH9vM5Z58GqOMqXBU1M"
                            },

--
fetch("https://api-partner.spotify.com/pathfinder/v2/query", {
  "headers": {
    "accept": "application/json",
    "accept-language": "en",
    "app-platform": "WebPlayer",
    "authorization": "Bearer BQAvScNjQAxdmPdzOGL8VtFZL8rlqCRQETrvp6AF3_71fyNn_EBtFQW6NE9nr2Fn95dKTudiqpNmSNKIbW43G4GDYoCphK5hwO_7xCgX1QUabOOkgykch8hkw_4LSQYZ4AU2zchMBvlO",
    "client-token": "AABc5mcfg5zyQY8voF28LWPijUcvmVrnSg/vWOjYZpCzx67/G3JV6+Gw3BtM9zkD0bqpQ7ccgnwwJrPVd26nSZLt+V4HblItLo7onCwYSxxmCwpOzevB4sdCf+2oqT/ecSjyEOTMXyX5oCJM83rxie4qLD2Yt0kIzmKuf0Bc/W5lSUOJb/Z/pBgFZIV8A9AviuCefgpyL9YpfxzhpxjJ6lUfpGO2Pg2XUPx1NmvMJkx0Iaghoxshh36yLs6VO05+W039jr3sqtIWOahh/97ZnKX43c71awW6YZYOL0UI2iRIMmru4OVfcbgT8WIgYjXele70xEbE7pW6pL8tkYXLmNkAJSi29Q==",
    "content-type": "application/json;charset=UTF-8",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Google Chrome\";v=\"149\", \"Chromium\";v=\"149\", \"Not)A;Brand\";v=\"24\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "spotify-app-version": "896000000"
  },
  "referrer": "https://open.spotify.com/",
  "body": "{\"variables\":{\"uri\":\"spotify:album:5dscbWbSUuO5SNnrtiCVSB\",\"locale\":\"\",\"offset\":0,\"limit\":50},\"operationName\":\"getAlbum\",\"extensions\":{\"persistedQuery\":{\"version\":1,\"sha256Hash\":\"b9bfabef66ed756e5e13f68a942deb60bd4125ec1f1be8cc42769dc0259b4b10\"}}}",
  "method": "POST",
  "mode": "cors",
  "credentials": "include"
});
    {
    "data": {
        "albumUnion": {
            "__typename": "Album",
            "copyright": {
                "items": [
                    {
                        "text": "© 2026 SM Entertainment",
                        "type": "C"
                    },
                    {
                        "text": "℗ 2026 SM Entertainment",
                        "type": "P"
                    }
                ],
                "totalCount": 2
            },
            "courtesyLine": "",
            "date": {
                "isoString": "2026-05-29T00:00:00Z",
                "precision": "DAY"
            },
            "isPreRelease": false,
            "label": "SM Entertainment",
            "name": "LEMONADE - The 2nd Album",
            "playability": {
                "playable": true,
                "reason": "PLAYABLE"
            },
            "preReleaseEndDateTime": null,
            "saved": false,
            "sharingInfo": {
                "shareId": "GCkIPapeTq6f3f3dUjKxwg",
                "shareUrl": "https://open.spotify.com/album/5dscbWbSUuO5SNnrtiCVSB?si=GCkIPapeTq6f3f3dUjKxwg"
            },
            "tracksV2": {
                "items": [
                    {
                        "track": {
                            "artists": {
                                "items": [
                                    {
                                        "profile": {
                                            "name": "aespa"
                                        },
                                        "uri": "spotify:artist:6YVMFz59CuY7ngCxTxjpxE"
                                    },
                                    {
                                        "profile": {
                                            "name": "G-DRAGON"
                                        },
                                        "uri": "spotify:artist:30b9WulBM8sFuBo17nNq9c"
                                    }
                                ]
                            },
                            "associationsV3": {
                                "videoAssociations": {
                                    "totalCount": 1
                                }
                            },
                            "contentRating": {
                                "label": "NONE"
                            },
                            "discNumber": 1,
                            "duration": {
                                "totalMilliseconds": 174000
                            },
                            "name": "WDA (Whole Different Animal) [feat. G-DRAGON]",
                            "playability": {
                                "playable": true
                            },
                            "playcount": "24895824",
                            "relinkingInformation": {
                                "linkedTrack": {
                                    "__typename": "Track",
                                    "uri": "spotify:track:7falENN3jIJpCXy6tSBECl"
                                }
                            },
                            "saved": false,
                            "trackNumber": 1,
                            "uri": "spotify:track:7Ccp7Oid3YFAWuY9Ar1eb3"
                        },
                        "uid": "b85c90ba704110337ca8"
                    },
                    {


## Featured Charts
-
fetch("https://api-partner.spotify.com/pathfinder/v2/query", {
  "headers": {
    "accept": "application/json",
    "accept-language": "en",
    "app-platform": "WebPlayer",
    "authorization": "Bearer BQDj-cO381yhDrSbAWbeQ2JOxGyOyDjI8uviEs6mq5la-cJMRn2WdG0OI4w3uvLbFZfhvedgLIYJE-YLBSvS9r9hkOwTF0n_a-tet62j0iBXSqkJVtvyrZKp4Ip_vK7jWCtur84xqc3B",
    "client-token": "AABsxaA9gMtxfztKFP2Y0NHqEWJfBoqMNTgP9mCgZ+nlqEyuBmXzOOts/zk0uhp5+5UHRqZ9JQGV5bWMdVxoAEU8TYNPl5Z/VBZRn/P7DsHN4i+fVAF+KirJUg0nERg4Uvg3BgZKvAgH3w9fL8gkC9OnNtAOwj0x//SUEgz275K4tutFMOIjUHkAuWa/+AqagGpkWvoJxKK8PEi4TXSQ1IHY/8LsTG8Q5KHrsQwOQl4bvm3sI+AZ9nxliQykHv2OOo/VkbiOYAcHXOZbBSA3BCmgw+OEQCj/ZbmItaBc1rvb5aGr8wym5+rY8N17m2PzO67Xkvsz76I3GIwJb4ke9drhZGUOkw==",
    "content-type": "application/json;charset=UTF-8",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Google Chrome\";v=\"149\", \"Chromium\";v=\"149\", \"Not)A;Brand\";v=\"24\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "spotify-app-version": "1.2.93.74.g96d1110e"
  },
  "referrer": "https://open.spotify.com/",
  "body": "{\"variables\":{\"uri\":\"spotify:section:0JQ5DAzQHECxDlYNI6xD1g\",\"homeEndUserIntegration\":\"INTEGRATION_WEB_PLAYER\",\"timeZone\":\"Asia/Seoul\",\"sp_t\":\"fd1823f5-68aa-4752-bf41-f810d5747330\",\"sectionItemsOffset\":0,\"sectionItemsLimit\":20},\"operationName\":\"homeSection\",\"extensions\":{\"persistedQuery\":{\"version\":1,\"sha256Hash\":\"40c1423fc26ea0d68cd8f212e79ca47df7968fc40d83d184e756af54fd043143\"}}}",
  "method": "POST",
  "mode": "cors",
  "credentials": "include"
});
    {
    "data": {
        "homeSections": {
            "__typename": "HomeSectionCollection",
            "sections": [
                {
                    "__typename": "HomeSection",
                    "data": {
                        "__typename": "HomeGenericSectionData",
                        "headerEntity": {
                            "__typename": "UnknownType"
                        },
                        "subtitle": {
                            "transformedLabel": "",
                            "translatedBaseText": null
                        },
                        "title": {
                            "transformedLabel": "Featured Charts",
                            "translatedBaseText": "Featured Charts"
                        }
                    },
                    "sectionItems": {
                        "items": [
                            {
                                "content": {
                                    "__typename": "PlaylistResponseWrapper",
                                    "data": {
                                        "__typename": "Playlist",
                                        "attributes": [
                                            {
                                                "key": "last_updated",
                                                "value": "2026-06-05T14:23:00Z"
                                            },
                                            {
                                                "key": "rank_type",
                                                "value": "plays"
                                            },
                                            {
                                                "key": "new_entries_count",
                                                "value": "5"
                                            },
                                            {
                                                "key": "chart_entity_type",
                                                "value": "track"
                                            }
                                        ],
                                        "content": {
                                            "__typename": "PlaylistItemsPage",
                                            "totalCount": 50
                                        },
                                        "description": "Your weekly update of the most played tracks right now - Global.",
                                        "format": "chart",
                                        "images": {
                                            "items": [
                                                {
                                                    "extractedColors": {
                                                        "colorDark": {
                                                            "hex": "#703090",
                                                            "isFallback": false
                                                        }
                                                    },
                                                    "sources": [
                                                        {
                                                            "height": null,
                                                            "url": "https://charts-images.scdn.co/assets/locale_en/regional/weekly/region_global_default.jpg",
                                                            "width": null
                                                        }
                                                    ]
                                                }
                                            ]
                                        },
                                        "name": "Top Songs - Global",
                                        "ownerV2": {
                                            "data": {
                                                "__typename": "User",
                                                "name": "Spotify",
                                                "uri": "spotify:user:spotify"
                                            }
                                        },
                                        "uri": "spotify:playlist:37i9dQZEVXbNG2KDcFcKOF"
                                    }
                                },
                                "data": null,
                                "uri": "spotify:playlist:37i9dQZEVXbNG2KDcFcKOF"
                            },
                            {
--
fetch("https://api-partner.spotify.com/pathfinder/v2/query", {
  "headers": {
    "accept": "application/json",
    "accept-language": "en",
    "app-platform": "WebPlayer",
    "authorization": "Bearer BQDj-cO381yhDrSbAWbeQ2JOxGyOyDjI8uviEs6mq5la-cJMRn2WdG0OI4w3uvLbFZfhvedgLIYJE-YLBSvS9r9hkOwTF0n_a-tet62j0iBXSqkJVtvyrZKp4Ip_vK7jWCtur84xqc3B",
    "client-token": "AABsxaA9gMtxfztKFP2Y0NHqEWJfBoqMNTgP9mCgZ+nlqEyuBmXzOOts/zk0uhp5+5UHRqZ9JQGV5bWMdVxoAEU8TYNPl5Z/VBZRn/P7DsHN4i+fVAF+KirJUg0nERg4Uvg3BgZKvAgH3w9fL8gkC9OnNtAOwj0x//SUEgz275K4tutFMOIjUHkAuWa/+AqagGpkWvoJxKK8PEi4TXSQ1IHY/8LsTG8Q5KHrsQwOQl4bvm3sI+AZ9nxliQykHv2OOo/VkbiOYAcHXOZbBSA3BCmgw+OEQCj/ZbmItaBc1rvb5aGr8wym5+rY8N17m2PzO67Xkvsz76I3GIwJb4ke9drhZGUOkw==",
    "content-type": "application/json;charset=UTF-8",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Google Chrome\";v=\"149\", \"Chromium\";v=\"149\", \"Not)A;Brand\";v=\"24\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"macOS\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "spotify-app-version": "1.2.93.74.g96d1110e"
  },
  "referrer": "https://open.spotify.com/",
  "body": "{\"variables\":{\"uri\":\"spotify:playlist:37i9dQZEVXbNG2KDcFcKOF\",\"offset\":0,\"limit\":50,\"includeEpisodeContentRatingsV2\":false},\"operationName\":\"fetchPlaylistContents\",\"extensions\":{\"persistedQuery\":{\"version\":1,\"sha256Hash\":\"a65e12194ed5fc443a1cdebed5fabe33ca5b07b987185d63c72483867ad13cb4\"}}}",
  "method": "POST",
  "mode": "cors",
  "credentials": "include"
});
    {
    "data": {
        "playlistV2": {
            "__typename": "Playlist",
            "content": {
                "__typename": "PlaylistItemsPage",
                "items": [
                    {
                        "addedAt": {
                            "isoString": "2026-06-05T14:23:00Z"
                        },
                        "addedBy": null,
                        "attributes": [
                            {
                                "key": "status",
                                "value": "NEW"
                            },
                            {
                                "key": "current_pos",
                                "value": "1"
                            },
                            {
                                "key": "rank",
                                "value": "43646689"
                            }
                        ],
                        "itemV2": {
                            "__typename": "TrackResponseWrapper",
                            "data": {
                                "__typename": "Track",
                                "albumOfTrack": {
                                    "artists": {
                                        "items": [
                                            {
                                                "profile": {
                                                    "name": "Ariana Grande"
                                                },
                                                "uri": "spotify:artist:66CXWjxzNUsdJxJ2JdwvnR"
                                            }
                                        ]
                                    },
                                    "coverArt": {
                                        "sources": [
                                            {
                                                "height": 300,
                                                "url": "https://i.scdn.co/image/ab67616d00001e02b622d42c30697e1e1414343c",
                                                "width": 300
                                            },
                                            {
                                                "height": 64,
                                                "url": "https://i.scdn.co/image/ab67616d00004851b622d42c30697e1e1414343c",
                                                "width": 64
                                            },
                                            {
                                                "height": 640,
                                                "url": "https://i.scdn.co/image/ab67616d0000b273b622d42c30697e1e1414343c",
                                                "width": 640
                                            }
                                        ]
                                    },
                                    "name": "hate that i made you love me",
                                    "uri": "spotify:album:1x159B5VzbDWAGBik5cr1z"
                                },
                                "artists": {
                                    "items": [
                                        {
                                            "profile": {
                                                "name": "Ariana Grande"
                                            },
                                            "uri": "spotify:artist:66CXWjxzNUsdJxJ2JdwvnR"
                                        }
                                    ]
                                },
                                "associationsV3": {
                                    "audioAssociations": {
                                        "__typename": "TrackAudioAssociationPage",
                                        "items": []
                                    },
                                    "videoAssociations": {
                                        "totalCount": 1
                                    }
                                },
                                "contentRating": {
                                    "label": "NONE"
                                },
                                "discNumber": 1,
                                "trackDuration": {
                                    "totalMilliseconds": 197949
                                },
                                "mediaType": "AUDIO",
                                "name": "hate that i made you love me",
                                "playability": {
                                    "playable": true,
                                    "reason": "PLAYABLE"
                                },
                                "playcount": "85221565",
                                "trackNumber": 1,
                                "uri": "spotify:track:20jbSiX29FDX4oQxBXyUEi"
                            }
                        },
                        "itemV3": {
                            "__typename": "EntityResponseWrapper",
                            "data": {
                                "__typename": "Entity",
                                "consumptionExperienceTrait": {
                                    "__typename": "ConsumptionExperienceTrait",
                                    "contentRatings": [],
                                    "duration": {
                                        "nanoSeconds": 0,
                                        "seconds": 197
                                    },
                                    "formats": [
                                        "FORMAT_AUDIO",
                                        "FORMAT_VIDEO",
                                        "FORMAT_LOSSLESS"
                                    ]
                                },
                                "identityTrait": {
                                    "__typename": "IdentityTrait",
                                    "contentHierarchyParent": {
                                        "__typename": "Entity",
                                        "identityTrait": {
                                            "__typename": "IdentityTrait",
                                            "name": "hate that i made you love me"
                                        },
                                        "publishingMetadataTrait": {
                                            "__typename": "PublishingMetadataTrait",
                                            "firstPublishedAt": {
                                                "isoString": "2026-05-29",
                                                "precision": "DAY"
                                            }
                                        },
                                        "uri": "spotify:album:1x159B5VzbDWAGBik5cr1z"
                                    },
                                    "contributors": {
                                        "items": [
                                            {
                                                "name": "Ariana Grande",
                                                "uri": "spotify:artist:66CXWjxzNUsdJxJ2JdwvnR"
                                            }
                                        ],
                                        "totalCount": 1
                                    },
                                    "description": "",
                                    "name": "hate that i made you love me",
                                    "type": "Song"
                                },
                                "playability": {
                                    "playable": true,
                                    "reason": "PLAYABLE"
                                },
                                "uri": "spotify:track:20jbSiX29FDX4oQxBXyUEi",
                                "visualIdentityTrait": {
                                    "__typename": "VisualIdentityTrait",
                                    "sixteenByNineCoverImage": {
                                        "image": {
                                            "data": {
                                                "__typename": "ImageV2",
                                                "sources": [
                                                    {
                                                        "imageFormat": "WEBP",
                                                        "maxHeight": 360,
                                                        "maxWidth": 640,
                                                        "url": "https://image-cdn-ak.spotifycdn.com/image/ab6742d3000052b6b959893e0a9b69575e3a561f"
                                                    },
                                                    {
                                                        "imageFormat": "WEBP",
                                                        "maxHeight": 720,
                                                        "maxWidth": 1280,
                                                        "url": "https://image-cdn-ak.spotifycdn.com/image/ab6742d3000053b6b959893e0a9b69575e3a561f"
                                                    }
                                                ]
                                            }
                                        }
                                    },
                                    "squareCoverImage": {
                                        "extractedColorSet": {
                                            "encoreBaseSetTextColor": {
                                                "alpha": 255,
                                                "blue": 187,
                                                "green": 187,
                                                "red": 187
                                            },
                                            "highContrast": {
                                                "backgroundBase": {
                                                    "alpha": 255,
                                                    "blue": 83,
                                                    "green": 83,
                                                    "red": 83
                                                },
                                                "backgroundTintedBase": {
                                                    "alpha": 255,
                                                    "blue": 51,
                                                    "green": 51,
                                                    "red": 51
                                                },
                                                "textBase": {
                                                    "alpha": 255,
                                                    "blue": 255,
                                                    "green": 255,
                                                    "red": 255
                                                },
                                                "textBrightAccent": {
                                                    "alpha": 255,
                                                    "blue": 255,
                                                    "green": 255,
                                                    "red": 255
                                                },
                                                "textSubdued": {
                                                    "alpha": 255,
                                                    "blue": 205,
                                                    "green": 205,
                                                    "red": 205
                                                }
                                            },
                                            "higherContrast": {
                                                "backgroundBase": {
                                                    "alpha": 255,
                                                    "blue": 53,
                                                    "green": 53,
                                                    "red": 53
                                                },
                                                "backgroundTintedBase": {
                                                    "alpha": 255,
                                                    "blue": 86,
                                                    "green": 86,
                                                    "red": 86
                                                },
                                                "textBase": {
                                                    "alpha": 255,
                                                    "blue": 255,
                                                    "green": 255,
                                                    "red": 255
                                                },
                                                "textBrightAccent": {
                                                    "alpha": 255,
                                                    "blue": 96,
                                                    "green": 215,
                                                    "red": 30
                                                },
                                                "textSubdued": {
                                                    "alpha": 255,
                                                    "blue": 205,
                                                    "green": 205,
                                                    "red": 205
                                                }
                                            },
                                            "minContrast": {
                                                "backgroundBase": {
                                                    "alpha": 255,
                                                    "blue": 83,
                                                    "green": 83,
                                                    "red": 83
                                                },
                                                "backgroundTintedBase": {
                                                    "alpha": 255,
                                                    "blue": 51,
                                                    "green": 51,
                                                    "red": 51
                                                },
                                                "textBase": {
                                                    "alpha": 255,
                                                    "blue": 255,
                                                    "green": 255,
                                                    "red": 255
                                                },
                                                "textBrightAccent": {
                                                    "alpha": 255,
                                                    "blue": 255,
                                                    "green": 255,
                                                    "red": 255
                                                },
                                                "textSubdued": {
                                                    "alpha": 255,
                                                    "blue": 255,
                                                    "green": 255,
                                                    "red": 255
                                                }
                                            }
                                        },
                                        "image": {
                                            "data": {
                                                "__typename": "ImageV2",
                                                "sources": [
                                                    {
                                                        "imageFormat": "WEBP",
                                                        "maxHeight": 640,
                                                        "maxWidth": 640,
                                                        "url": "https://image-cdn-ak.spotifycdn.com/image/ab67616d000075a0b622d42c30697e1e1414343c"
                                                    },
                                                    {
                                                        "imageFormat": "WEBP",
                                                        "maxHeight": 64,
                                                        "maxWidth": 64,
                                                        "url": "https://image-cdn-ak.spotifycdn.com/image/ab67616d000090d5b622d42c30697e1e1414343c"
                                                    },
                                                    {
                                                        "imageFormat": "WEBP",
                                                        "maxHeight": 300,
                                                        "maxWidth": 300,
                                                        "url": "https://image-cdn-ak.spotifycdn.com/image/ab67616d0000ab87b622d42c30697e1e1414343c"
                                                    }
                                                ]
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        "uid": "d96f2b8993316603"
                    },
                    {
                        "addedAt": {
                            "isoString": "2026-06-05T14:23:00Z"
                        },
                        "addedBy": null,
                        "attributes": [
                            {
                                "key": "status",
                                "value": "DOWN"
                            },
                            {
                                "key": "current_pos",
                                "value": "2"
                            },
                            {
                                "key": "previous_pos",
                                "value": "1"
                            },
                            {
                                "key": "rank",
                                "value": "37516431"
                            }
                        ],
                        "itemV2": {
                            "__typename": "TrackResponseWrapper",
                            "data": {
                                "__typename": "Track",
                                "albumOfTrack": {
                                    "artists": {
                                        "items": [
                                            {
                                                "profile": {
                                                    "name": "Michael Jackson"
                                                },
                                                "uri": "spotify:artist:3fMbdgg4jU18AjLCKBhRSm"
                                            }
                                        ]
                                    },
                                    "coverArt": {
                                        "sources": [
                                            {
                                                "height": 300,
                                                "url": "https://i.scdn.co/image/ab67616d00001e0232a7d87248d1b75463483df5",
                                                "width": 300
                                            },
                                            {
                                                "height": 64,
                                                "url": "https://i.scdn.co/image/ab67616d0000485132a7d87248d1b75463483df5",
                                                "width": 64
                                            },
                                            {
                                                "height": 640,
                                                "url": "https://i.scdn.co/image/ab67616d0000b27332a7d87248d1b75463483df5",
                                                "width": 640
                                            }
                                        ]
                                    },
                                    "name": "Thriller",
                                    "uri": "spotify:album:2ANVost0y2y52ema1E9xAZ"
                                },
                                "artists": {
                                    "items": [
                                        {
                                            "profile": {
                                                "name": "Michael Jackson"
                                            },
                                            "uri": "spotify:artist:3fMbdgg4jU18AjLCKBhRSm"
                                        }
                                    ]
                                },
                                "associationsV3": {
                                    "audioAssociations": {
                                        "__typename": "TrackAudioAssociationPage",
                                        "items": []
                                    },
                                    "videoAssociations": {
                                        "totalCount": 1
                                    }
                                },
                                "contentRating": {
                                    "label": "NONE"
                                },
                                "discNumber": 1,
                                "trackDuration": {
                                    "totalMilliseconds": 293802
                                },
                                "mediaType": "AUDIO",
                                "name": "Billie Jean",
                                "playability": {
                                    "playable": true,
                                    "reason": "PLAYABLE"
                                },
                                "playcount": "2893969167",
                                "trackNumber": 6,
                                "uri": "spotify:track:7J1uxwnxfQLu4APicE5Rnj"
                            }
                        },
                        "itemV3": {
                            "__typename": "EntityResponseWrapper",
                            "data": {
                                "__typename": "Entity",
                                "consumptionExperienceTrait": {
                                    "__typename": "ConsumptionExperienceTrait",
                                    "contentRatings": [],
                                    "duration": {
                                        "nanoSeconds": 0,
                                        "seconds": 293
                                    },
                                    "formats": [
                                        "FORMAT_AUDIO",
                                        "FORMAT_VIDEO",
                                        "FORMAT_LOSSLESS"
                                    ]
                                },
                                "identityTrait": {
                                    "__typename": "IdentityTrait",
                                    "contentHierarchyParent": {
                                        "__typename": "Entity",
                                        "identityTrait": {
                                            "__typename": "IdentityTrait",
                                            "name": "Thriller"
                                        },
                                        "publishingMetadataTrait": {
                                            "__typename": "PublishingMetadataTrait",
                                            "firstPublishedAt": {
                                                "isoString": "1982-11-30",
                                                "precision": "DAY"
                                            }
                                        },
                                        "uri": "spotify:album:2ANVost0y2y52ema1E9xAZ"
                                    },
                                    "contributors": {
                                        "items": [
                                            {
                                                "name": "Michael Jackson",
                                                "uri": "spotify:artist:3fMbdgg4jU18AjLCKBhRSm"
                                            }
                                        ],
                                        "totalCount": 1
                                    },
                                    "description": "",
                                    "name": "Billie Jean",
                                    "type": "Song"
                                },
                                "playability": {
                                    "playable": true,
                                    "reason": "PLAYABLE"
                                },
                                "uri": "spotify:track:7J1uxwnxfQLu4APicE5Rnj",
                                "visualIdentityTrait": {
                                    "__typename": "VisualIdentityTrait",
                                    "sixteenByNineCoverImage": {
                                        "image": {
                                            "data": {
                                                "__typename": "ImageV2",
                                                "sources": [
                                                    {
                                                        "imageFormat": "WEBP",
                                                        "maxHeight": 360,
                                                        "maxWidth": 640,
                                                        "url": "https://image-cdn-ak.spotifycdn.com/image/ab6742d3000052b6854e9c1b65eeb19182529a10"
                                                    },
                                                    {
                                                        "imageFormat": "WEBP",
                                                        "maxHeight": 720,
                                                        "maxWidth": 1280,
                                                        "url": "https://image-cdn-ak.spotifycdn.com/image/ab6742d3000053b6854e9c1b65eeb19182529a10"
                                                    }
                                                ]
                                            }
                                        }
                                    },
                                    "squareCoverImage": {
                                        "extractedColorSet": {
                                            "encoreBaseSetTextColor": {
                                                "alpha": 255,
                                                "blue": 192,
                                                "green": 192,
                                                "red": 167
                                            },
                                            "highContrast": {
                                                "backgroundBase": {
                                                    "alpha": 255,
                                                    "blue": 87,
                                                    "green": 87,
                                                    "red": 65
                                                },
                                                "backgroundTintedBase": {
                                                    "alpha": 255,
                                                    "blue": 55,
                                                    "green": 54,
                                                    "red": 33
                                                },
                                                "textBase": {
                                                    "alpha": 255,
                                                    "blue": 255,
                                                    "green": 255,
                                                    "red": 255
                                                },
                                                "textBrightAccent": {
                                                    "alpha": 255,
                                                    "blue": 255,
                                                    "green": 255,
                                                    "red": 255
                                                },
                                                "textSubdued": {
                                                    "alpha": 255,
                                                    "blue": 210,
                                                    "green": 210,
                                                    "red": 185
                                                }
                                            },
                                            "higherContrast": {
                                                "backgroundBase": {
                                                    "alpha": 255,
                                                    "blue": 57,
                                                    "green": 57,
                                                    "red": 35
                                                },
                                                "backgroundTintedBase": {
                                                    "alpha": 255,
                                                    "blue": 90,
                                                    "green": 90,
                                                    "red": 68
                                                },
                                                "textBase": {
                                                    "alpha": 255,
                                                    "blue": 255,
                                                    "green": 255,
                                                    "red": 255
                                                },
                                                "textBrightAccent": {
                                                    "alpha": 255,
                                                    "blue": 96,
                                                    "green": 215,
                                                    "red": 30
                                                },
                                                "textSubdued": {
                                                    "alpha": 255,
                                                    "blue": 210,
                                                    "green": 210,
                                                    "red": 185
                                                }
                                            },
                                            "minContrast": {
                                                "backgroundBase": {
                                                    "alpha": 255,
                                                    "blue": 144,
                                                    "green": 144,
                                                    "red": 120
                                                },
                                                "backgroundTintedBase": {
                                                    "alpha": 255,
                                                    "blue": 118,
                                                    "green": 118,
                                                    "red": 95
                                                },
                                                "textBase": {
                                                    "alpha": 255,
                                                    "blue": 255,
                                                    "green": 255,
                                                    "red": 255
                                                },
                                                "textBrightAccent": {
                                                    "alpha": 255,
                                                    "blue": 255,
                                                    "green": 255,
                                                    "red": 255
                                                },
                                                "textSubdued": {
                                                    "alpha": 255,
                                                    "blue": 255,
                                                    "green": 255,
                                                    "red": 255
                                                }
                                            }
                                        },
                                        "image": {
                                            "data": {
                                                "__typename": "ImageV2",
                                                "sources": [
                                                    {
                                                        "imageFormat": "WEBP",
                                                        "maxHeight": 640,
                                                        "maxWidth": 640,
                                                        "url": "https://image-cdn-ak.spotifycdn.com/image/ab67616d000075a032a7d87248d1b75463483df5"
                                                    },
                                                    {
                                                        "imageFormat": "WEBP",
                                                        "maxHeight": 64,
                                                        "maxWidth": 64,
                                                        "url": "https://image-cdn-ak.spotifycdn.com/image/ab67616d000090d532a7d87248d1b75463483df5"
                                                    },
                                                    {
                                                        "imageFormat": "WEBP",
                                                        "maxHeight": 300,
                                                        "maxWidth": 300,
                                                        "url": "https://image-cdn-ak.spotifycdn.com/image/ab67616d0000ab8732a7d87248d1b75463483df5"
                                                    }
                                                ]
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        "uid": "b5f080c3039215b9"
                    },
                    {