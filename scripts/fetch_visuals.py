"""Unsplash 큐레이션 4장을 용도별 사이즈로 web/public/visuals/에 저장 + 크레딧 + download 트리거.
키는 .env UNSPLASH_ACCESS_KEY(큐레이션 전용, 런타임 미사용)."""
import pathlib

import httpx

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "web" / "public" / "visuals"
OUT.mkdir(parents=True, exist_ok=True)

KEY = ""
for line in (ROOT / ".env").read_text().splitlines():
    if line.startswith("UNSPLASH_ACCESS_KEY="):
        KEY = line.split("=", 1)[1].strip().strip('"').strip("'")
assert KEY, "UNSPLASH_ACCESS_KEY 없음"
H = {"Authorization": f"Client-ID {KEY}", "Accept-Version": "v1"}

# (id, 출력파일, 가로px, 품질)
JOBS = [
    ("GX4YM64o49U", "hero-1.jpg", 1600, 80),
    ("tVugl_rtvHA", "hero-2.jpg", 1600, 80),
    ("PuZgWp_a0Cs", "band.jpg", 1100, 78),
    ("35AdKAwMpg0", "texture.jpg", 480, 68),
]
credits = ["# Photo credits (Unsplash)", "", "사진은 Unsplash 라이선스. 큐레이션 정적 호스팅.", ""]
with httpx.Client(timeout=40, headers=H) as c:
    for pid, fname, w, q in JOBS:
        meta = c.get(f"https://api.unsplash.com/photos/{pid}")
        meta.raise_for_status()
        j = meta.json()
        url = f"{j['urls']['raw']}&w={w}&q={q}&fm=jpg&fit=max"
        img = c.get(url)
        img.raise_for_status()
        (OUT / fname).write_bytes(img.content)
        try:
            c.get(j["links"]["download_location"])
        except Exception:
            pass
        who = j["user"]["name"]
        credits.append(f"- `{fname}` — [{who}]({j['user']['links']['html']}) · {j['links']['html']}")
        print(f"saved {fname} ({len(img.content)//1024}KB) by {who}")
(OUT / "CREDITS.md").write_text("\n".join(credits) + "\n")
print("CREDITS.md written")
