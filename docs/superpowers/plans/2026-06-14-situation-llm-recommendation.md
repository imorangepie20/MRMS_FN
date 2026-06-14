# situation desk Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사용자가 자유 텍스트로 상황을 적으면 Gemini가 해석해 피처 중심점+가중치를 산출하고, 기존 wellness 엔진으로 그 장면에 맞는 곡 20개를 추천하는 별도 페이지(`/situation`).

**Architecture:** wellness 엔진을 `recommend_by_preset(preset)`로 일반화하고, 그 위에 LLM(Gemini, `google-genai`, 구조화 출력) 해석 모듈을 얹는다. 백엔드-퍼스트: config → 엔진 일반화 → LLM 모듈 → API → 프론트.

**Tech Stack:** Python/FastAPI, psycopg, pydantic, `google-genai`(Gemini 2.5 Flash), Next.js/React/TS.

---

## ⚠️ 실행 전 필수 주의

- **전체 `pytest tests/` 금지** — dev DB의 tidal 토큰을 오염시킨다. 항상 **해당 파일만** 실행: `.venv/bin/pytest tests/<path> -v`.
- 통합 테스트는 dev DB에 직접 돈다(cleanup fixture가 역순 정리). `db_conn`/`cleanup`(recsys), `login`(api) fixture 재사용.
- 모든 명령은 `cd "/Volumes/MacExtend 1/MRMS_FN"` 기준. 파이썬은 `.venv/bin/python` / `.venv/bin/pytest`.
- 커밋 메시지는 한국어 + `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` 마지막 줄.

## File Structure

| 파일 | 책임 | 작업 |
|---|---|---|
| `src/mrms/config.py` | 설정 | 수정: `gemini_api_key`, `gemini_model` 추가 |
| `pyproject.toml` | 의존성 | 수정: `google-genai` 추가 |
| `src/mrms/recsys/wellness.py` | 추천 엔진 | 수정: `recommend_by_preset` 추출 + `recommend_wellness` 래퍼화 |
| `src/mrms/llm/__init__.py` | 패키지 | 생성(빈 파일) |
| `src/mrms/llm/situation.py` | LLM 해석 | 생성: 스키마·프롬프트·`build_preset`·`interpret_situation` |
| `src/mrms/api/situation.py` | API | 생성: `POST /api/situation/recommendations` |
| `src/mrms/api/main.py` | 라우터 등록 | 수정: situation 라우터 include |
| `web/src/lib/types.ts` | 타입 | 수정: `SituationFeatures`·`SituationResponse` |
| `web/src/lib/api/situation.ts` | API 클라 | 생성: `fetchSituation` |
| `web/src/app/(dashboard)/situation/page.tsx` | 페이지 | 생성 |
| `web/src/lib/nav.ts` | 내비 | 수정: Discover에 Situation 항목 |
| `tests/recsys/test_wellness.py` | 테스트 | 수정: `recommend_by_preset` 테스트 추가 |
| `tests/llm/test_situation.py` | 테스트 | 생성 |
| `tests/api/test_situation.py` | 테스트 | 생성 |

---

### Task 1: config에 Gemini 설정 추가

**Files:**
- Modify: `src/mrms/config.py`
- Test: `tests/test_config_situation.py`

- [ ] **Step 1: Write the failing test**

Create `tests/test_config_situation.py`:

```python
from __future__ import annotations

from mrms.config import settings


def test_gemini_model_default():
    assert settings.gemini_model == "gemini-2.5-flash"


def test_gemini_api_key_field_exists():
    # 필드 존재만 확인 (.env 값 유무와 무관)
    assert hasattr(settings, "gemini_api_key")
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/test_config_situation.py -v`
Expected: FAIL (`AttributeError: 'Settings' object has no attribute 'gemini_model'`)

- [ ] **Step 3: Add the settings fields**

In `src/mrms/config.py`, inside `class Settings`, add after the `tidal_scopes` block (the `# ─── API credentials ───` section):

```python
    # ─── Gemini (situation desk LLM) ─────────────────
    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/test_config_situation.py -v`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
git add src/mrms/config.py tests/test_config_situation.py
git commit -m "feat(situation): config에 GEMINI_API_KEY·gemini_model 추가

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: google-genai 의존성 추가

**Files:**
- Modify: `pyproject.toml`

