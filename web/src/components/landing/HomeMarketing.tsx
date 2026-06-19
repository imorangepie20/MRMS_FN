import Link from "next/link";

import { Wordmark } from "@/components/visual/Wordmark";

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
        <Wordmark className="text-[17px]" />
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
          Tidal · <span className="line-through opacity-60">Spotify</span> · YouTube를 한 곳에서. 임베딩 기반 추천과 무드로, 당신의 취향을 읽습니다.
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

      {/* External Pool 둘러보기 — 비회원도 가입 없이 EMP 브라우즈 */}
      <section className="px-6 md:px-14 pb-12 max-w-[1100px]">
        <Link
          href="/emp"
          className="group relative block overflow-hidden border border-(--mrms-ink) no-underline"
        >
          <img
            src="/visuals/band.jpg"
            alt=""
            aria-hidden
            className="absolute inset-0 size-full object-cover"
            style={{ objectPosition: "center 42%", filter: "saturate(1.5) contrast(1.08)" }}
          />
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: "linear-gradient(100deg, rgba(243,230,216,.95) 2%, rgba(243,230,216,.6) 36%, rgba(243,230,216,.08) 66%)" }}
          />
          <div
            className="relative flex flex-col gap-4 px-6 py-7 sm:flex-row sm:items-center sm:justify-between md:px-9 md:py-9"
            style={{ textShadow: "0 1px 10px rgba(243,230,216,.55)" }}
          >
            <div className="min-w-0">
              <div className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-rust)">
                § 02 · External Music Pool
              </div>
              <div className="font-serif font-bold text-[clamp(26px,4.6vw,44px)] leading-[1.04] text-(--mrms-ink) mt-1">
                External pool
              </div>
              <div className="font-mono text-[11px] text-(--mrms-ink-soft) mt-1.5 max-w-[460px] leading-relaxed">
                다양한 음악의 풀에서 헤엄쳐 보세요.
              </div>
            </div>
            <span className="shrink-0 self-start sm:self-auto inline-flex items-center gap-1.5 bg-(--mrms-rust) text-(--mrms-paper) px-4 py-2.5 font-mono text-[11px] tracking-editorial uppercase">
              둘러보기
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </span>
          </div>
        </Link>
      </section>

      <footer className="px-6 md:px-14 py-6 border-t border-(--mrms-rule) font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">
        Photos · Unsplash — Timothy Barlin, Fernando Hernandez, Priscilla Du Preez
      </footer>
    </div>
  );
}
