"use client";

import type { CSSProperties } from "react";

import type { EmpSectionItem } from "@/lib/types";


/** EMP 아이템 카드 공통 마크업: cover(또는 item_type placeholder) + type 라벨 + 제목.
 *
 *  두 사용처의 차이를 props로 흡수:
 *  - 캐러셀(SectionRow): coverStyle로 고정 px 사이징, text-[9px] 라벨, title tooltip, onClick
 *  - 그리드(admin SectionsTree): coverClassName="aspect-square w-full", text-[10px] 라벨
 *  onClick이 있으면 button, 없으면 div(flex flex-col)로 감쌈.
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
  const body = (
    <>
      {item.cover_url ? (
        <img
          src={item.cover_url}
          alt={item.title ?? ""}
          loading="lazy"
          style={coverStyle}
          className={`object-cover bg-(--mrms-rule) ${coverClassName}`}
        />
      ) : (
        <div
          style={coverStyle}
          className={`bg-(--mrms-rule) flex items-center justify-center font-mono text-[10px] text-(--mrms-ink-mute) uppercase ${coverClassName}`}
        >
          {item.item_type}
        </div>
      )}
      <div className={`mt-1 font-mono tracking-editorial uppercase text-(--mrms-ink-mute) ${labelSizeClassName}`}>
        {item.item_type}
      </div>
      <div
        className="font-display text-[12px] text-(--mrms-ink) truncate"
        title={titleTooltip ? (item.title ?? item.item_id) : undefined}
      >
        {item.title ?? item.item_id}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="w-full text-left bg-transparent border-0 p-0 cursor-pointer"
      >
        {body}
      </button>
    );
  }
  return <div className="flex flex-col">{body}</div>;
}
