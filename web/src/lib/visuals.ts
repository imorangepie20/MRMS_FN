/** Soulful Solace 고정 사진 세트(나노바나나 커스텀). 마스트헤드/모자이크가 인덱스로 선택. */
export const SOULFUL: readonly string[] = [
  "/visuals/soulful-1.jpg",
  "/visuals/soulful-2.jpg",
  "/visuals/soulful-3.jpg",
  "/visuals/soulful-4.jpg",
  "/visuals/soulful-5.jpg",
  "/visuals/soulful-6.jpg",
];

/** 인덱스를 세트 길이로 순환(음수 안전)해서 이미지 경로 반환. */
export function pickVisual(i: number): string {
  const n = SOULFUL.length;
  return SOULFUL[((i % n) + n) % n];
}

/** 문자열 → 결정적 비음수 해시(섹션 제목으로 일관 이미지 배정). */
export function hashIndex(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
