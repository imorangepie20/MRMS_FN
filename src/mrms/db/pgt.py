"""PGT 섹션 파생 쿼리 — UserTrack 위의 필터/그룹핑."""
from __future__ import annotations

import psycopg

_TRACK_COLS = '''t.id, t.title, a.name AS artist, al.id, al.title,
                 tp_t."platformTrackId", tp_s."platformTrackId", t."durationMs"'''
_TRACK_JOINS = '''FROM "UserTrack" ut
                  JOIN "Track" t ON t.id = ut."trackId"
                  JOIN "Artist" a ON a.id = t."artistId"
                  LEFT JOIN "Album" al ON al.id = t."albumId"
                  LEFT JOIN "TrackPlatform" tp_t ON tp_t."trackId"=t.id AND tp_t.platform='tidal'
                  LEFT JOIN "TrackPlatform" tp_s ON tp_s."trackId"=t.id AND tp_s.platform='spotify' '''


def _rows_to_tracks(rows) -> list[dict]:
    return [{"track_id": r[0], "title": r[1], "artist": r[2], "album_id": r[3],
             "album_title": r[4], "album_cover": None,  # get_playlist_tracks와 동일 shape
             "tidal_track_id": r[5], "spotify_track_id": r[6],
             "duration_ms": r[7]} for r in rows]


def _track_section(conn, user_id, where_extra, params) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute(f'SELECT {_TRACK_COLS} {_TRACK_JOINS} WHERE ut."userId"=%s {where_extra} ORDER BY ut."addedAt" DESC',
                    (user_id, *params))
        return _rows_to_tracks(cur.fetchall())


def section_liked(conn: psycopg.Connection, user_id: str) -> list[dict]:
    return _track_section(conn, user_id, "AND ut.source='liked'", ())


def section_pct(conn: psycopg.Connection, user_id: str) -> list[dict]:
    return _track_section(conn, user_id, 'AND ut."isCore"=TRUE', ())


def section_albums(conn: psycopg.Connection, user_id: str) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute('''SELECT al.id, al.title, a.name AS artist, COUNT(*) AS track_count
                       FROM "UserTrack" ut
                       JOIN "Track" t ON t.id=ut."trackId"
                       JOIN "Album" al ON al.id=t."albumId"
                       JOIN "Artist" a ON a.id=al."artistId"
                       WHERE ut."userId"=%s GROUP BY al.id, al.title, a.name
                       ORDER BY track_count DESC''', (user_id,))
        return [{"album_id": r[0], "title": r[1], "artist": r[2], "track_count": r[3]}
                for r in cur.fetchall()]


def section_artists(conn: psycopg.Connection, user_id: str) -> list[dict]:
    with conn.cursor() as cur:
        cur.execute('''SELECT a.id, a.name, COUNT(*) AS track_count
                       FROM "UserTrack" ut
                       JOIN "Track" t ON t.id=ut."trackId"
                       JOIN "Artist" a ON a.id=t."artistId"
                       WHERE ut."userId"=%s GROUP BY a.id, a.name
                       ORDER BY track_count DESC''', (user_id,))
        return [{"artist_id": r[0], "name": r[1], "track_count": r[2]} for r in cur.fetchall()]


def section_imported_playlists(conn: psycopg.Connection, user_id: str) -> list[dict]:
    """source LIKE 'playlist%' 그룹. 'playlist:이름'→이름, 'playlist'→'Imported'."""
    with conn.cursor() as cur:
        cur.execute('''SELECT ut.source, COUNT(*) FROM "UserTrack" ut
                       WHERE ut."userId"=%s AND ut.source LIKE 'playlist%%'
                       GROUP BY ut.source ORDER BY 2 DESC''', (user_id,))
        out = []
        for source, cnt in cur.fetchall():
            name = source.split(":", 1)[1] if ":" in source else "Imported"
            out.append({"source": source, "name": name, "track_count": cnt})
        return out


def album_tracks(conn: psycopg.Connection, user_id: str, album_id: str) -> list[dict]:
    return _track_section(conn, user_id, 'AND t."albumId"=%s', (album_id,))


def artist_tracks(conn: psycopg.Connection, user_id: str, artist_id: str) -> list[dict]:
    return _track_section(conn, user_id, 'AND t."artistId"=%s', (artist_id,))


def imported_playlist_tracks(conn: psycopg.Connection, user_id: str, source: str) -> list[dict]:
    return _track_section(conn, user_id, "AND ut.source=%s", (source,))
