"""JSON:API 헬퍼 테스트."""
from mrms.sync.jsonapi import flatten_jsonapi, get_next_cursor


def test_flatten_data_only():
    response = {
        "data": [
            {"id": "1", "type": "tracks", "attributes": {"isrc": "AAA", "title": "T1"}},
            {"id": "2", "type": "tracks", "attributes": {"isrc": "BBB", "title": "T2"}},
        ]
    }
    result = flatten_jsonapi(response)
    assert len(result) == 2
    assert result[0] == {"id": "1", "type": "tracks", "isrc": "AAA", "title": "T1"}


def test_flatten_dedupes_data_and_included():
    """Tidal collection 패턴: data에 relationship 레코드, included에 실제 attributes."""
    response = {
        "data": [
            {"id": "1", "type": "tracks", "attributes": {}},  # relationship only
        ],
        "included": [
            {"id": "1", "type": "tracks", "attributes": {"isrc": "AAA", "title": "T1"}},
        ],
    }
    result = flatten_jsonapi(response)
    assert len(result) == 1
    assert result[0]["isrc"] == "AAA"  # included의 attributes가 우선


def test_flatten_filter_by_type():
    response = {
        "data": [
            {"id": "1", "type": "tracks", "attributes": {"isrc": "AAA"}},
            {"id": "p1", "type": "playlists", "attributes": {"title": "PL1"}},
        ]
    }
    result = flatten_jsonapi(response, focus_type="tracks")
    assert len(result) == 1
    assert result[0]["type"] == "tracks"


def test_flatten_empty():
    assert flatten_jsonapi({}) == []
    assert flatten_jsonapi({"data": [], "included": []}) == []


def test_get_next_cursor_present():
    response = {
        "links": {"next": "https://api.tidal.com/v2/x?page%5Bcursor%5D=abc123&other=1"}
    }
    assert get_next_cursor(response) == "abc123"


def test_get_next_cursor_absent():
    assert get_next_cursor({}) is None
    assert get_next_cursor({"links": {}}) is None
    assert get_next_cursor({"links": {"next": None}}) is None


def test_flatten_same_id_different_type():
    """JSON:API: ID는 type 안에서만 unique. 같은 ID 다른 type은 별개 자원."""
    response = {
        "data": [
            {"id": "1", "type": "tracks", "attributes": {"isrc": "AAA"}},
            {"id": "1", "type": "artists", "attributes": {"name": "ArtistX"}},
        ]
    }
    result = flatten_jsonapi(response)
    assert len(result) == 2
    by_type = {r["type"]: r for r in result}
    assert by_type["tracks"]["isrc"] == "AAA"
    assert by_type["artists"]["name"] == "ArtistX"


def test_flatten_skips_entry_without_type():
    """type 누락된 entry는 skip (id만 있어도 무시)."""
    response = {
        "data": [
            {"id": "1", "attributes": {"isrc": "AAA"}},  # no type
            {"id": "2", "type": "tracks", "attributes": {"isrc": "BBB"}},
        ]
    }
    result = flatten_jsonapi(response)
    assert len(result) == 1
    assert result[0]["isrc"] == "BBB"
