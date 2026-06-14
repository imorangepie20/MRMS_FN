from __future__ import annotations

from mrms.search.share_url import parse_share_url


def test_spotify_track_with_query():
    assert parse_share_url("https://open.spotify.com/track/7yED4n2U8RR5LKZVmisiev?si=abc") \
        == ("spotify", "track", "7yED4n2U8RR5LKZVmisiev")


def test_spotify_playlist_algorithmic():
    assert parse_share_url("https://open.spotify.com/playlist/37i9dQZF1E35KmzZ4Jlvh3?si=x") \
        == ("spotify", "playlist", "37i9dQZF1E35KmzZ4Jlvh3")


def test_spotify_album():
    assert parse_share_url("https://open.spotify.com/album/1A2B3C") == ("spotify", "album", "1A2B3C")


def test_tidal_playlist_uuid():
    assert parse_share_url("https://tidal.com/playlist/edf3b7d2-cb42-41d7-93c0-afa2a395521b") \
        == ("tidal", "playlist", "edf3b7d2-cb42-41d7-93c0-afa2a395521b")


def test_tidal_browse_album_and_www():
    assert parse_share_url("https://tidal.com/browse/album/12345") == ("tidal", "album", "12345")
    assert parse_share_url("https://www.tidal.com/track/999") == ("tidal", "track", "999")


def test_rejects_unsupported():
    assert parse_share_url("https://youtube.com/watch?v=x") is None          # 미지원 호스트
    assert parse_share_url("https://open.spotify.com/artist/1abc") is None    # 미지원 타입
    assert parse_share_url("https://open.spotify.com/track") is None          # id 없음
    assert parse_share_url("not a url") is None
    assert parse_share_url("") is None
