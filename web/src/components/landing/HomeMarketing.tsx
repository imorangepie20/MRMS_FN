import Link from "next/link";

import { LandingHero } from "./LandingHero";

const FEATURES = [
  { n: "①", t: "추천", d: "임베딩 기반 취향 최근접 추천" },
  { n: "②", t: "무드 / 상황", d: "텍스트로 적으면 그 장면에 맞는 음악" },
  { n: "③", t: "플레이리스트", d: "플랫폼에 상관없어요" },
];

export function HomeMarketing() {
  return (
    <div className="min-h-screen bg-(--mrms-bg)">
      <header className="flex justify-between items-baseline px-6 md:px-14 py-3 border-b border-(--mrms-ink)">
        <span className="font-display font-bold text-[15px] text-(--mrms-ink)">MRMS</span>
        <Link
          href="/login"
          className="font-mono text-[10px] tracking-editorial uppercase bg-(--mrms-rust) text-(--mrms-paper) px-3 py-1.5 no-underline"
        >
          시작하기
        </Link>
      </header>

      <LandingHero />

      <section className="px-6 md:px-14 py-12 max-w-[1100px]">
        <div className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">
          your taste, in sound
        </div>
        <h1 className="font-display font-light text-[clamp(36px,7vw,72px)] leading-[1.0] text-(--mrms-ink) mt-2">
          취향을 <em className="font-display italic text-(--mrms-rust)">재생</em>하다
        </h1>
        <p className="font-mono text-[12px] text-(--mrms-ink-soft) leading-relaxed mt-5 max-w-[520px]">
          Tidal · Spotify · YouTube를 한 곳에서. 임베딩 기반 추천과 무드로, 당신의 취향을 읽습니다.
        </p>
        <Link
          href="/login"
          className="inline-block mt-6 bg-(--mrms-rust) text-(--mrms-paper) px-5 py-2.5 font-mono text-[11px] tracking-editorial uppercase no-underline"
        >
          로그인하고 시작 →
        </Link>

        <div className="grid sm:grid-cols-3 gap-px bg-(--mrms-rule) border border-(--mrms-rule) mt-12">
          {FEATURES.map((f) => (
            <div key={f.t} className="bg-(--mrms-bg) px-5 py-6">
              <div className="font-mono text-[11px] text-(--mrms-rust)">{f.n}</div>
              <div className="font-display font-semibold text-[16px] text-(--mrms-ink) mt-1">{f.t}</div>
              <div className="font-mono text-[10px] text-(--mrms-ink-soft) mt-1 leading-relaxed">{f.d}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
