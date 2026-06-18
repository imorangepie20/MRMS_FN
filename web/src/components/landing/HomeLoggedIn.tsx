import { getServerSideMrt, type UserInfo } from "@/lib/server/auth";
import { AlbumArt } from "@/components/mrms/AlbumArt";
import { PhotoBackdrop } from "@/components/visual/PhotoBackdrop";

import { LandingHero } from "./LandingHero";
import { HomeStats } from "./HomeStats";

function SectionHeader({ kicker, title }: { kicker: string; title: string }) {
  return (
    <div className="relative overflow-hidden flex justify-between items-baseline pb-2 px-3 -mx-3 border-b border-(--mrms-ink) mb-4 mt-10">
      <PhotoBackdrop variant="band" src="/visuals/band.jpg" />
      <span className="relative font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute)">{kicker}</span>
      <span className="relative font-display font-bold text-[18px] text-(--mrms-ink)">{title}</span>
    </div>
  );
}

export async function HomeLoggedIn({ user }: { user: UserInfo }) {
  const mrt = await getServerSideMrt();
  const albums = (mrt.recommended_albums ?? []).slice(0, 12);
  const newRel = (mrt.recommended_new_releases ?? []).slice(0, 12);

  return (
    <div>
      <LandingHero />
      <div className="px-6 md:px-14 py-8 max-w-[1200px]">
        <div className="font-mono text-[10px] tracking-editorial uppercase text-(--mrms-ink-mute) mb-3">
          Welcome back, {user.displayName ?? user.email}
        </div>
        <HomeStats personas={user.personas_count} likedTracks={user.user_tracks_count} />

        {albums.length > 0 && (
          <>
            <SectionHeader kicker="for you" title="추천 앨범" />
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {albums.map((a) => (
                <div key={a.album_id} className="min-w-0">
                  <AlbumArt artist={a.artist} album={a.title} initialUrl={a.cover_url} className="aspect-square mb-2" />
                  <div className="font-display text-[13px] font-semibold truncate text-(--mrms-ink)">{a.title}</div>
                  <div className="font-mono text-[10px] text-(--mrms-ink-soft) truncate">{a.artist}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {newRel.length > 0 && (
          <>
            <SectionHeader kicker="new" title="신곡" />
            <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
              {newRel.map((t) => (
                <div key={t.track_id} className="min-w-0">
                  <AlbumArt artist={t.artist} album={t.album_title} initialUrl={t.album_cover} className="aspect-square mb-2" />
                  <div className="font-display text-[13px] font-semibold truncate text-(--mrms-ink)">{t.title}</div>
                  <div className="font-mono text-[10px] text-(--mrms-ink-soft) truncate">{t.artist}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
