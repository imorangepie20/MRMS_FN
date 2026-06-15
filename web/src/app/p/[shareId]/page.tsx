import type { Metadata } from "next";

import { SharedPlaylistClient } from "@/components/share/SharedPlaylistClient";
import { fetchSharedMeta } from "@/lib/server/shared-fetch";


export async function generateMetadata({
  params,
}: {
  params: Promise<{ shareId: string }>;
}): Promise<Metadata> {
  const { shareId } = await params;
  const data = await fetchSharedMeta(shareId);
  const name = data?.playlist?.name ?? "Shared playlist";
  const count = data?.tracks?.length ?? 0;
  const description = data
    ? `${count} tracks · shared on MRMS`
    : "Shared playlist on MRMS";
  // og:image / twitter:image는 같은 폴더의 opengraph-image.tsx가 Next에 의해 자동 주입됨.
  return {
    title: `${name} · MRMS`,
    description,
    openGraph: { title: name, description, type: "music.playlist" },
    twitter: { card: "summary_large_image", title: name, description },
  };
}


export default async function SharedPlaylistPage({
  params,
}: {
  params: Promise<{ shareId: string }>;
}) {
  const { shareId } = await params;
  return <SharedPlaylistClient shareId={shareId} />;
}
