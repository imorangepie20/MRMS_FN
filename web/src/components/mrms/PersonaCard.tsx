import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlayButton } from "@/components/player/PlayButton";
import type { Persona } from "@/lib/types";


interface Props {
  persona: Persona;
  topN?: number;
}


export function PersonaCard({ persona, topN = 5 }: Props) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>페르소나 {persona.persona_idx}</span>
          <span className="text-sm text-muted-foreground">{persona.track_count}곡</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="space-y-2 text-sm">
          {persona.playlist.slice(0, topN).map((t, i) => (
            <li key={t.track_id} className="flex items-center gap-2">
              <PlayButton tracks={persona.playlist} trackIdx={i} size="sm" />
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{t.title}</div>
                <div className="truncate text-xs text-muted-foreground">{t.artist}</div>
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {t.similarity.toFixed(2)}
              </span>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
