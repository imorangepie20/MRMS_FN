"use client";

import { useState } from "react";

export type BackdropVariant = "hero" | "band" | "texture";

/** variant별 트리트먼트 상수(목업서 확정: saturate 1.8 + amber soft-light). */
export const BACKDROP: Record<
  BackdropVariant,
  { opacity: number; blur: number; saturate: number }
> = {
  hero: { opacity: 1, blur: 0, saturate: 1.8 },
  band: { opacity: 0.2, blur: 3, saturate: 1.5 },
  texture: { opacity: 0.07, blur: 7, saturate: 1.4 },
};

/** 카페·책 사진을 은은하게 까는 배경 레이어. 절대배치·장식용(aria-hidden).
 *  hero: 크림 하단 그라데로 텍스트 가독성 / band: 좌→우 페이드 / texture: 전체 옅게. */
export function PhotoBackdrop({
  variant,
  src,
  className = "",
}: {
  variant: BackdropVariant;
  src: string;
  className?: string;
}) {
  const cfg = BACKDROP[variant];
  const [failed, setFailed] = useState(false);
  return (
    <div aria-hidden className={`absolute inset-0 overflow-hidden pointer-events-none ${className}`}>
      {!failed && (
        <img
          src={src}
          alt=""
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
          style={{
            objectPosition: "center 40%",
            opacity: cfg.opacity,
            filter: `saturate(${cfg.saturate}) contrast(1.12) brightness(1.03)${cfg.blur ? ` blur(${cfg.blur}px)` : ""}`,
          }}
        />
      )}
      {/* amber 따뜻 그레이드 */}
      <div className="absolute inset-0" style={{ background: "rgba(214,138,66,0.16)", mixBlendMode: "soft-light" }} />
      {/* 가독성 그라데 */}
      {variant === "hero" && (
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to top, var(--mrms-bg) 2%, rgba(245,240,232,.85) 26%, rgba(245,240,232,.12) 52%, transparent 75%)" }}
        />
      )}
      {variant === "band" && (
        <div
          className="absolute inset-0"
          style={{ background: "linear-gradient(to right, var(--mrms-bg) 30%, rgba(245,240,232,.4) 100%)" }}
        />
      )}
    </div>
  );
}
