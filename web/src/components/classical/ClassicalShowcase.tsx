"use client";

import { useEffect, useRef, useState } from "react";

import type { ClassicalVideo } from "@/lib/server/classical-fetch";

import { ClassicalVideoModal, type ModalVideo } from "./ClassicalVideoModal";

// "Lumière Restored — The Archive Broadcast": 볼트에서 복원한 콘서트홀 방송.
// 텅스텐 앰버 팔로우-스팟(커서 추적) · 레터박스 바 · 필름 그레인 · 필름셀 그리드.
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

const STYLE = `
.lumiere {
  --bg:#0a0807; --surface:#12100d; --accent:#e8b463; --text:#f4ece0; --muted:#9a8d78;
  --mx:50%; --my:26%;
  position:relative; min-height:100vh; background:var(--bg); color:var(--text);
  overflow-x:hidden; isolation:isolate;
  font-family:var(--font-dm-mono, ui-monospace, "SFMono-Regular", monospace);
  animation:lumFade 700ms ease both;
}
.lumiere *, .lumiere *::before, .lumiere *::after { box-sizing:border-box; }
.lum-serif { font-family:var(--font-serif), "Nanum Myeongjo", Georgia, serif; }

.lum-grain, .lum-vignette, .lum-spot { position:fixed; inset:0; pointer-events:none; }
.lum-grain { z-index:60; opacity:.07; mix-blend-mode:overlay; background-image:${GRAIN};
  background-size:180px 180px; animation:lumGrain 1.1s steps(3) infinite; }
.lum-vignette { z-index:55; background:radial-gradient(125% 120% at 50% 42%, transparent 50%, rgba(0,0,0,.74)); }
.lum-spot { z-index:58; mix-blend-mode:screen;
  background:radial-gradient(circle 440px at var(--mx) var(--my), rgba(232,180,99,.11), transparent 70%); }

.lum-hero { position:relative; width:100%; height:min(86vh,820px); min-height:520px;
  overflow:hidden; cursor:pointer; display:flex; align-items:flex-end; }
.lum-hero-img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:0;
  transform:scale(1.1); filter:grayscale(.35) sepia(.28) contrast(1.08) brightness(.6);
  animation:lumBulb 1.5s ease both 200ms, lumDrift 30s ease-in-out infinite alternate 1.7s; }
.lum-hero-grad { position:absolute; inset:0; z-index:1;
  background:
    radial-gradient(120% 90% at 50% 26%, rgba(232,180,99,.16), transparent 55%),
    linear-gradient(to top, var(--bg) 5%, rgba(10,8,7,.5) 38%, transparent 74%); }
.lum-scan { position:absolute; inset:0; z-index:2; opacity:.2; mix-blend-mode:multiply;
  background:repeating-linear-gradient(to bottom, transparent 0 3px, rgba(0,0,0,.55) 3px 4px); }
.lum-bar { position:absolute; left:0; right:0; z-index:5; height:clamp(28px,5vh,58px); background:var(--bg); }
.lum-bar-top { top:0; display:flex; align-items:center; justify-content:space-between;
  padding:0 clamp(16px,4vw,40px); font-size:10px; letter-spacing:.26em; text-transform:uppercase;
  color:rgba(232,180,99,.72); animation:lumBarTop 700ms cubic-bezier(.2,.7,.2,1) both 480ms; }
.lum-bar-bot { bottom:0; animation:lumBarBot 700ms cubic-bezier(.2,.7,.2,1) both 480ms; }
.lum-live { display:inline-flex; align-items:center; gap:7px; }
.lum-live::before { content:"\\25CF"; color:var(--accent); animation:lumLive 1.4s ease-in-out infinite; }
.lum-slate { position:absolute; right:clamp(10px,2.2vw,22px); top:50%; transform:translateY(-50%); z-index:5;
  writing-mode:vertical-rl; text-orientation:mixed; font-size:10px; letter-spacing:.3em; text-transform:uppercase;
  color:var(--muted); border-left:1px solid rgba(232,180,99,.4); padding-left:8px; }
.lum-hero-content { position:relative; z-index:6; max-width:62ch;
  padding:clamp(28px,6vw,90px); padding-bottom:clamp(74px,12vh,140px); }
.lum-kicker { font-size:11px; letter-spacing:.28em; text-transform:uppercase; color:rgba(232,180,99,.78);
  margin-bottom:18px; animation:lumRise 600ms cubic-bezier(.2,.7,.2,1) both 640ms; }
.lum-title { font-variation-settings:"opsz" 144, "wght" 340; font-weight:340;
  font-size:clamp(2.8rem,7.4vw,6.6rem); line-height:.94; letter-spacing:-.02em; color:var(--text);
  text-shadow:0 2px 44px rgba(232,180,99,.18); margin:0;
  animation:lumClip 720ms cubic-bezier(.2,.7,.2,1) both 760ms; }
.lum-title em { font-style:italic; color:#f7e4c4; }
.lum-runline { margin-top:24px; display:inline-flex; flex-direction:column; gap:7px;
  font-size:12px; letter-spacing:.2em; text-transform:uppercase; color:rgba(232,180,99,.86);
  animation:lumRise 600ms ease both 960ms; }
.lum-underline { height:1px; width:100%; background:var(--accent); transform-origin:left;
  animation:lumUnderline 700ms ease both 1020ms; }

.lum-collection { position:relative; z-index:6; max-width:1340px; margin:0 auto;
  padding:clamp(40px,7vh,92px) clamp(16px,4vw,40px) clamp(54px,8vh,96px); }
.lum-sec-head { display:flex; align-items:center; gap:16px; margin-bottom:clamp(20px,3vh,34px);
  font-size:11px; letter-spacing:.28em; text-transform:uppercase; color:rgba(232,180,99,.72); }
.lum-rule { flex:1; height:1px; background:rgba(232,180,99,.4); }
.lum-grid { display:grid; grid-template-columns:1fr; gap:1px; background:rgba(232,180,99,.13); border:1px solid rgba(232,180,99,.13); }
@media (min-width:640px){ .lum-grid { grid-template-columns:repeat(2,1fr); } }
@media (min-width:1024px){ .lum-grid { grid-template-columns:repeat(3,1fr); } }
@media (min-width:1536px){ .lum-grid { grid-template-columns:repeat(4,1fr); } }
.lum-cell { position:relative; aspect-ratio:16/9; overflow:hidden; border:0; padding:0; width:100%; display:block;
  background:var(--surface); cursor:pointer; opacity:0; animation:lumRise 650ms cubic-bezier(.2,.7,.2,1) both; }
.lum-cell img { position:absolute; inset:0; width:100%; height:100%; object-fit:cover;
  filter:grayscale(.5) sepia(.2) brightness(.64) contrast(1.05);
  transition:filter .5s ease, transform .55s cubic-bezier(.16,1,.3,1); }
.lum-grid:hover .lum-cell:not(:hover) img { filter:grayscale(.7) brightness(.38); }
.lum-cell:hover { z-index:10; }
.lum-cell:hover img { filter:grayscale(0) sepia(.07) brightness(.96) contrast(1.02); transform:scale(1.04); }
.lum-cell::after { content:""; position:absolute; inset:6px; border:1px solid var(--accent);
  opacity:0; transition:opacity .4s ease; pointer-events:none; z-index:4; }
.lum-cell:hover::after { opacity:.92; }
.lum-idx { position:absolute; top:10px; left:13px; z-index:3; font-size:10px; letter-spacing:.16em; color:var(--muted); }
.lum-cell-grad { position:absolute; inset:0; z-index:2;
  background:linear-gradient(to top, rgba(10,8,7,.94) 3%, rgba(10,8,7,.1) 42%, transparent 60%); }
.lum-cell-title { position:absolute; left:14px; right:14px; bottom:13px; z-index:3; font-weight:420;
  font-size:15px; line-height:1.22; letter-spacing:-.01em; color:var(--text);
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.lum-play { position:absolute; z-index:3; left:50%; top:50%; transform:translate(-50%,-50%) scale(.78);
  width:54px; height:54px; border:1px solid var(--accent); border-radius:50%; display:grid; place-items:center;
  opacity:0; background:rgba(10,8,7,.32); box-shadow:0 0 42px rgba(232,180,99,.28);
  transition:opacity .4s ease, transform .4s ease; }
.lum-play::before { content:""; width:0; height:0; margin-left:3px;
  border-style:solid; border-width:7px 0 7px 12px; border-color:transparent transparent transparent var(--accent); }
.lum-cell:hover .lum-play { opacity:1; transform:translate(-50%,-50%) scale(1); }

.lum-footer { position:relative; z-index:6; text-align:center; padding:8px 16px 64px;
  font-size:10px; letter-spacing:.24em; text-transform:uppercase; color:var(--muted); }

.lum-empty { position:relative; z-index:6; min-height:78vh; display:grid; place-items:center; text-align:center; padding:24px; }
.lum-empty h2 { font-weight:340; font-size:clamp(1.7rem,4.5vw,2.8rem); color:var(--text); margin:0; }
.lum-empty p { margin-top:14px; font-size:11px; letter-spacing:.24em; text-transform:uppercase; color:var(--muted); }

.lum-modal { position:fixed; inset:0; z-index:100; display:flex; flex-direction:column; align-items:center;
  justify-content:center; padding:clamp(20px,5vh,60px) clamp(16px,4vw,40px); background:rgba(10,8,7,.94);
  animation:lumFade 280ms ease both; }
.lum-modal::after { content:""; position:absolute; inset:0; pointer-events:none; z-index:1;
  background-image:${GRAIN}; background-size:180px 180px; opacity:.06; mix-blend-mode:overlay; }
.lum-modal-close { position:absolute; top:20px; right:22px; z-index:3; display:inline-flex; align-items:center; gap:8px;
  background:none; border:0; color:var(--accent); cursor:pointer; font-size:15px; letter-spacing:.2em; }
.lum-modal-close span { font-size:10px; color:var(--muted); }
.lum-modal-stage { position:relative; z-index:2; width:100%; max-width:min(90vw,1400px); }
.lum-modal-kicker { font-size:10px; letter-spacing:.3em; text-transform:uppercase; color:rgba(232,180,99,.72); margin-bottom:11px; }
.lum-modal-frame { position:relative; aspect-ratio:16/9; width:100%; max-height:78vh; margin:0 auto;
  border:1px solid rgba(232,180,99,.42); box-shadow:0 0 90px rgba(232,180,99,.12); animation:lumBulb 720ms ease both; }
.lum-modal-frame iframe { position:absolute; inset:0; width:100%; height:100%; border:0; }
.lum-modal-title { margin-top:16px; font-weight:340; font-size:clamp(1.05rem,2.4vw,1.6rem); color:var(--text); text-align:center; }

@keyframes lumFade { from { opacity:0 } to { opacity:1 } }
@keyframes lumBulb { 0% { opacity:0 } 18% { opacity:.4 } 38% { opacity:.78 } 54% { opacity:.55 } 100% { opacity:1 } }
@keyframes lumDrift { from { transform:scale(1.1) translate(0,0) } to { transform:scale(1.16) translate(-1.6%,-1.4%) } }
@keyframes lumBarTop { from { transform:translateY(-100%) } to { transform:translateY(0) } }
@keyframes lumBarBot { from { transform:translateY(100%) } to { transform:translateY(0) } }
@keyframes lumRise { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
@keyframes lumClip { from { clip-path:inset(100% 0 0 0); opacity:0 } to { clip-path:inset(0 0 0 0); opacity:1 } }
@keyframes lumUnderline { from { transform:scaleX(0) } to { transform:scaleX(1) } }
@keyframes lumLive { 0%,100% { opacity:1 } 50% { opacity:.3 } }
@keyframes lumGrain { 0% { background-position:0 0 } 100% { background-position:-7px 5px } }

@media (prefers-reduced-motion: reduce) {
  .lumiere, .lum-hero-img, .lum-bar-top, .lum-bar-bot, .lum-kicker, .lum-title, .lum-runline,
  .lum-underline, .lum-cell, .lum-grain, .lum-modal-frame, .lum-live::before { animation:none !important; }
  .lum-cell { opacity:1 !important; }
  .lum-title { clip-path:none !important; }
  .lum-underline { transform:none !important; }
}
`;

