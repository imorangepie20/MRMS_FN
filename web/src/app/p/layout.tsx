import Link from "next/link";

import { ArtistIntroModal } from "@/components/artist/ArtistIntroModal";
import { PlayerBar } from "@/components/player/PlayerBar";
import { Wordmark } from "@/components/visual/Wordmark";


export default function PublicShareLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-(--mrms-bg) flex flex-col">
      <header className="border-b border-(--mrms-ink) px-4 md:px-14 py-3 flex items-center justify-between">
        <Link href="/" aria-label="MRMS">
          <Wordmark className="text-[20px]" />
        </Link>
        <span className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">
          Listening on MRMS
        </span>
      </header>
      <main className="flex-1 pb-32 md:pb-36">{children}</main>
      <PlayerBar sidebarInset={false} />
      <ArtistIntroModal />
    </div>
  );
}
