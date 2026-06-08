"""FastAPI app — MRMS 데이터를 HTTP로 노출."""
from __future__ import annotations

from fastapi import Depends, FastAPI

import psycopg

from mrms.api.deps import db_conn, get_default_user_email
from mrms.api.schemas import UserInfo
from mrms.db.user_track import get_or_create_user


app = FastAPI(title="MRMS API", version="0.1.0")


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/user", response_model=UserInfo)
def user(conn: psycopg.Connection = Depends(db_conn)) -> UserInfo:
    email = get_default_user_email()
    user_id = get_or_create_user(conn, email)
    conn.commit()
    with conn.cursor() as cur:
        cur.execute(
            'SELECT "displayName", country FROM "User" WHERE id = %s',
            (user_id,),
        )
        row = cur.fetchone()
        display_name, country = (row[0], row[1]) if row else (None, None)

        cur.execute(
            'SELECT COUNT(*) FROM "UserPersona" WHERE "userId" = %s',
            (user_id,),
        )
        personas_count = cur.fetchone()[0]

        cur.execute(
            'SELECT COUNT(*) FROM "UserTrack" WHERE "userId" = %s',
            (user_id,),
        )
        tracks_count = cur.fetchone()[0]

    return UserInfo(
        user_id=user_id,
        email=email,
        displayName=display_name,
        country=country,
        personas_count=personas_count,
        user_tracks_count=tracks_count,
    )
