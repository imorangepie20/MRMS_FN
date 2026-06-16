"""ArtistProfile 캐시 — upsert/get."""
from mrms.db.artist_profile import get_artist_profile, upsert_artist_profile


def test_upsert_then_get_roundtrip(db_conn, cleanup):
    norm = "test artist xyz"
    cleanup('DELETE FROM "ArtistProfile" WHERE "nameNormalized" = %s', (norm,))
    upsert_artist_profile(
        db_conn, norm, "Test Artist XYZ", "두 문장 소개.",
        "https://img/x.jpg", ["jazz", "swing"],
        bio_full="원문 전체 전기 텍스트.",
    )
    p = get_artist_profile(db_conn, norm)
    assert p is not None
    assert p["name"] == "Test Artist XYZ"
    assert p["bio"] == "두 문장 소개."
    assert p["image_url"] == "https://img/x.jpg"
    assert p["genres"] == ["jazz", "swing"]
    assert p["bio_full"] == "원문 전체 전기 텍스트."


def test_get_missing_returns_none(db_conn):
    assert get_artist_profile(db_conn, "definitely-not-cached-zzz") is None
