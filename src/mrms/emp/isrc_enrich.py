"""EMP 합성-ISRC 트랙을 Deezer로 real ISRC 역해결 → 카탈로그 머지 / re-key.

합성 ISRC(`emp_*`, `{platform}_*` 등 언더스코어 포함)는 임포터가 real ISRC를
못 받아 생긴 placeholder. 같은 곡이 카탈로그에 real-ISRC로 이미 있으면 머지하고,
신곡이면 isrc를 real로 갱신해 02(ISRC 정밀)→03→10 임베딩 파이프라인에 태운다.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

import httpx
import psycopg

from mrms.ingest import deezer


@dataclass(slots=True)
class SyntheticTrack:
    track_id: str
    isrc: str
    title: str
    artist: str


def fetch_synthetic_emp_tracks(
    conn: psycopg.Connection, limit: int = 0
) -> list[SyntheticTrack]:
    """inEmp=TRUE & 합성 ISRC(언더스코어 포함) & 미임베딩 트랙. createdAt DESC."""
    sql = '''
        SELECT t.id, t.isrc, t.title, ar.name
        FROM "Track" t
        JOIN "Artist" ar ON ar.id = t."artistId"
        WHERE t."inEmp" = TRUE
          AND t.isrc LIKE %s ESCAPE '!'
          AND NOT EXISTS (
            SELECT 1 FROM "TrackEmbedding" te WHERE te."trackId" = t.id
          )
        ORDER BY t."createdAt" DESC
    '''
    params: list = ['%!_%']  # '!' escape → 리터럴 언더스코어 매칭
    if limit:
        sql += " LIMIT %s"
        params.append(limit)
    with conn.cursor() as cur:
        cur.execute(sql, params)
        return [
            SyntheticTrack(track_id=r[0], isrc=r[1], title=r[2] or "", artist=r[3] or "")
            for r in cur.fetchall()
        ]


_PAREN = re.compile(r"\([^)]*\)|\[[^\]]*\]")
_KEEP = re.compile(r"[^a-z0-9가-힣]+")


def _norm(s: str) -> str:
    """소문자 + 괄호내용 제거 + 영숫자/한글만 + 공백정규화."""
    s = (s or "").lower()
    s = _PAREN.sub(" ", s)
    s = _KEEP.sub(" ", s)
    return " ".join(s.split())


def _first_artist(a: str) -> str:
    """대표 아티스트 1명 — 콤마/&/feat 앞부분."""
    a = (a or "").lower()
    for sep in (",", "&", " feat", " ft", " with "):
        a = a.split(sep)[0]
    return a


def is_confident_match(
    orig_title: str, orig_artist: str, cand_title: str, cand_artist: str
) -> bool:
    """오매칭 차단 게이트: artist 정규화 일치(필수) + title 정규화 포함관계."""
    if _norm(_first_artist(orig_artist)) != _norm(_first_artist(cand_artist)):
        return False
    ot, ct = _norm(orig_title), _norm(cand_title)
    if not ot or not ct:
        return False
    return ot == ct or ot in ct or ct in ot


async def resolve_real_isrc(
    client: httpx.AsyncClient | None, title: str, artist: str
) -> str | None:
    """Deezer 텍스트 검색 → confident하면 real ISRC, 아니면 None.

    Deezer 응답은 isrc+preview를 함께 담음(deezer.py). iTunes는 ISRC를 안 줘서 미사용.
    """
    dz = await deezer.search_by_text(client, title, artist)
    if not dz:
        return None
    real = dz.get("isrc")
    if not real:
        return None
    if not is_confident_match(title, artist, dz.get("title") or "", dz.get("artist") or ""):
        return None
    return real


def find_canonical(
    conn: psycopg.Connection, real_isrc: str, exclude_id: str
) -> str | None:
    """real_isrc를 가진 다른 Track(자기 자신 제외) id. 없으면 None."""
    with conn.cursor() as cur:
        cur.execute(
            'SELECT id FROM "Track" WHERE isrc = %s AND id <> %s LIMIT 1',
            (real_isrc, exclude_id),
        )
        row = cur.fetchone()
    return row[0] if row else None


# (table, [trackId 외 unique 컬럼]) — 충돌 판정용. 스펙 §5에서 DB 확인됨.
# DB의 information_schema 기준 Track을 참조하는 FK 테이블 전부(6개).
# TrackLyrics/TrackInteraction은 schema.prisma엔 onDelete:Cascade로 선언돼 있으나
# 아직 테이블이 생성(마이그레이션)돼 있지 않아 제외 — 둘 다 미사용(ADR-003). 해당
# 테이블이 materialize되면(특히 TrackInteraction 행동신호) 여기 추가해 repoint할 것.
_MERGE_TABLES: list[tuple[str, list[str]]] = [
    ("TrackPlatform", ["platform"]),
    ("EMPSource", ["platform", "source_id"]),
    ("UserTrack", ["userId"]),
    ("PlaylistTrack", ["playlistId"]),
    ("TrackAudioFeatures", ["modelVersion"]),
    ("TrackEmbedding", ["modelVersion"]),
]


def _repoint_or_drop(
    conn: psycopg.Connection, table: str, other_cols: list[str],
    synth_id: str, canonical_id: str,
) -> None:
    """synth의 행을 canonical로 이동. canonical이 같은 unique 키를 이미 가지면 drop."""
    not_exists = " AND ".join(f'c."{col}" = s."{col}"' for col in other_cols)
    with conn.cursor() as cur:
        cur.execute(
            f'''UPDATE "{table}" s SET "trackId" = %(canon)s
                WHERE s."trackId" = %(synth)s
                  AND NOT EXISTS (
                    SELECT 1 FROM "{table}" c
                    WHERE c."trackId" = %(canon)s AND {not_exists}
                  )''',  # table/cols는 상수 _MERGE_TABLES 출처, 값은 bound
            {"canon": canonical_id, "synth": synth_id},
        )
        cur.execute(f'DELETE FROM "{table}" WHERE "trackId" = %s', (synth_id,))


def merge_track(
    conn: psycopg.Connection, synth_id: str, canonical_id: str
) -> None:
    """합성 Track의 모든 참조를 canonical로 옮기고 합성 Track 삭제 (트랜잭션 1건).

    FK가 전부 CASCADE라 삭제 전 repoint 필수. canonical의 임베딩은 그대로 유지돼
    합성 트랙이 추천에서 canonical로 흡수된다.
    """
    for table, other_cols in _MERGE_TABLES:
        _repoint_or_drop(conn, table, other_cols, synth_id, canonical_id)
    with conn.cursor() as cur:
        # PlaylistHistory.trackIds (배열, 비-FK): dangling 방지
        cur.execute(
            '''UPDATE "PlaylistHistory"
               SET "trackIds" = array_replace("trackIds", %s, %s)
               WHERE %s = ANY("trackIds")''',
            (synth_id, canonical_id, synth_id),
        )
        cur.execute('DELETE FROM "Track" WHERE id = %s', (synth_id,))
    conn.commit()
