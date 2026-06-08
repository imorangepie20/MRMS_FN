-- pgvector + 자주 쓰는 extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;       -- 부분 매칭 검색
CREATE EXTENSION IF NOT EXISTS unaccent;      -- 한글/영문 normalize 보조
