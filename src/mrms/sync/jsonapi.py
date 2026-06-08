"""JSON:API (jsonapi.org) 응답 평탄화 헬퍼.

Tidal v2 API가 사용. data + included + relationships 구조를 우리가 쓰기 좋은 평탄 dict 리스트로 변환.
"""
from __future__ import annotations

from urllib.parse import parse_qs, urlparse


def flatten_jsonapi(
    response: dict,
    focus_type: str | None = None,
) -> list[dict]:
    """JSON:API 응답을 [{ id, type, ...attributes }] 리스트로 변환.

    data + included 통합 후 ID 기준 dedup. included가 더 풍부한 attributes를 가지면 우선.
    focus_type 지정시 해당 type만 반환.
    """
    items: dict[str, dict] = {}
    sources = (response.get("data") or []) + (response.get("included") or [])
    for entry in sources:
        if not entry:
            continue
        if focus_type and entry.get("type") != focus_type:
            continue
        eid = entry.get("id")
        if eid is None:
            continue
        attrs = entry.get("attributes") or {}
        merged = items.get(eid, {})
        items[eid] = {
            "id": eid,
            "type": entry["type"],
            **merged,
            **attrs,
        }
    return list(items.values())


def get_next_cursor(response: dict) -> str | None:
    """JSON:API 응답의 links.next에서 page[cursor] 값 추출."""
    next_link = (response.get("links") or {}).get("next")
    if not next_link:
        return None
    qs = parse_qs(urlparse(next_link).query)
    return qs.get("page[cursor]", [None])[0]
