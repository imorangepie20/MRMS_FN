import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { RecommendedAlbum } from "@/lib/types";


export function RecommendedAlbumCard({ album }: { album: RecommendedAlbum }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base truncate">{album.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground truncate">{album.artist}</p>
        <p className="text-xs text-muted-foreground mt-2">{album.track_count}곡 추천</p>
      </CardContent>
    </Card>
  );
}