- [ ] **Step 1: Add the dependency**

In `pyproject.toml`, in the `dependencies` list under the `# API clients` comment block, add a line after `"httpx>=0.27",`:

```toml
    "google-genai>=1.0",
```

- [ ] **Step 2: Install it**

Run: `.venv/bin/pip install "google-genai>=1.0"`
Expected: `Successfully installed google-genai-...`

- [ ] **Step 3: Verify the import works**

Run: `.venv/bin/python -c "from google import genai; from google.genai import types; print('genai ok')"`
Expected: `genai ok`

- [ ] **Step 4: Commit**

```bash
git add pyproject.toml
git commit -m "feat(situation): google-genai 의존성 추가 (Gemini)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: wellness 엔진 일반화 — recommend_by_preset

**Files:**
- Modify: `src/mrms/recsys/wellness.py:56-129`
- Test: `tests/recsys/test_wellness.py`

`recommend_wellness`의 본체를 `recommend_by_preset(conn, user_id, preset, n)`로 추출하고, `recommend_wellness`는 `MOOD_PRESETS[mood]`를 꺼내 호출하는 래퍼로 만든다. 기존 테스트는 무변경 통과해야 한다(회귀).

- [ ] **Step 1: Write the failing test**

Append to `tests/recsys/test_wellness.py` (uses existing `_seed_track`, `db_conn`, `cleanup`, `get_or_create_user`):

```python
from mrms.recsys.wellness import recommend_by_preset

# 보컬 위주 임의 preset (LLM 산출 형태): {축:(center, sigma, weight)}
VOCAL_PRESET = {
    "valence": (0.55, 0.18, 1.0),
    "energy": (0.55, 0.18, 1.0),
    "tempo": (115.0, 28.0, 0.5),
    "acousticness": (0.30, 0.25, 0.4),
    "instrumentalness": (0.10, 0.30, 1.0),
}


