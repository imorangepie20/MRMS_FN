from __future__ import annotations

import httpx
import respx

from mrms.search.tidal_artist import _strip_tidal_markup, fetch_tidal_artist


def test_strip_tidal_markup_wimplink():
    src = '[wimpLink artistId="4288"]Bing Crosby[/wimpLink] is great'
    assert _strip_tidal_markup(src) == "Bing Crosby is great"


def test_strip_tidal_markup_album_track_video():
    src = (
        'See [album albumId="1"]Blue Train[/album] and '
        '[track trackId="2"]Moment[/track] and [video videoId="3"]Clip[/video].'
    )
    assert _strip_tidal_markup(src) == "See Blue Train and Moment and Clip."


def test_strip_tidal_markup_keeps_plain_brackets():
    # 알려진 태그명이 아닌 일반 대괄호 텍스트는 보존
    src = "Released in 1957 [remastered] edition."
    assert _strip_tidal_markup(src) == "Released in 1957 [remastered] edition."


def test_strip_tidal_markup_preserves_paragraphs():
    # 문단 구분 줄바꿈은 보존(프론트 whitespace-pre-line 의도와 일치),
    # 줄 안의 연속 공백/탭만 한 칸으로 접는다.
    src = "Para  one\there.\n\n\nPara two."
    assert _strip_tidal_markup(src) == "Para one here.\n\nPara two."


@respx.mock
async def test_fetch_tidal_artist_200():
    respx.post("https://auth.tidal.com/v1/oauth2/token").mock(
        return_value=httpx.Response(200, json={"access_token": "T"}))
    respx.get(url__startswith="https://api.tidal.com/v1/search").mock(
        return_value=httpx.Response(200, json={"artists": {"items": [
            {"id": 42, "name": "Bing Crosby",
             "picture": "abcd1234-ef56-7890-abcd-ef1234567890"}]}}))
    respx.get(url__startswith="https://api.tidal.com/v1/artists/42/bio").mock(
        return_value=httpx.Response(200, json={
            "source": "TiVo", "lastUpdated": "x",
            "text": '[wimpLink artistId="4288"]Bing Crosby[/wimpLink] is great',
            "summary": "short"}))
    async with httpx.AsyncClient() as h:
        image, bio_full = await fetch_tidal_artist(h, "Bing Crosby")
    assert image == (
        "https://resources.tidal.com/images/"
        "abcd1234/ef56/7890/abcd/ef1234567890/750x750.jpg"
    )
    assert bio_full == "Bing Crosby is great"


@respx.mock
async def test_fetch_tidal_artist_bio_404():
    respx.post("https://auth.tidal.com/v1/oauth2/token").mock(
        return_value=httpx.Response(200, json={"access_token": "T"}))
    respx.get(url__startswith="https://api.tidal.com/v1/search").mock(
        return_value=httpx.Response(200, json={"artists": {"items": [
            {"id": 7, "name": "Nobody",
             "picture": "11112222-3333-4444-5555-666677778888"}]}}))
    respx.get(url__startswith="https://api.tidal.com/v1/artists/7/bio").mock(
        return_value=httpx.Response(404, json={"status": 404}))
    async with httpx.AsyncClient() as h:
        image, bio_full = await fetch_tidal_artist(h, "Nobody")
    assert image == (
        "https://resources.tidal.com/images/"
        "11112222/3333/4444/5555/666677778888/750x750.jpg"
    )
    assert bio_full is None


@respx.mock
async def test_fetch_tidal_artist_no_match():
    respx.post("https://auth.tidal.com/v1/oauth2/token").mock(
        return_value=httpx.Response(200, json={"access_token": "T"}))
    respx.get(url__startswith="https://api.tidal.com/v1/search").mock(
        return_value=httpx.Response(200, json={"artists": {"items": []}}))
    async with httpx.AsyncClient() as h:
        image, bio_full = await fetch_tidal_artist(h, "Ghost")
    assert image is None and bio_full is None


@respx.mock
async def test_fetch_tidal_artist_name_mismatch_rejected():
    # limit=1 첫 결과 이름이 쿼리와 불일치 → 다른 아티스트의 bio/이미지를
    # 채택·캐시하지 않도록 거부(Spotify 가드와 동일). bio는 조회조차 안 함.
    respx.post("https://auth.tidal.com/v1/oauth2/token").mock(
        return_value=httpx.Response(200, json={"access_token": "T"}))
    respx.get(url__startswith="https://api.tidal.com/v1/search").mock(
        return_value=httpx.Response(200, json={"artists": {"items": [
            {"id": 1, "name": "Some Other Artist",
             "picture": "abcd1234-ef56-7890-abcd-ef1234567890"}]}}))
    bio_route = respx.get(
        url__startswith="https://api.tidal.com/v1/artists/1/bio").mock(
        return_value=httpx.Response(200, json={"text": "should not be fetched"}))
    async with httpx.AsyncClient() as h:
        image, bio_full = await fetch_tidal_artist(h, "Requested Name")
    assert image is None and bio_full is None
    assert not bio_route.called


@respx.mock
async def test_fetch_tidal_artist_name_match_case_insensitive():
    # 대소문자/공백만 다른 경우는 정규화상 일치로 채택.
    respx.post("https://auth.tidal.com/v1/oauth2/token").mock(
        return_value=httpx.Response(200, json={"access_token": "T"}))
    respx.get(url__startswith="https://api.tidal.com/v1/search").mock(
        return_value=httpx.Response(200, json={"artists": {"items": [
            {"id": 5, "name": "  Bing Crosby  ",
             "picture": "abcd1234-ef56-7890-abcd-ef1234567890"}]}}))
    respx.get(url__startswith="https://api.tidal.com/v1/artists/5/bio").mock(
        return_value=httpx.Response(200, json={"text": "A legend."}))
    async with httpx.AsyncClient() as h:
        image, bio_full = await fetch_tidal_artist(h, "bing crosby")
    assert image == (
        "https://resources.tidal.com/images/"
        "abcd1234/ef56/7890/abcd/ef1234567890/750x750.jpg"
    )
    assert bio_full == "A legend."
