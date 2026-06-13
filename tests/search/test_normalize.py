from __future__ import annotations

from mrms.search.normalize import (
    normalize_spotify_track,
    normalize_spotify_album,
    normalize_spotify_playlist,
    normalize_tidal_track,
)


def test_normalize_spotify_track_full():
    raw = {
        "id": "sp1",
        "name": "Ditto",
        "artists": [{"name": "NewJeans"}],
        "album": {"name": "OMG", "images": [{"url": "https://c/omg.jpg"}]},
        "duration_ms": 185000,
        "external_ids": {"isrc": "KRA401900001"},
    }
    t = normalize_spotify_track(raw)
    assert t == {
        "platform": "spotify",
        "platform_track_id": "sp1",
        "title": "Ditto",
        "artist": "NewJeans",
        "album_title": "OMG",
        "album_cover": "https://c/omg.jpg",
        "duration_ms": 185000,
        "isrc": "KRA401900001",
    }


def test_normalize_spotify_track_missing_fields_returns_none_on_no_id():
    assert normalize_spotify_track({"name": "x"}) is None
    t = normalize_spotify_track({"id": "sp2", "name": "x"})
    assert t["artist"] == "" and t["album_title"] is None and t["isrc"] is None


def test_normalize_spotify_album():
    raw = {
        "id": "al1", "name": "OMG",
        "artists": [{"name": "NewJeans"}],
        "images": [{"url": "https://c/omg.jpg"}],
        "total_tracks": 2,
    }
    assert normalize_spotify_album(raw) == {
        "type": "album", "platform": "spotify", "platform_id": "al1",
        "title": "OMG", "subtitle": "NewJeans",
        "cover_url": "https://c/omg.jpg", "track_count": 2,
    }


def test_normalize_spotify_playlist_nullguard():
    assert normalize_spotify_playlist(None) is None
    raw = {
        "id": "pl1", "name": "K-pop Hits",
        "owner": {"display_name": "Spotify"},
        "images": [{"url": "https://c/pl.jpg"}],
        "tracks": {"total": 50},
    }
    assert normalize_spotify_playlist(raw) == {
        "type": "playlist", "platform": "spotify", "platform_id": "pl1",
        "title": "K-pop Hits", "subtitle": "Spotify",
        "cover_url": "https://c/pl.jpg", "track_count": 50,
    }


def test_normalize_tidal_track():
    raw = {
        "id": 123, "title": "Hype Boy",
        "artists": [{"name": "NewJeans"}],
        "album": {"title": "New Jeans", "cover": "abc-cover-uuid"},
        "duration": 179, "isrc": "KRA401900002",
    }
    t = normalize_tidal_track(raw)
    assert t["platform"] == "tidal"
    assert t["platform_track_id"] == "123"
    assert t["title"] == "Hype Boy"
    assert t["artist"] == "NewJeans"
    assert t["duration_ms"] == 179000
    assert t["isrc"] == "KRA401900002"


from mrms.search.normalize import merge_tracks


def test_merge_same_isrc_combines_platforms():
    sp = {"platform": "spotify", "platform_track_id": "sp1", "title": "Ditto",
          "artist": "NewJeans", "album_title": "OMG", "album_cover": "c1",
          "duration_ms": 185000, "isrc": "KRA401900001"}
    td = {"platform": "tidal", "platform_track_id": "999", "title": "Ditto",
          "artist": "NewJeans", "album_title": "OMG", "album_cover": "c2",
          "duration_ms": 185000, "isrc": "KRA401900001"}
    merged = merge_tracks([sp, td])
    assert len(merged) == 1
    m = merged[0]
    assert m["isrc"] == "KRA401900001"
    assert m["spotify_track_id"] == "sp1"
    assert m["tidal_track_id"] == "999"
    assert m["title"] == "Ditto"


def test_merge_no_isrc_kept_separate():
    a = {"platform": "spotify", "platform_track_id": "sp1", "title": "x",
         "artist": "y", "album_title": None, "album_cover": None,
         "duration_ms": None, "isrc": None}
    b = {"platform": "tidal", "platform_track_id": "td1", "title": "x",
         "artist": "y", "album_title": None, "album_cover": None,
         "duration_ms": None, "isrc": None}
    merged = merge_tracks([a, b])
    assert len(merged) == 2
    assert merged[0]["spotify_track_id"] == "sp1" and merged[0]["tidal_track_id"] is None
    assert merged[1]["tidal_track_id"] == "td1" and merged[1]["spotify_track_id"] is None