def test_recommend_by_preset_orders_by_fit(db_conn, cleanup):
    user_id = get_or_create_user(db_conn, f"sit_{uuid.uuid4().hex[:8]}@t.local")
    cleanup('DELETE FROM "User" WHERE id = %s', (user_id,))
    near = _seed_track(db_conn, cleanup, valence=0.55, energy=0.55, tempo=115.0,
                       acousticness=0.30, instrumentalness=0.10, title="VocalNear")
    far = _seed_track(db_conn, cleanup, valence=0.05, energy=0.95, tempo=180.0,
                      acousticness=0.95, instrumentalness=0.95, title="VocalFar")
    recs = recommend_by_preset(db_conn, user_id, VOCAL_PRESET, n=500000)
    ids = [r["track_id"] for r in recs]
    assert near in ids and far in ids
    assert ids.index(near) < ids.index(far)
    assert all("score" in r and "mood_fit" in r for r in recs)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/recsys/test_wellness.py::test_recommend_by_preset_orders_by_fit -v`
Expected: FAIL (`ImportError: cannot import name 'recommend_by_preset'`)

- [ ] **Step 3: Refactor `recommend_wellness` into `recommend_by_preset` + wrapper**

In `src/mrms/recsys/wellness.py`, replace the entire `recommend_wellness` function (lines 56–129) with:

```python
def recommend_by_preset(
    conn: psycopg.Connection,
    user_id: str,
    preset: dict[str, tuple[float, float, float]],
    n: int = 20,
) -> list[dict[str, Any]]:
    """소프트 무드 적합(preset) × 취향(UserEmbedding cosine) 결합 top-n. 학습 없음.

    preset = {축: (center, sigma, weight)} (= MOOD_PRESETS[mood] 형태).
    UserEmbedding 있으면 score=W_MOOD·mood_fit+W_TASTE·taste_sim, 없으면 mood_fit만.
    제외: UserTrack 보유 + UserBlocked disliked(track+album). 후보=임베딩∩피처 전 카탈로그.

    SELECT column order:
      0=t.id, 1=title, 2=artist, 3=albumId,
      4=valence, 5=energy, 6=tempo,
      7=mood_fit, 8=tidal_id, 9=spotify_id, 10=taste_sim
    """
    _ensure_vector_registered(conn)
    fit_sql = _mood_fit_sql(preset)
    ue = fetch_user_embedding(conn, user_id, USER_MV)

    exclude = '''
      t.id NOT IN (SELECT "trackId" FROM "UserTrack" WHERE "userId" = %(uid)s)
      AND t.id NOT IN (
        SELECT "targetId" FROM "UserBlocked"
          WHERE "userId" = %(uid)s AND "targetType" = 'track' AND reason = 'disliked'
        UNION
        SELECT tt.id FROM "Track" tt JOIN "UserBlocked" ub
          ON ub."targetId" = tt."albumId" AND ub."targetType" = 'album'
          WHERE ub."userId" = %(uid)s AND ub.reason = 'disliked'
      )'''
    # Columns 0-9 from select_cols, then taste_sim appended as column 10
    select_cols = f'''
        t.id, t.title, ar.name AS artist, t."albumId",
        taf.valence, taf.energy, taf.tempo,
        {fit_sql} AS mood_fit,
        tp_t."platformTrackId" AS tidal_id,
        tp_s."platformTrackId" AS spotify_id'''
    joins = '''
      FROM "TrackAudioFeatures" taf
      JOIN "Track"  t  ON t.id = taf."trackId"
      JOIN "Artist" ar ON ar.id = t."artistId"
      JOIN "TrackEmbedding" e ON e."trackId" = t.id AND e."modelVersion" = %(catmv)s
      LEFT JOIN "TrackPlatform" tp_t ON tp_t."trackId" = t.id AND tp_t.platform = 'tidal'
      LEFT JOIN "TrackPlatform" tp_s ON tp_s."trackId" = t.id AND tp_s.platform = 'spotify' '''
    params: dict[str, Any] = {"uid": user_id, "catmv": CATALOG_MV, "featmv": CATALOG_MV, "n": n}

    if ue is not None:
        params["uvec"] = np.asarray(ue["embedding"], dtype=np.float32)
        sql = f'''SELECT {select_cols}, 1 - (e.embedding <=> %(uvec)s) AS taste_sim {joins}
                  WHERE taf."modelVersion" = %(featmv)s AND {exclude}
                  ORDER BY ({W_MOOD} * ({fit_sql}) + {W_TASTE} * (1 - (e.embedding <=> %(uvec)s))) DESC
                  LIMIT %(n)s'''
    else:
        sql = f'''SELECT {select_cols}, NULL::double precision AS taste_sim {joins}
                  WHERE taf."modelVersion" = %(featmv)s AND {exclude}
                  ORDER BY ({fit_sql}) DESC
                  LIMIT %(n)s'''

    with conn.cursor() as cur:
        cur.execute(sql, params)
        rows = cur.fetchall()
    out = []
    for r in rows:
        # Indices: 0=id,1=title,2=artist,3=albumId,4=valence,5=energy,6=tempo,
        #          7=mood_fit, 8=tidal_id, 9=spotify_id, 10=taste_sim
        mf = float(r[7])
        ts = float(r[10]) if r[10] is not None else None
        score = (W_MOOD * mf + W_TASTE * ts) if ts is not None else mf
        out.append({
            "track_id": r[0], "title": r[1], "artist": r[2], "album_id": r[3],
            "valence": float(r[4]), "energy": float(r[5]), "tempo": float(r[6]),
            "mood_fit": mf, "taste_sim": ts, "score": score,
            "tidal_track_id": r[8], "spotify_track_id": r[9],
        })
    return out


def recommend_wellness(
    conn: psycopg.Connection, user_id: str, mood: str, n: int = 20
) -> list[dict[str, Any]]:
    """무드명 → MOOD_PRESETS preset → recommend_by_preset 위임. 알 수 없는 무드는 ValueError."""
    if mood not in MOOD_PRESETS:
        raise ValueError(f"unknown mood: {mood}")
    return recommend_by_preset(conn, user_id, MOOD_PRESETS[mood], n)
```

- [ ] **Step 4: Run the new test AND the full wellness regression**

Run: `.venv/bin/pytest tests/recsys/test_wellness.py -v`
Expected: PASS (all existing tests + `test_recommend_by_preset_orders_by_fit`)

- [ ] **Step 5: Commit**

```bash
git add src/mrms/recsys/wellness.py tests/recsys/test_wellness.py
git commit -m "refactor(situation): wellness 엔진 일반화 — recommend_by_preset 추출

recommend_wellness는 MOOD_PRESETS preset을 꺼내 호출하는 래퍼로. 회귀 없음.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: llm/situation.py — 스키마 + build_preset (순수)

