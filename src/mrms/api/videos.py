"""Videos browse API — 비디오 섹션 목록(공개)."""
from __future__ import annotations

import psycopg
from fastapi import APIRouter, Depends

from mrms.api.deps import db_conn
from mrms.db.emp_section import list_sections_with_items

router = APIRouter(prefix="/api/videos", tags=["videos"])


@router.get("/sections")
def get_video_sections(conn: psycopg.Connection = Depends(db_conn)):
    # 공개 — 비회원 둘러보기(EMP와 동일). 비디오 섹션(video:%)만.
    sections = list_sections_with_items(conn, only_video=True)
    return {"sections": sections}
