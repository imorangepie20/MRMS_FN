// 주파수 스펙트럼(byte frequency data)을 막대 높이로 변환하는 순수 함수.
// my-forever-music BarsVisualizer 의 수학 차용 (로그 밴드 / 고주파 게인 /
// 노이즈 게이팅 / 감마 / attack-release 스무딩). React / Web Audio 의존 없음.

export const BAR_COUNT = 48;

const PEAK_GAIN = 0.6;
const RESPONSE_GAMMA = 0.95;
const NOISE_FLOOR = 0.04;
const HIGH_FREQUENCY_GAIN = 1.5;
const ATTACK = 0.95; // 상승은 빠르게
const RELEASE = 0.32; // 하강은 느리게

// 막대를 매핑할 상한 빈 비율 (0..1, Nyquist 대비). 음악 에너지는 저~중음에
// 몰려 있고 상위 고음 구간은 거의 비어 있어, 막대를 실제 쓰이는 하단에 집중시킨다.
const MAX_BIN_RATIO = 0.35;

/** 막대 index 가 차지하는 [start, end) 주파수 빈 범위 (로그 간격). */
export function logBandRange(index: number, binCount: number): [number, number] {
  if (binCount <= 2) {
    return [0, binCount];
  }
  const minBin = 1;
  const maxBin = Math.max(2, Math.floor(binCount * MAX_BIN_RATIO));
  const minLog = Math.log(minBin);
  const maxLog = Math.log(maxBin);
  const startRatio = index / BAR_COUNT;
  const endRatio = (index + 1) / BAR_COUNT;
  const start = Math.max(
    minBin,
    Math.floor(Math.exp(minLog + (maxLog - minLog) * startRatio)),
  );
  const end = Math.min(
    binCount,
    Math.max(start + 1, Math.ceil(Math.exp(minLog + (maxLog - minLog) * endRatio))),
  );
  return [start, end];
}

/**
 * byte frequency data(bins, 0..255)를 BAR_COUNT 개 막대 높이(0..1)로 변환.
 * prev = 직전 프레임 높이 배열(스무딩 입력). 반환값을 다음 프레임의 prev 로 넘긴다.
 */
export function binsToBarHeights(bins: Uint8Array, prev: number[]): number[] {
  const out = new Array<number>(BAR_COUNT);
  for (let i = 0; i < BAR_COUNT; i++) {
    const [start, end] = logBandRange(i, bins.length);
    let sum = 0;
    for (let j = start; j < end; j++) sum += bins[j];

    const bandPosition = i / Math.max(1, BAR_COUNT - 1);
    const bandGain = 1 + bandPosition * HIGH_FREQUENCY_GAIN;
    const avg = (sum / Math.max(1, end - start) / 255) * bandGain;
    const gated = Math.max(0, avg - NOISE_FLOOR) / (1 - NOISE_FLOOR);
    const target = Math.min(1, Math.pow(gated, RESPONSE_GAMMA) * PEAK_GAIN);

    const previous = prev[i] ?? 0;
    const k = target > previous ? ATTACK : RELEASE;
    out[i] = previous + (target - previous) * k;
  }
  return out;
}