**Files:**
- Create: `src/mrms/llm/__init__.py`
- Create: `src/mrms/llm/situation.py`
- Test: `tests/llm/test_situation.py`

- [ ] **Step 1: Write the failing test**

Create `tests/llm/test_situation.py`:

```python
from __future__ import annotations

from mrms.llm.situation import SituationInterpretation, build_preset


def _interp(**over) -> SituationInterpretation:
    base = dict(
        interpretation="차분한 아침", mood_label="calm morning",
        valence=0.5, energy=0.4, tempo_bpm=100.0, acousticness=0.5, instrumentalness=0.2,
        valence_weight=1.0, energy_weight=1.0, tempo_weight=0.5,
        acousticness_weight=0.5, instrumentalness_weight=1.0,
    )
    base.update(over)
    return SituationInterpretation(**base)


def test_build_preset_shape_and_sigma():
    p = build_preset(_interp())
    assert set(p) == {"valence", "energy", "tempo", "acousticness", "instrumentalness"}
    # 각 축은 (center, sigma, weight); tempo center는 BPM
    assert p["tempo"][0] == 100.0
    assert p["tempo"][1] == 28.0  # _DEFAULT_SIGMA["tempo"]
    assert p["valence"][1] == 0.18


def test_build_preset_clamps_out_of_range():
    p = build_preset(_interp(valence=1.7, energy=-0.3, tempo_bpm=9999.0,
                             instrumentalness_weight=5.0))
    assert p["valence"][0] == 1.0
    assert p["energy"][0] == 0.0
    assert p["tempo"][0] == 200.0           # tempo는 [40,200]
    assert p["instrumentalness"][2] == 1.0  # weight clamp


def test_build_preset_all_zero_weight_falls_back_to_uniform():
    p = build_preset(_interp(valence_weight=0, energy_weight=0, tempo_weight=0,
                             acousticness_weight=0, instrumentalness_weight=0))
    assert all(p[ax][2] == 1.0 for ax in p)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/llm/test_situation.py -v`
Expected: FAIL (`ModuleNotFoundError: No module named 'mrms.llm'`)

- [ ] **Step 3: Create the package + module**

Create `src/mrms/llm/__init__.py` (empty file):

```python
```

Create `src/mrms/llm/situation.py`:

