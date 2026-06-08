"use client"

import { useState } from "react"
import { Sparkles, Download, ImageIcon, Wand2, RefreshCw } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  STYLES,
  ASPECT_RATIOS,
  QUALITY_OPTIONS,
  QUICK_PROMPTS,
  GRADIENTS,
  SEEDED_IMAGES,
  type GeneratedImage,
} from "./data"

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _idCounter = 0
function newId(): string {
  _idCounter += 1
  return `img-gen-${_idCounter}`
}

function getAspectRatioClass(ratio: string): string {
  switch (ratio) {
    case "16:9":
      return "aspect-video"
    case "9:16":
      return "aspect-[9/16]"
    case "4:3":
      return "aspect-[4/3]"
    default:
      return "aspect-square"
  }
}

function getStyleLabel(value: string): string {
  return STYLES.find((s) => s.value === value)?.label ?? value
}

// ─── Image Card ───────────────────────────────────────────────────────────────

function ImageCard({ image }: { image: GeneratedImage }) {
  const gradient = GRADIENTS[image.gradientIndex % GRADIENTS.length]
  const aspectClass = getAspectRatioClass(image.aspectRatio)

  return (
    <div className="group relative overflow-hidden rounded-xl ring-1 ring-foreground/10">
      {/* Gradient placeholder */}
      <div
        className={cn(
          "w-full bg-gradient-to-br",
          gradient,
          aspectClass
        )}
      />

      {/* Download button (hover) */}
      <button
        className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-md bg-black/40 text-white opacity-0 backdrop-blur-sm transition-opacity hover:bg-black/60 group-hover:opacity-100"
        aria-label="Download image"
      >
        <Download className="size-3.5" />
      </button>

      {/* Info overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent p-3">
        <p className="mb-1.5 line-clamp-2 text-xs font-medium text-white/90">
          {image.prompt}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge
            variant="secondary"
            className="h-5 bg-white/20 px-1.5 text-[10px] text-white backdrop-blur-sm"
          >
            {getStyleLabel(image.style)}
          </Badge>
          <span className="text-[10px] text-white/70">{image.aspectRatio}</span>
          <span className="ml-auto text-[10px] text-white/50">
            {image.timestamp}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ImageGeneratorApp() {
  const [prompt, setPrompt] = useState("")
  const [negativePrompt, setNegativePrompt] = useState("")
  const [style, setStyle] = useState("realistic")
  const [aspectRatio, setAspectRatio] = useState("1:1")
  const [quality, setQuality] = useState("standard")
  const [numImages, setNumImages] = useState(4)
  const [seed, setSeed] = useState("")
  const [images, setImages] = useState<GeneratedImage[]>(SEEDED_IMAGES)
  const [isGenerating, setIsGenerating] = useState(false)

  // ─── Handlers ────────────────────────────────────────────────────────────

  function handleGenerate() {
    if (!prompt.trim()) return
    setIsGenerating(true)

    // Simulate async generation delay
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

      const newImages: GeneratedImage[] = Array.from({ length: numImages }, (_, i) => ({
        id: newId(),
        prompt: prompt.trim(),
        negativePrompt: negativePrompt.trim() || undefined,
        style,
        aspectRatio,
        quality,
        seed: seed.trim() || undefined,
        timestamp: formatted,
        // Cycle through gradient palette based on current total count + position
        gradientIndex: (images.length + i) % GRADIENTS.length,
      }))

      setImages((prev) => [...newImages, ...prev])
      setIsGenerating(false)
    }, 800)
  }

  function handleQuickPrompt(text: string) {
    setPrompt(text)
  }

  function handleDownloadAll() {
    // Simulated — no actual download in frontend-only mode
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full gap-4 p-4">
      {/* ── Left Controls Panel ─────────────────────────────────────────── */}
      <Card className="flex h-full w-80 shrink-0 flex-col overflow-y-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wand2 className="size-4 text-primary" />
            Image Settings
          </CardTitle>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {/* Prompt */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prompt">Prompt</Label>
            <Textarea
              id="prompt"
              placeholder="Be specific and descriptive for better results"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[90px] resize-none"
            />
          </div>

          {/* Negative Prompt */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="negative-prompt">
              Negative Prompt{" "}
              <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="negative-prompt"
              placeholder="What to exclude from the image"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              className="min-h-[60px] resize-none text-sm"
            />
          </div>

          <Separator />

          {/* Style */}
          <div className="flex flex-col gap-1.5">
            <Label>Style</Label>
            <Select
              value={style}
              onValueChange={(v) => { if (v != null) setStyle(v) }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select style" />
              </SelectTrigger>
              <SelectContent>
                {STYLES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Aspect Ratio */}
          <div className="flex flex-col gap-1.5">
            <Label>Aspect Ratio</Label>
            <Select
              value={aspectRatio}
              onValueChange={(v) => { if (v != null) setAspectRatio(v) }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select ratio" />
              </SelectTrigger>
              <SelectContent>
                {ASPECT_RATIOS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quality */}
          <div className="flex flex-col gap-1.5">
            <Label>Quality</Label>
            <Select
              value={quality}
              onValueChange={(v) => { if (v != null) setQuality(v) }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select quality" />
              </SelectTrigger>
              <SelectContent>
                {QUALITY_OPTIONS.map((q) => (
                  <SelectItem key={q.value} value={q.value}>
                    {q.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Number of Images */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Number of Images</Label>
              <span className="text-sm font-medium tabular-nums">{numImages}</span>
            </div>
            <Slider
              min={1}
              max={4}
              value={[numImages]}
              onValueChange={(v) => {
                if (Array.isArray(v) && v[0] != null) setNumImages(v[0])
              }}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1</span>
              <span>4</span>
            </div>
          </div>

          {/* Seed */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="seed">
              Seed{" "}
              <span className="text-xs text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="seed"
              type="number"
              placeholder="Random seed for reproducibility"
              value={seed}
              onChange={(e) => setSeed(e.target.value)}
            />
          </div>

          <Separator />

          {/* Quick Prompts */}
          <div className="flex flex-col gap-2">
            <Label>Quick Prompts</Label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((qp) => (
                <button
                  key={qp}
                  onClick={() => handleQuickPrompt(qp)}
                  className={cn(
                    "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    prompt === qp
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  )}
                >
                  {qp}
                </button>
              ))}
            </div>
          </div>

          {/* Generate Button */}
          <Button
            className="mt-2 w-full"
            onClick={handleGenerate}
            disabled={!prompt.trim() || isGenerating}
          >
            {isGenerating ? (
              <>
                <RefreshCw className="mr-2 size-4 animate-spin" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="mr-2 size-4" />
                Generate
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* ── Right Gallery ────────────────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {/* Gallery Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold">Results</h2>
            {images.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {images.length}
              </Badge>
            )}
          </div>
          {images.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadAll}
              className="gap-1.5"
            >
              <Download className="size-3.5" />
              Download All
            </Button>
          )}
        </div>

        {/* Gallery Grid or Empty State */}
        {images.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <ImageIcon className="size-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium">No images yet</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Enter a prompt and click Generate to create images
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 overflow-y-auto pb-4">
            {images.map((image) => (
              <ImageCard key={image.id} image={image} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
