"""ArtistProfile 캐시 DB ops — 아티스트 소개 팝업(bio/이미지/장르)."""
from __future__ import annotations

import psycopg


def get_artist_profile(conn: psycopg.Connection, name_normalized: str) -> dict | None:
    """nameNormalized로 캐시된 프로필. 없으면 None."""
    with conn.cursor() as cur:
        cur.execute(
            'SELECT "nameNormalized", name, bio, "imageUrl", genres '
            'FROM "ArtistProfile" WHERE "nameNormalized" = %s',
            (name_normalized,),
        )
        r = cur.fetchone()
    if not r:
        return None
    return {
        "name_normalized": r[0], "name": r[1], "bio": r[2],
        "image_url": r[3], "genres": list(r[4] or []),
    }


def upsert_artist_profile(
    conn: psycopg.Connection, name_normalized: str, name: str,
    bio: str | None, image_url: str | None, genres: list[str],
) -> None:
    """프로필 캐시 저장(replace). 자체 commit."""
    with conn.cursor() as cur:
        cur.execute(
            '''INSERT INTO "ArtistProfile"
                 ("nameNormalized", name, bio, "imageUrl", genres, "fetchedAt")
               VALUES (%s, %s, %s, %s, %s, NOW())
               ON CONFLICT ("nameNormalized") DO UPDATE SET
                 name = EXCLUDED.name, bio = EXCLUDED.bio,
                 "imageUrl" = EXCLUDED."imageUrl", genres = EXCLUDED.genres,
                 "fetchedAt" = NOW()''',
            (name_normalized, name, bio, image_url, genres),
        )
    conn.commit()