```python
"""상황 자유텍스트 → Gemini 해석 → wellness preset. 웰니스 프레이밍(치료 표방 금지)."""
from __future__ import annotations

from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from mrms.config import settings


class SituationInterpretation(BaseModel):
    """Gemini 구조화 출력 스키마 — 피처 중심점 + 축별 가중치 + 한 줄 해석."""

    interpretation: str = Field(description="상황에 대한 한국어 한 줄 해석(사용자에게 보여줌)")
    mood_label: str = Field(description="짧은 무드 라벨 (예: '차분한 일요일 아침')")
    valence: float = Field(description="정서 밝기/긍정 0~1")
    energy: float = Field(description="에너지/강도 0~1")
    tempo_bpm: float = Field(description="템포 BPM (느림 60~80, 보통 90~120, 빠름 130~160)")
    acousticness: float = Field(description="어쿠스틱성 0~1")
    instrumentalness: float = Field(description="기악성(보컬 적음) 0~1")
    valence_weight: float = Field(description="이 상황에서 valence 중요도 0~1 (0=무시)")
    energy_weight: float = Field(description="energy 중요도 0~1")
    tempo_weight: float = Field(description="tempo 중요도 0~1")
    acousticness_weight: float = Field(description="acousticness 중요도 0~1")
    instrumentalness_weight: float = Field(description="instrumentalness 중요도 0~1")


class SituationLLMError(RuntimeError):
    """Gemini 호출/파싱 실패 — API에서 502로 매핑."""


# 축별 가우시안 폭(σ) — wellness MOOD_PRESETS 상수 재사용. LLM은 σ를 만지지 않는다.
_DEFAULT_SIGMA: dict[str, float] = {
    "valence": 0.18, "energy": 0.18, "tempo": 28.0,
    "acousticness": 0.25, "instrumentalness": 0.30,
}

_SITUATION_PROMPT = (
    "너는 음악 무드 해석기다. 사용자가 적은 '상황'을 읽고, 그 장면에 어울리는 음악을 "
    "valence(정서 밝기 0~1), energy(강도 0~1), tempo(BPM), acousticness(어쿠스틱성 0~1), "
    "instrumentalness(기악성 0~1)의 중심값과, 각 축이 이 상황에서 얼마나 중요한지(weight 0~1)로 매핑한다.\n"
    "규칙:\n"
    "- 기본은 '보컬 위주'. 대부분의 일상·사회·활동 상황은 instrumentalness 중심을 낮게(0.10~0.20) "
    "두되 weight는 유의미하게(보컬 곡이 나오도록). acousticness를 습관적으로 높이지 말 것('조용함'≠'어쿠스틱').\n"
    "- 명백히 기악/배경/집중·공부/수면/명상 상황일 때만 instrumentalness·acousticness의 center·weight를 올린다.\n"
    "- 상황과 무관한 축은 weight를 낮게/0으로 둔다.\n"
    "- interpretation은 한국어 한 줄, 따뜻하지만 과장 없이. 효능·치료(therapy)를 주장하지 말 것(웰니스/정서 조절만).\n"
    "- 음악과 무관하거나 유해·부적절한 입력은 모든 center를 0.5(tempo는 110)·weight를 균등하게 두고, "
    "그 사실을 interpretation에 자연스럽게 반영한다."
)


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, float(v)))


def build_preset(interp: SituationInterpretation) -> dict[str, tuple[float, float, float]]:
    """LLM 해석 → {축: (center, sigma, weight)}. center/weight 클램프, 전부-0 weight면 균등 폴백."""
    centers = {
        "valence": _clamp(interp.valence, 0.0, 1.0),
        "energy": _clamp(interp.energy, 0.0, 1.0),
        "tempo": _clamp(interp.tempo_bpm, 40.0, 200.0),
        "acousticness": _clamp(interp.acousticness, 0.0, 1.0),
        "instrumentalness": _clamp(interp.instrumentalness, 0.0, 1.0),
    }
    weights = {
        "valence": _clamp(interp.valence_weight, 0.0, 1.0),
        "energy": _clamp(interp.energy_weight, 0.0, 1.0),
        "tempo": _clamp(interp.tempo_weight, 0.0, 1.0),
        "acousticness": _clamp(interp.acousticness_weight, 0.0, 1.0),
        "instrumentalness": _clamp(interp.instrumentalness_weight, 0.0, 1.0),
    }
    if sum(weights.values()) == 0.0:
        weights = {k: 1.0 for k in weights}
    return {ax: (centers[ax], _DEFAULT_SIGMA[ax], weights[ax]) for ax in centers}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/llm/test_situation.py -v`
Expected: PASS (3 passed)

- [ ] **Step 5: Commit**

```bash
git add src/mrms/llm/__init__.py src/mrms/llm/situation.py tests/llm/test_situation.py
git commit -m "feat(situation): SituationInterpretation 스키마 + build_preset(클램프/폴백)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: llm/situation.py — interpret_situation (Gemini 호출)

**Files:**
- Modify: `src/mrms/llm/situation.py`
- Test: `tests/llm/test_situation.py`

`gemini-2.5-flash`는 기본 thinking이 켜져 있어 구조화 출력에서 `parsed=None`(thinking이 출력 토큰 소진)·지연 위험이 있다 → `thinking_budget=0`으로 끈다. 클라이언트는 주입 가능(`client=`)하게 해 테스트에서 mock.

- [ ] **Step 1: Write the failing test**

Append to `tests/llm/test_situation.py`:

```python
import pytest

from mrms.llm.situation import SituationLLMError, interpret_situation


class _FakeModels:
    def __init__(self, result):
        self._result = result  # SituationInterpretation-bearing resp, or Exception

    def generate_content(self, **kwargs):
        if isinstance(self._result, Exception):
            raise self._result
        return self._result


class _FakeResp:
    def __init__(self, parsed):
        self.parsed = parsed


class _FakeClient:
    def __init__(self, result):
        self.models = _FakeModels(result)


def test_interpret_situation_returns_parsed():
    interp = _interp(mood_label="rainy reading")
    client = _FakeClient(_FakeResp(interp))
    out = interpret_situation("비 오는 아침 독서", client=client)
    assert out.mood_label == "rainy reading"


