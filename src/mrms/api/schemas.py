"""FastAPI 응답 Pydantic 모델."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class UserInfo(BaseModel):
    user_id: str
    email: str
    displayName: str | None = None
    country: str | None = None
    personas_count: int
    user_tracks_count: int
    primary_platform: str


class PersonaTrack(BaseModel):
    track_id: str
    title: str
    artist: str
    album_id: str | None = None
    album_title: str | None = None
    similarity: float
    tidal_track_id: str | None = None
    spotify_track_id: str | None = None


class Persona(BaseModel):
    persona_idx: int
    track_count: int
    playlist: list[PersonaTrack]


class RecommendedTrack(BaseModel):
    track_id: str
    title: str
    artist: str
    album_id: str | None = None
    album_title: str | None = None
    duration_ms: int | None = None
    score: float
    persona_idx: int | None = None
    tidal_track_id: str | None = None
    spotify_track_id: str | None = None
    liked: bool = False
    pct: bool = False


class RecommendedAlbum(BaseModel):
    album_id: str
    title: str
    artist: str
    track_count: int


class RecommendedPlaylist(BaseModel):
    id: str
    name: str
    description: str | None = None
    cover_url: str | None = None
    track_count: int
    persona_idx: int | None = None
    persona_score: float | None = None


class MrtLatestResponse(BaseModel):
    generated_at: datetime | None = None
    model_version: str | None = None
    personas: list[Persona]
    recommended_tracks: list[RecommendedTrack]
    recommended_albums: list[RecommendedAlbum]
    recommended_playlists: list[RecommendedPlaylist] = []
