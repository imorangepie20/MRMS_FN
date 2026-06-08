"""JSON:API (jsonapi.org) 응답 평탄화 헬퍼.

Tidal v2 API가 사용. data + included + relationships 구조를 우리가 쓰기 좋은 평탄 dict 리스트로 변환.
"""
from __future__ import annotations

from typing import Any
from urllib.parse import parse_qs, urlparse


def flatten_jsonapi(
    response: dict[str, Any],
    focus_type: str | None = None,
) -> list[dict[str, Any]]:
    """JSON:API 응답을 [{ id, type, ...attributes }] 리스트로 변환.

    data는 list(컬렉션) 또는 dict(단일 리소스) 모두 허용.
    Dedup key: (type, id) 튜플 — JSON:API ID는 type 안에서만 unique.
    처리 순서: data → included. 같은 (type, id) 다시 만나면 새 attributes로 머지
    (included가 보통 더 풍부한 attributes를 가지므로 후순위 우선 패턴이 자연스럽게 동작).
    type 또는 id 없는 entry는 무시.
    focus_type 지정시 해당 type만 반환.
    """
    items: dict[tuple[str, str], dict[str, Any]] = {}
    raw_data = response.get("data")
    # JSON:API: data는 컬렉션이면 list, 단일 리소스면 dict.
    data_list: list = []
    if isinstance(raw_data, list):
        data_list = raw_data
    elif isinstance(raw_data, dict):
        data_list = [raw_data]
    sources = data_list + (response.get("included") or [])
    for entry in sources:
        if not entry:
            continue
        etype = entry.get("type")
        eid = entry.get("id")
        if etype is None or eid is None:
            continue
        if focus_type and etype != focus_type:
            continue
        attrs = entry.get("attributes") or {}
        key = (etype, eid)
        merged = items.get(key, {})
        items[key] = {
            "id": eid,
            "type": etype,
            **merged,
            **attrs,
        }
    return list(items.values())


def get_next_cursor(response: dict[str, Any]) -> str | None:
    """JSON:API 응답의 links.next에서 page[cursor] 값 추출."""
    next_link = (response.get("links") or {}).get("next")
    if not next_link:
        return None
    qs = parse_qs(urlparse(next_link).query)
    return qs.get("page[cursor]", [None])[0]
