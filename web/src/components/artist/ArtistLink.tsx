"use client";

import { useArtistModal } from "@/store/artist-modal";

export function ArtistLink({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  const open = useArtistModal((s) => s.open);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        open(name);
      }}
      className={`bg-transparent border-0 p-0 text-inherit text-left cursor-pointer hover:text-(--mrms-rust) hover:underline ${className}`}
    >
      {name}
    </button>
  );
}
