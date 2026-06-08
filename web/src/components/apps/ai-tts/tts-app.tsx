"use client"

import { useState } from "react"
import {
  Sparkles,
  Play,
  Pause,
  Download,
  AudioLines,
  Volume2,
  RefreshCw,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"

import {
  VOICES,
  LANGUAGES,
  WAVEFORM_BARS,
  SEEDED_CLIPS,
  type Clip,
} from "./data"

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _idCounter = 0
function newId(): string {
  _idCounter += 1
  return `clip-gen-${_idCounter}`
}

/** Estimate duration from character count (~14 chars/sec at 1x speed) */
function estimateDuration(text: string, speed: number): string {
  const chars = text.trim().length
  const seconds = Math.max(1, Math.round(chars / (14 * speed)))
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, "0")}`
}

function getVoiceLabel(value: string): string {
  return VOICES.find((v) => v.value === value)?.label ?? value
}

// ─── Waveform ─────────────────────────────────────────────────────────────────

function Waveform({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div className="flex h-16 items-end gap-[3px]">
      {WAVEFORM_BARS.map((h, i) => (
        <div
          key={i}
          className={cn(
            "w-1 shrink-0 rounded-full bg-primary/60 transition-all duration-150",
            isPlaying && "animate-pulse"
          )}
          style={{
            height: `${h}px`,
            animationDelay: isPlaying ? `${(i * 30) % 600}ms` : "0ms",
            opacity: isPlaying ? 0.5 + (i % 3) * 0.2 : 0.45,
          }}
        />
      ))}
    </div>
  )
}

// ─── History Row ──────────────────────────────────────────────────────────────

function HistoryRow({
  clip,
  isActive,
  isPlaying,
  onSelect,
  onPlayPause,
}: {
  clip: Clip
  isActive: boolean
  isPlaying: boolean
  onSelect: () => void
  onPlayPause: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
      className={cn(
        "group flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "hover:bg-muted/60"
      )}
    >
      {/* Icon */}
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <AudioLines className="size-3.5" />
      </div>

      {/* Text + meta */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium leading-snug">
          {clip.text.length > 60 ? clip.text.slice(0, 60) + "…" : clip.text}
        </p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">
          {getVoiceLabel(clip.voice)} · {clip.duration} · {clip.timestamp}
        </p>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={(e) => {
            e.stopPropagation()
            onPlayPause()
          }}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying && isActive ? (
            <Pause className="size-3.5" />
          ) : (
            <Play className="size-3.5" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={(e) => e.stopPropagation()}
          aria-label="Download"
        >
          <Download className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function TtsApp() {
  // ── Editor state ────────────────────────────────────────────────────────
  const [text, setText] = useState("")
  const [voice, setVoice] = useState("aria")
  const [language, setLanguage] = useState("en-us")
  const [speed, setSpeed] = useState(1.0)
  const [pitch, setPitch] = useState(0)
  const [isGenerating, setIsGenerating] = useState(false)

  // ── Output state ────────────────────────────────────────────────────────
  const [clips, setClips] = useState<Clip[]>(SEEDED_CLIPS)
  const [selectedId, setSelectedId] = useState<string>(SEEDED_CLIPS[0]?.id ?? "")
  const [playingId, setPlayingId] = useState<string | null>(null)

  const MAX_CHARS = 5000
  const selectedClip = clips.find((c) => c.id === selectedId) ?? null

  // ── Handlers ─────────────────────────────────────────────────────────────

  function handleGenerate() {
    if (!text.trim()) return
    setIsGenerating(true)

    setTimeout(() => {
      const now = new Date()
      const formatted = now.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })

      const newClip: Clip = {
        id: newId(),
        text: text.trim(),
        voice,
        language,
        speed,
        pitch,
        duration: estimateDuration(text, speed),
        timestamp: formatted,
      }

      setClips((prev) => [newClip, ...prev])
      setSelectedId(newClip.id)
      setPlayingId(null)
      setIsGenerating(false)
    }, 700)
  }

  function handlePlayPause(id: string) {
    setSelectedId(id)
    setPlayingId((prev) => (prev === id ? null : id))
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full gap-4 p-4">
      {/* ── Left: Controls + Editor ───────────────────────────────────────── */}
      <Card className="flex h-full w-80 shrink-0 flex-col overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="size-4 text-primary" />
            Text to Speech
          </CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {/* Text Input */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="tts-text">Text</Label>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  text.length > MAX_CHARS * 0.9
                    ? "text-destructive"
                    : "text-muted-foreground"
                )}
              >
                {text.length} / {MAX_CHARS}
              </span>
            </div>
            <Textarea
              id="tts-text"
              placeholder="Enter the text you want to convert to speech…"
              value={text}
              onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
              className="min-h-[140px] resize-none"
            />
          </div>

          <Separator />

          {/* Voice */}
          <div className="flex flex-col gap-1.5">
            <Label>Voice</Label>
            <Select
              value={voice}
              onValueChange={(v) => { if (v != null) setVoice(v) }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select voice" />
              </SelectTrigger>
              <SelectContent>
                {VOICES.map((v) => (
                  <SelectItem key={v.value} value={v.value}>
                    {v.label}
                    <span className="ml-1 text-xs text-muted-foreground">
                      · {v.descriptor}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Language */}
          <div className="flex flex-col gap-1.5">
            <Label>Language</Label>
            <Select
              value={language}
              onValueChange={(v) => { if (v != null) setLanguage(v) }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map((l) => (
                  <SelectItem key={l.value} value={l.value}>
                    {l.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Speed */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Speed</Label>
              <span className="text-sm font-medium tabular-nums">
                {speed.toFixed(1)}×
              </span>
            </div>
            <Slider
              min={0.5}
              max={2}
              step={0.1}
              value={[speed]}
              onValueChange={(v) => {
                if (Array.isArray(v) && v[0] != null) setSpeed(v[0])
              }}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0.5×</span>
              <span>2×</span>
            </div>
          </div>

          {/* Pitch */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Pitch</Label>
              <span className="text-sm font-medium tabular-nums">
                {pitch > 0 ? `+${pitch}` : pitch}
              </span>
            </div>
            <Slider
              min={-12}
              max={12}
              step={1}
              value={[pitch]}
              onValueChange={(v) => {
                if (Array.isArray(v) && v[0] != null) setPitch(v[0])
              }}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>-12</span>
              <span>+12</span>
            </div>
          </div>

          {/* Generate Button */}
          <Button
            className="mt-2 w-full"
            onClick={handleGenerate}
            disabled={!text.trim() || isGenerating}
          >
            {isGenerating ? (
              <>
                <RefreshCw className="mr-2 size-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-4" />
                Generate Speech
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ── Right: Player + History ───────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {/* Player Card */}
        {selectedClip ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AudioLines className="size-4 text-primary" />
                Now Playing
                <Badge variant="secondary" className="ml-auto text-xs">
                  {getVoiceLabel(selectedClip.voice)} · {selectedClip.duration}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {/* Text snippet */}
              <p className="line-clamp-2 text-sm text-muted-foreground">
                {selectedClip.text}
              </p>

              {/* Waveform */}
              <div className="overflow-hidden rounded-lg bg-muted/40 px-4 py-3">
                <Waveform isPlaying={playingId === selectedClip.id} />
              </div>

              {/* Controls */}
              <div className="flex items-center justify-between">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePlayPause(selectedClip.id)}
                  className="gap-1.5"
                >
                  {playingId === selectedClip.id ? (
                    <>
                      <Pause className="size-3.5" />
                      Pause
                    </>
                  ) : (
                    <>
                      <Play className="size-3.5" />
                      Play
                    </>
                  )}
                </Button>
                <Button variant="ghost" size="sm" className="gap-1.5">
                  <Download className="size-3.5" />
                  Download
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Volume2 className="size-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">No clip selected</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Generate speech or select a clip from history
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* History */}
        <Card className="flex min-h-0 flex-1 flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              History
              {clips.length > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {clips.length}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="min-h-0 flex-1 overflow-y-auto pb-2">
            {clips.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <p className="text-sm text-muted-foreground">No clips yet</p>
                <p className="text-xs text-muted-foreground">
                  Generated clips will appear here
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-0.5">
                {clips.map((clip) => (
                  <HistoryRow
                    key={clip.id}
                    clip={clip}
                    isActive={selectedId === clip.id}
                    isPlaying={playingId === clip.id}
                    onSelect={() => setSelectedId(clip.id)}
                    onPlayPause={() => handlePlayPause(clip.id)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
