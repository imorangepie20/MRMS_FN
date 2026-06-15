"""EMP-밖 추천 discovery — 취향 시드 → Gemini 제안 → ytmusicapi 해석 → EMPSource 적재.

전부 SYNC (generate_user_mrt 배치 컨벤션). discovery는 EMPSource(source_type='discovery',
source_id='discovery:{user_id}')에만 적재하고, 요청 시 read_discovery로 읽어 50/50 블렌드.
"""
from __future__ import annotations

import logging

log = logging.getLogger(__name__)


def blend_recsys(
    taste_ids: list[str], discovery_ids: list[str], n: int
) -> list[str]:
    """taste(EMP) / discovery(EMP 밖) track_id를 50/50 교차로 합쳐 최대 n개.

    taste 먼저 시작, 한 쪽이 비면 나머지를 채운다. track_id 정확 매칭으로 dedup."""
    out: list[str] = []
    seen: set[str] = set()
    ti = di = 0
    turn = 0  # 짝수=taste, 홀수=discovery
    while len(out) < n and (ti < len(taste_ids) or di < len(discovery_ids)):
        use_taste = turn % 2 == 0
        if use_taste and ti >= len(taste_ids):
            use_taste = False
        elif not use_taste and di >= len(discovery_ids):
            use_taste = True
        if use_taste and ti < len(taste_ids):
            tid = taste_ids[ti]
            ti += 1
            if tid not in seen:
                seen.add(tid)
                out.append(tid)
                turn += 1
        elif not use_taste and di < len(discovery_ids):
            tid = discovery_ids[di]
            di += 1
            if tid not in seen:
                seen.add(tid)
                out.append(tid)
                turn += 1
    return out
