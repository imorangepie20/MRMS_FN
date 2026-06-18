// 커버 이미지가 없을 때의 공용 placeholder — "Warm Duotone Glow".
// seed(아티스트|앨범, 또는 제목) 해시로 따뜻한 2색 그라데 + 글로우를 결정적으로 배정한다.
// hue를 14~80° 따뜻 영역에만 고정해 어떤 입력도 칙칙/차갑게 빠지지 않는다.
// AlbumArt(PGT 등)와 EmpItemCard(EMP)가 동일한 룩을 공유하도록 한 곳에 둔다.

/** seed 해시 → placeholder 배경 스타일(그라데+글로우+안쪽 크림 링). */
export function duotoneStyle(seed: string): { background: string; boxShadow: string } {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0;
  const hue1 = 14 + (h % 36); // 14–49° terracotta→clay→mustard
  const hue2 = hue1 + 18 + ((h >>> 8) % 14); // +18–31° toward amber/gold
  const sat = 58 + ((h >>> 16) % 14); // 58–71% (고급, 네온 X)
  const light = 46 + ((h >>> 20) % 10); // 46–55%
  const linear = `linear-gradient(135deg, hsl(${hue1} ${sat}% ${light}%) 0%, hsl(${hue2} ${sat + 6}% ${light + 8}%) 100%)`;
  const glow = `radial-gradient(120% 120% at 18% 14%, hsl(${hue2} ${sat + 10}% ${light + 14}% / .55), transparent 60%)`;
  return { background: `${glow}, ${linear}`, boxShadow: "inset 0 0 0 1.5px rgba(250,242,233,.22)" };
}

/** 제목/이름의 첫 글자(코드포인트 단위 — 한글/숫자도 OK). 비면 "·". */
export function coverInitial(s: string): string {
  const t = s.trim();
  if (!t) return "·";
  return [...t][0]?.toUpperCase() ?? "·";
}
