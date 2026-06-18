"use client";

import type { CSSProperties } from "react";
import { ArrowUpRight } from "lucide-react";

import type { EmpItemType, EmpSectionItem } from "@/lib/types";
import { duotoneStyle, coverInitial } from "@/lib/cover-art";


// type별 라벨 톤 — Editorial 절제 안에서 위계만. rust는 큐레이션성(플리/스테이션),
// ink는 카탈로그성(앨범/아티스트), mute는 차트/믹스.
const TYPE_TONE: Record<EmpItemType, string> = {
  playlist: "text-(--mrms-rust) border-(--mrms-rust)",
  station: "text-(--mrms-rust) border-(--mrms-rust)",
  channel: "text-(--mrms-rust) border-(--mrms-rust)",
  album: "text-(--mrms-ink) border-(--mrms-ink)",
  artist: "text-(--mrms-ink) border-(--mrms-ink)",
  mix: "text-(--mrms-ink-mute) border-(--mrms-ink-mute)",
  chart: "text-(--mrms-ink-mute) border-(--mrms-ink-mute)",
};


/** EMP 아이템 카드: cover + hover 오버레이 + type 칩 + 제목.
 *
 *  두 사용처:
 *  - 캐러셀(SectionRow): coverStyle로 고정 px, titleTooltip, onClick
 *  - 그리드(admin SectionsTree): coverClassName="aspect-square w-full"
 *  onClick 있으면 button(group), 없으면 div(group).
 */
export function EmpItemCard({
  item,
  coverClassName = "",
  coverStyle,
  labelSizeClassName = "text-[10px]",
  titleTooltip = false,
  onClick,
}: {
  item: EmpSectionItem;
  coverClassName?: string;
  coverStyle?: CSSProperties;
  labelSizeClassName?: string;
  titleTooltip?: boolean;
  onClick?: () => void;
}) {
  const label = item.title ?? item.item_id;
  const tone = TYPE_TONE[item.item_type] ?? TYPE_TONE.mix;

  const body = (
    <>
      {/* === COVER === */}
      <div
        style={coverStyle}
        className={`relative overflow-hidden bg-(--mrms-rule) ${coverClassName}`}
      >
        {item.cover_url ? (
          <img
            src={item.cover_url}
            alt={item.title ?? ""}
            loading="lazy"
            className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
          />
        ) : (
          <div
            className="absolute inset-0 flex items-center justify-center"
            style={duotoneStyle(label)}
          >
            <span
              className="font-serif font-bold text-(--mrms-paper) leading-none"
              style={{ fontSize: "40cqw", textShadow: "0 2px 10px rgba(31,26,22,.32)" }}
            >
              {coverInitial(label)}
            </span>
          </div>
        )}

        {/* type 칩 — 좌상단 */}
        <span
          className={`absolute top-1.5 left-1.5 px-1.5 py-px bg-(--mrms-paper)/90 border font-mono tracking-editorial uppercase leading-none ${labelSizeClassName} ${tone}`}
        >
          {item.item_type}
        </span>

        {/* hover 오버레이 — "펼쳐보기" 신호 */}
        {onClick && (
          <span className="absolute inset-0 flex items-center justify-center bg-(--mrms-ink)/45 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <span className="size-8 rounded-full bg-(--mrms-paper) flex items-center justify-center">
              <ArrowUpRight className="size-4 text-(--mrms-ink)" strokeWidth={2.5} />
            </span>
          </span>
        )}
      </div>

      {/* === 제목 === */}
      <div
        className="mt-1.5 font-display font-medium text-[12px] leading-snug text-(--mrms-ink) truncate group-hover:text-(--mrms-rust) transition-colors"
        title={titleTooltip ? label : undefined}
      >
        {label}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        style={{ containerType: "inline-size" }}
        className="group w-full text-left bg-transparent border-0 p-0 cursor-pointer"
      >
        {body}
      </button>
    );
  }
  return (
    <div style={{ containerType: "inline-size" }} className="group flex flex-col">
      {body}
    </div>
  );
}
