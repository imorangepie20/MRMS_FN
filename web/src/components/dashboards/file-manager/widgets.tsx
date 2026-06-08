import {
  FileText,
  ImageIcon,
  Video,
  File,
  Folder,
  MoreHorizontal,
  Star,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { fileTypeCards, folders } from "./data";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fileTypeIcon(type: string) {
  switch (type) {
    case "Documents": return <FileText className="size-5 text-blue-500" />;
    case "Images":    return <ImageIcon className="size-5 text-purple-500" />;
    case "Videos":    return <Video     className="size-5 text-rose-500" />;
    default:          return <File      className="size-5 text-muted-foreground" />;
  }
}

// ─── File Type Cards (4 small cards) ─────────────────────────────────────────

export function FileTypeCards() {
  return (
    <>
      {fileTypeCards.map((card) => (
        <Card key={card.type}>
          <CardContent className="flex flex-col gap-3 pt-4">
            <div className="flex items-center gap-2">
              {fileTypeIcon(card.type)}
              <span className="font-medium">{card.type}</span>
            </div>
            <div>
              <p className="text-xl font-semibold tabular-nums">{card.items}</p>
              <p className="text-xs text-muted-foreground">{card.size}</p>
            </div>
            <Progress value={card.progress} className="h-1.5" />
          </CardContent>
        </Card>
      ))}
    </>
  );
}

// ─── Folder Cards ─────────────────────────────────────────────────────────────

export function FolderCards() {
  return (
    <>
      {folders.map((folder) => (
        <Card key={folder.name}>
          <CardContent className="flex flex-col gap-3 pt-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Folder className="size-5 text-amber-500" />
                <span className="font-medium">{folder.name}</span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon-sm">
                      <MoreHorizontal className="size-4" />
                      <span className="sr-only">Folder actions</span>
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem>
                    <Star className="size-4" />
                    Star
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Open</DropdownMenuItem>
                  <DropdownMenuItem>Rename</DropdownMenuItem>
                  <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div>
              <p className="text-sm font-medium tabular-nums">{folder.items}</p>
              <p className="text-xs text-muted-foreground">Last update: {folder.lastUpdate}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}

// ─── Storage Space Card ───────────────────────────────────────────────────────

export function StorageSpaceCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Storage Space Used</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="relative flex size-32 items-center justify-center">
            {/* Circular progress via SVG */}
            <svg className="absolute inset-0 size-full -rotate-90" viewBox="0 0 120 120">
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="10"
              />
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 50}`}
                strokeDashoffset={`${2 * Math.PI * 50 * (1 - 0.6)}`}
              />
            </svg>
            <div className="flex flex-col items-center">
              <span className="text-2xl font-semibold tabular-nums">60%</span>
              <span className="text-xs text-muted-foreground">Used</span>
            </div>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium">1.8 GB used</p>
            <p className="text-xs text-muted-foreground">of 3 GB total</p>
          </div>
        </div>
        <Progress value={60} className="h-2" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>0 GB</span>
          <span>3 GB</span>
        </div>
      </CardContent>
    </Card>
  );
}