def test_interpret_situation_none_parsed_raises():
    client = _FakeClient(_FakeResp(None))  # max_output_tokens 초과 등 → None
    with pytest.raises(SituationLLMError):
        interpret_situation("아무거나", client=client)


def test_interpret_situation_api_error_raises():
    client = _FakeClient(RuntimeError("boom"))
    with pytest.raises(SituationLLMError):
        interpret_situation("아무거나", client=client)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/llm/test_situation.py -k interpret -v`
Expected: FAIL (`ImportError: cannot import name 'interpret_situation'`)

- [ ] **Step 3: Add `interpret_situation` to `src/mrms/llm/situation.py`**

Append to `src/mrms/llm/situation.py`:

```python
def _client() -> genai.Client:
    return genai.Client(api_key=settings.gemini_api_key)


def interpret_situation(
    text: str, *, client: genai.Client | None = None
) -> SituationInterpretation:
    """상황 텍스트 → Gemini 구조화 출력 → SituationInterpretation. 실패 시 SituationLLMError."""
    client = client or _client()
    try:
        resp = client.models.generate_content(
            model=settings.gemini_model,
            contents=text,
            config=types.GenerateContentConfig(
                system_instruction=_SITUATION_PROMPT,
                response_mime_type="application/json",
                response_schema=SituationInterpretation,
                max_output_tokens=2048,
                # 2.5-flash 기본 thinking 비활성 — 구조화 출력 None 위험 회피 + 지연 단축
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
    except Exception as e:  # 어떤 SDK/네트워크 오류든 SituationLLMError로 → API 502
        raise SituationLLMError(str(e)) from e
    parsed = resp.parsed
    if parsed is None:
        raise SituationLLMError("LLM이 유효한 해석을 반환하지 않음")
    return parsed
```

- [ ] **Step 4: Run test to verify it passes**

Run: `.venv/bin/pytest tests/llm/test_situation.py -v`
Expected: PASS (6 passed)

- [ ] **Step 5: Commit**

```bash
git add src/mrms/llm/situation.py tests/llm/test_situation.py
git commit -m "feat(situation): interpret_situation — Gemini 구조화 출력(thinking off), 실패=SituationLLMError

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: API 라우트 + 등록

**Files:**
- Create: `src/mrms/api/situation.py`
- Modify: `src/mrms/api/main.py:21-22,62`
- Test: `tests/api/test_situation.py`

- [ ] **Step 1: Write the failing test**

Create `tests/api/test_situation.py`:

```python
from __future__ import annotations

import mrms.api.situation as situation_api
from fastapi.testclient import TestClient

from mrms.api.main import app
from mrms.llm.situation import SituationInterpretation, SituationLLMError

client = TestClient(app)


def _fake_interp():
    return SituationInterpretation(
        interpretation="차분한 비 오는 아침", mood_label="rainy calm",
        valence=0.4, energy=0.3, tempo_bpm=90.0, acousticness=0.5, instrumentalness=0.15,
        valence_weight=1.0, energy_weight=1.0, tempo_weight=0.6,
        acousticness_weight=0.4, instrumentalness_weight=1.0,
    )


def test_situation_requires_auth():
    client.cookies.clear()
    r = client.post("/api/situation/recommendations", json={"text": "비 오는 아침"})
    assert r.status_code in (401, 403)


def test_situation_empty_text_400(login):
    _, session_id = login()
    client.cookies.set("mrms_session", session_id)
    r = client.post("/api/situation/recommendations", json={"text": "   "})
    assert r.status_code == 400
    client.cookies.clear()


def test_situation_llm_failure_502(login, monkeypatch):
    _, session_id = login()
    client.cookies.set("mrms_session", session_id)

    def boom(_text):
        raise SituationLLMError("down")

    monkeypatch.setattr(situation_api, "interpret_situation", boom)
    r = client.post("/api/situation/recommendations", json={"text": "비 오는 아침"})
    assert r.status_code == 502
    client.cookies.clear()


def test_situation_happy_path(login, monkeypatch):
    _, session_id = login()
    client.cookies.set("mrms_session", session_id)
    monkeypatch.setattr(situation_api, "interpret_situation", lambda _t: _fake_interp())
    r = client.post("/api/situation/recommendations", json={"text": "비 오는 아침 독서"})
    assert r.status_code == 200
    data = r.json()
    assert data["interpretation"] == "차분한 비 오는 아침"
    assert data["mood_label"] == "rainy calm"
    assert data["features"]["tempo_bpm"] == 90.0
    assert isinstance(data["tracks"], list)
    client.cookies.clear()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `.venv/bin/pytest tests/api/test_situation.py -v`
Expected: FAIL (`ModuleNotFoundError: No module named 'mrms.api.situation'`)

- [ ] **Step 3: Create the route module**

Create `src/mrms/api/situation.py`:

```python
"""상황 텍스트 → LLM 해석 → 추천 API. 웰니스 프레이밍(치료 표방 금지)."""
from __future__ import annotations

import psycopg
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from mrms.api.deps import db_conn, get_current_user_id
from mrms.llm.situation import SituationLLMError, build_preset, interpret_situation
from mrms.recsys.wellness import recommend_by_preset

router = APIRouter(prefix="/api/situation", tags=["situation"])

_MAX_TEXT = 400


class SituationRequest(BaseModel):
    text: str


@router.post("/recommendations")
def recommendations(
    body: SituationRequest,
    user_id: str = Depends(get_current_user_id),
    conn: psycopg.Connection = Depends(db_conn),
):
    text = body.text.strip()[:_MAX_TEXT]
    if not text:
        raise HTTPException(400, "text must not be empty")
    try:
        interp = interpret_situation(text)
    except SituationLLMError as e:
        raise HTTPException(502, f"LLM 해석 실패: {e}")
    preset = build_preset(interp)
    tracks = recommend_by_preset(conn, user_id, preset, n=20)
    features = {
        "valence": preset["valence"][0],
        "energy": preset["energy"][0],
        "tempo_bpm": preset["tempo"][0],
        "acousticness": preset["acousticness"][0],
        "instrumentalness": preset["instrumentalness"][0],
    }
    return {
        "interpretation": interp.interpretation,
        "mood_label": interp.mood_label,
        "features": features,
        "tracks": tracks,
    }
```

- [ ] **Step 4: Register the router in `src/mrms/api/main.py`**

Add the import next to the other api imports (after line 21 `from mrms.api.wellness import router as wellness_router`):

```python
from mrms.api.situation import router as situation_router
```

Add the include next to the other includes (after line 62 `app.include_router(wellness_router)`):

```python
app.include_router(situation_router)
```

- [ ] **Step 5: Run test to verify it passes**

Run: `.venv/bin/pytest tests/api/test_situation.py -v`
Expected: PASS (4 passed)

- [ ] **Step 6: Commit**

```bash
git add src/mrms/api/situation.py src/mrms/api/main.py tests/api/test_situation.py
git commit -m "feat(situation): POST /api/situation/recommendations + main 등록 (빈텍스트 400/LLM실패 502)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: 프론트 타입 + API 클라이언트

**Files:**
- Modify: `web/src/lib/types.ts`
- Create: `web/src/lib/api/situation.ts`

- [ ] **Step 1: Add the types**

Append to `web/src/lib/types.ts` (reuses `WellnessTrack` — situation tracks are the same shape):

```typescript
export interface SituationFeatures {
  valence: number;
  energy: number;
  tempo_bpm: number;
  acousticness: number;
  instrumentalness: number;
}
export interface SituationResponse {
  interpretation: string;
  mood_label: string;
  features: SituationFeatures;
  tracks: WellnessTrack[];
}
```

- [ ] **Step 2: Create the API client**

Create `web/src/lib/api/situation.ts`:

```typescript
import type { SituationResponse } from "@/lib/types";

import { apiFetch } from "./http";

export async function fetchSituation(text: string): Promise<SituationResponse> {
  const r = await apiFetch(
    "/api/situation/recommendations",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    },
    "situation",
  );
  return (await r.json()) as SituationResponse;
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm -C web exec tsc --noEmit`
Expected: no errors (exit 0)

- [ ] **Step 4: Commit**

```bash
git add web/src/lib/types.ts web/src/lib/api/situation.ts
git commit -m "feat(situation): 프론트 SituationResponse 타입 + fetchSituation 클라이언트

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: 프론트 페이지 + 내비

**Files:**
- Create: `web/src/app/(dashboard)/situation/page.tsx`
- Modify: `web/src/lib/nav.ts:42-43`

- [ ] **Step 1: Create the page**

Create `web/src/app/(dashboard)/situation/page.tsx`:

```tsx
"use client";

import { useState } from "react";

import { fetchSituation } from "@/lib/api/situation";
import type { SituationResponse } from "@/lib/types";
import { ModalTrackList, PlayAllButton } from "@/components/track/ModalTrackList";

export default function SituationPage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<SituationResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const t = text.trim();
    if (!t) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await fetchSituation(t));
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  const tracks = result?.tracks ?? [];

  return (
    <div className="px-6 py-8 md:px-14">
      <header className="mb-6 border-b border-(--mrms-rule) pb-4">
        <div className="font-display text-[28px] font-bold leading-none text-(--mrms-ink)">
          situation desk
        </div>
        <div className="mt-1.5 font-mono text-[10px] uppercase tracking-editorial-wide text-(--mrms-ink-mute)">
          상황을 적으면 그 장면에 맞는 곡을 — LLM이 읽고 해석
        </div>
      </header>

      <div className="mb-8">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={400}
          rows={3}
          placeholder="예: 비 오는 일요일 아침, 혼자 커피 마시며 책 읽기"
          className="w-full resize-none border border-(--mrms-rule) bg-transparent px-4 py-3 font-display text-[15px] text-(--mrms-ink) placeholder:text-(--mrms-ink-mute) focus:border-(--mrms-rust) focus:outline-none"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="font-mono text-[9px] uppercase tracking-editorial text-(--mrms-ink-mute)">
            {text.length}/400
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={loading || !text.trim()}
            className="cursor-pointer border-0 bg-(--mrms-rust) px-4 py-2 font-mono text-[10px] uppercase tracking-editorial text-(--mrms-paper) disabled:cursor-default disabled:opacity-40"
          >
            {loading ? "해석 중…" : "추천받기"}
          </button>
        </div>
      </div>

      {error && <div className="font-mono text-[11px] text-(--mrms-rust)">{error}</div>}

      {result && !loading && (
        <>
          <div className="mb-4 border-b border-(--mrms-rule) pb-3">
            <div className="font-display text-[18px] font-semibold text-(--mrms-ink)">
              {result.mood_label}
            </div>
            <div className="mt-1 font-display text-[14px] italic text-(--mrms-ink-soft)">
              {result.interpretation}
            </div>
          </div>
          {tracks.length > 0 ? (
            <>
              <div className="mb-3 flex items-center justify-between border-b border-(--mrms-rule) pb-2">
                <span className="font-mono text-[11px] uppercase tracking-editorial text-(--mrms-ink-mute)">
                  {tracks.length} tracks
                </span>
                <PlayAllButton tracks={tracks} />
              </div>
              <ModalTrackList tracks={tracks} />
            </>
          ) : (
            <div className="font-mono text-[11px] text-(--mrms-ink-mute)">추천 결과 없음</div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add the nav item**

In `web/src/lib/nav.ts`, in the `"Discover"` group's `items` array, add after the Wellness item (line 42):

```typescript
      { title: "Situation", href: "/situation", num: "D5", full: "situation desk", badge: "·" },
```

- [ ] **Step 3: Build to typecheck the page + nav**

Run: `pnpm -C web build`
Expected: build succeeds (compiles `/situation` route; no type errors)

- [ ] **Step 4: Commit**

```bash
git add "web/src/app/(dashboard)/situation/page.tsx" web/src/lib/nav.ts
git commit -m "feat(situation): /situation 페이지(텍스트 입력+해석 헤더+ModalTrackList) + nav 항목

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## 최종 검증 (모든 태스크 후)

- [ ] 백엔드 타깃 테스트 전체:
  `.venv/bin/pytest tests/test_config_situation.py tests/recsys/test_wellness.py tests/llm/test_situation.py tests/api/test_situation.py -v`
  Expected: 전부 PASS.
- [ ] 프론트 빌드: `pnpm -C web build` → 성공.
- [ ] (배포 전) prod 서버에 `GEMINI_API_KEY` 세팅 확인 — 없으면 502. dev는 입력 완료.

## 배포 노트

- push → CI deploy.sh가 `pip install`(google-genai 포함) + `pnpm build` + 재시작 수행.
- **prod `GEMINI_API_KEY` 필수** — 미설정 시 situation 추천이 502. (wellness 등 기존 기능엔 영향 없음.)