// 클래식/재즈 공용 카피 — 미지정 시 클래식 기본값.
export interface ShowcaseCopy {
  kicker: string;
  titleLead: string;
  titleEm: string;
  runline: string;
  slate: string;
  sectionLabel: string;
  footer: string;
  emptyTitle: string;
  emptySub: string;
}

export const CLASSICAL_COPY: ShowcaseCopy = {
  kicker: "Reel 01 · Live from the great concert halls",
  titleLead: "클래식 공연 ",
  titleEm: "실황",
  runline: "Play full concert",
  slate: "세계 오케스트라 · Full Concerts",
  sectionLabel: "The Collection",
  footer: "MRMS · Classical Archive — 위대한 공연장의 밤, 처음부터 끝까지",
  emptyTitle: "곧 막이 오릅니다",
  emptySub: "클래식 공연 실황 · 준비 중",
};

export function ClassicalShowcase({
  videos,
  copy = CLASSICAL_COPY,
}: {
  videos: ClassicalVideo[];
  copy?: ShowcaseCopy;
}) {
  const [active, setActive] = useState<ModalVideo | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // 팔로우-스팟 — 커서 위치를 CSS 변수(--mx/--my)로 (rAF 스로틀).
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let raf = 0;
    let px = 50;
    let py = 26;
    const onMove = (e: MouseEvent) => {
      px = (e.clientX / window.innerWidth) * 100;
      py = (e.clientY / window.innerHeight) * 100;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        el.style.setProperty("--mx", `${px}%`);
        el.style.setProperty("--my", `${py}%`);
        raf = 0;
      });
    };
    window.addEventListener("mousemove", onMove);
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const open = (v: ClassicalVideo) => setActive({ videoId: v.videoId, title: v.title });

  if (videos.length === 0) {
    return (
      <div ref={rootRef} className="lumiere">
        <style>{STYLE}</style>
        <div className="lum-grain" aria-hidden />
        <div className="lum-vignette" aria-hidden />
        <div className="lum-empty">
          <div>
            <h2 className="lum-serif">{copy.emptyTitle}</h2>
            <p>{copy.emptySub}</p>
          </div>
        </div>
      </div>
    );
  }

  const hero = videos[0];
  const rest = videos.slice(1);

  return (
    <div ref={rootRef} className="lumiere">
      <style>{STYLE}</style>
      <div className="lum-grain" aria-hidden />
      <div className="lum-vignette" aria-hidden />
      <div className="lum-spot" aria-hidden />

      <header className="lum-hero" onClick={() => open(hero)} role="button" aria-label={`재생: ${hero.title}`}>
        {hero.cover && <img className="lum-hero-img" src={hero.cover} alt="" aria-hidden />}
        <div className="lum-hero-grad" aria-hidden />
        <div className="lum-scan" aria-hidden />
        <div className="lum-bar lum-bar-top">
          <span>Archive Broadcast — Restored Edition · 24fps</span>
          <span className="lum-live">LIVE</span>
        </div>
        <div className="lum-bar lum-bar-bot" aria-hidden />
        <div className="lum-slate">{copy.slate}</div>
        <div className="lum-hero-content">
          <div className="lum-kicker">{copy.kicker}</div>
          <h1 className="lum-title lum-serif">
            {copy.titleLead}
            <em>{copy.titleEm}</em>
          </h1>
          <div className="lum-runline">
            <span>▸ {copy.runline}</span>
            <span className="lum-underline" aria-hidden />
          </div>
        </div>
      </header>

      <section className="lum-collection">
        <div className="lum-sec-head">
          <span>§ {copy.sectionLabel}</span>
          <span className="lum-rule" aria-hidden />
        </div>
        <div className="lum-grid">
          {rest.map((v, i) => (
            <button
              key={`${v.videoId}-${i}`}
              type="button"
              className="lum-cell"
              style={{ animationDelay: `${Math.min(i * 55, 600)}ms` }}
              onClick={() => open(v)}
              aria-label={`재생: ${v.title}`}
            >
              {v.cover && <img src={v.cover} alt="" loading="lazy" aria-hidden />}
              <span className="lum-cell-grad" aria-hidden />
              <span className="lum-idx">No. {String(i + 2).padStart(2, "0")}</span>
              <span className="lum-play" aria-hidden />
              <span className="lum-cell-title lum-serif">{v.title}</span>
            </button>
          ))}
        </div>
      </section>

      <footer className="lum-footer">{copy.footer}</footer>

      <ClassicalVideoModal video={active} onClose={() => setActive(null)} />
    </div>
  );
}
