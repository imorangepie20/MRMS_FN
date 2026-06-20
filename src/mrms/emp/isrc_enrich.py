"""EMP 합성-ISRC 트랙을 Deezer로 real ISRC 역해결 → 카탈로그 머지 / re-key.

합성 ISRC(`emp_*`, `{platform}_*` 등 언더스코어 포함)는 임포터가 real ISRC를
못 받아 생긴 placeholder. 같은 곡이 카탈로그에 real-ISRC로 이미 있으면 머지하고,
신곡이면 isrc를 real로 갱신해 02(ISRC 정밀)→03→10 임베딩 파이프라인에 태운다.
"""
from __future__ import annotations

import re
from dataclasses import dataclass

import psycopg


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
