-- EMP 트랙 커버 — Track/Album에 coverUrl 컬럼이 없고, album_title 없는 트랙(Apple
-- songs 등)은 Album도 안 생기므로 EMPSource에 트랙 단위로 cover를 저장한다.
-- chart 섹션의 트랙 직접 노출(TrackSectionRow) + 모달에서 커버 표시에 사용.
ALTER TABLE "EMPSource" ADD COLUMN IF NOT EXISTS cover_url TEXT;
