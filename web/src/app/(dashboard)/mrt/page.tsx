import { PersonaCard } from "@/components/mrms/PersonaCard";
import { RecommendedAlbumCard } from "@/components/mrms/RecommendedAlbumCard";
import { RecommendedTracksTable } from "@/components/mrms/RecommendedTracksTable";
import { getMrtLatest, getUser } from "@/lib/api";


export default async function MrtPage() {
  const [user, mrt] = await Promise.all([
    getUser(),
    getMrtLatest(),
  ]);

  if (mrt.personas.length === 0) {
    return (
      <div className="p-8 space-y-4">
        <h1 className="text-2xl font-bold">MRT</h1>
        <p className="text-muted-foreground">
          MRT 데이터 없음. 다음 명령 실행 필요:
        </p>
        <pre className="rounded bg-muted p-4 text-sm">
{`python3 scripts/09_generate_mrt.py --email ${user.email}`}
        </pre>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8">
      <header>
        <h1 className="text-2xl font-bold">MRT</h1>
        <p className="text-sm text-muted-foreground">
          {user.email} · 페르소나 {user.personas_count} · UserTrack {user.user_tracks_count}곡
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">페르소나</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {mrt.personas.map((p) => (
            <PersonaCard key={p.persona_idx} persona={p} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">추천 트랙</h2>
        <RecommendedTracksTable tracks={mrt.recommended_tracks} />
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">추천 앨범</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {mrt.recommended_albums.map((a) => (
            <RecommendedAlbumCard key={a.album_id} album={a} />
          ))}
        </div>
      </section>
    </div>
  );
}
