"""ArtworkCache — negative cache TTL (positive 영구, negative 7일 만료)."""
import uuid as _uuid

from mrms.db.artwork import _key, get_cached, upsert


def _age(db_conn, key, interval):
    with db_conn.cursor() as cur:
        cur.execute(
            f'UPDATE "ArtworkCache" SET "fetchedAt" = NOW() - INTERVAL \'{interval}\' '
            'WHERE key = %s',
            (key,),
        )
    db_conn.commit()


def test_negative_cache_expires_positive_permanent(db_conn, cleanup):
    artist = f"Art-{_uuid.uuid4().hex[:8]}"
    album = f"Alb-{_uuid.uuid4().hex[:8]}"
    key = _key(artist, album)
    cleanup('DELETE FROM "ArtworkCache" WHERE key = %s', (key,))

    # 갓 저장한 negative → hit (재시도 안 함)
    upsert(db_conn, artist, album, None)
    hit, url = get_cached(db_conn, artist, album)
    assert hit is True and url is None

    # 8일 지난 negative → miss (재시도 허용)
    _age(db_conn, key, "8 days")
    hit, url = get_cached(db_conn, artist, album)
    assert hit is False

    # positive는 30일 지나도 hit (영구)
    upsert(db_conn, artist, album, "https://x/cover600.jpg")
    _age(db_conn, key, "30 days")
    hit, url = get_cached(db_conn, artist, album)
    assert hit is True and url == "https://x/cover600.jpg"
