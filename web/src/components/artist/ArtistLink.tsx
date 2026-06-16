"use client";

import { useArtistModal } from "@/store/artist-modal";

export function ArtistLink({
  name,
  className = "",
  as = "button",
}: {
  name: string;
  className?: string;
  /** 클릭 가능한 행/카드(자체가 <button>) 안에서는 "span"으로 렌더 — 중첩 <button> 무효 HTML 방지. */
  as?: "button" | "span";
}) {
  const open = useArtistModal((s) => s.open);
  const handleOpen = (e: { stopPropagation: () => void }) => {
    // 클릭 가능한 행/카드 안에서 아티스트 클릭이 행의 재생/오픈을 트리거하지 않게.
    e.stopPropagation();
    open(name);
  };

  if (as === "span") {
    return (
      <span
        role="button"
        tabIndex={0}
        onClick={handleOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleOpen(e);
          }
        }}
        className={`cursor-pointer hover:text-(--mrms-rust) hover:underline ${className}`}
      >
        {name}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleOpen}
      className={`bg-transparent border-0 p-0 text-inherit text-left cursor-pointer hover:text-(--mrms-rust) hover:underline ${className}`}
    >
      {name}
    </button>
  );
}
