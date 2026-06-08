// ─── Types ────────────────────────────────────────────────────────────────────

export type GeneratedImage = {
  id: string
  prompt: string
  negativePrompt?: string
  style: string
  aspectRatio: string
  quality: string
  seed?: string
  timestamp: string
  gradientIndex: number
}

// ─── Options ──────────────────────────────────────────────────────────────────

export const STYLES = [
  { value: "realistic", label: "Realistic" },
  { value: "digital-art", label: "Digital Art" },
  { value: "photographic", label: "Photographic" },
  { value: "abstract", label: "Abstract" },
  { value: "anime", label: "Anime" },
  { value: "3d-render", label: "3D Render" },
]

export const ASPECT_RATIOS = [
  { value: "1:1", label: "1:1 (Square)" },
  { value: "16:9", label: "16:9 (Landscape)" },
  { value: "9:16", label: "9:16 (Portrait)" },
  { value: "4:3", label: "4:3 (Standard)" },
]

export const QUALITY_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "hd", label: "HD" },
]

export const QUICK_PROMPTS = [
  "Futuristic City",
  "Fantasy Dragon",
  "Abstract Art",
  "Nature Scene",
]

// ─── Gradient Palette ─────────────────────────────────────────────────────────
// Fixed palette — pick by index to avoid Math.random() in render

export const GRADIENTS = [
  "from-violet-600 via-purple-500 to-indigo-600",
  "from-orange-500 via-rose-500 to-pink-600",
  "from-emerald-500 via-teal-500 to-cyan-600",
  "from-amber-500 via-orange-500 to-red-500",
  "from-blue-600 via-indigo-500 to-purple-600",
  "from-pink-500 via-fuchsia-500 to-violet-600",
  "from-teal-500 via-cyan-500 to-sky-600",
  "from-lime-500 via-green-500 to-emerald-600",
]

// ─── Seeded Results ───────────────────────────────────────────────────────────

export const SEEDED_IMAGES: GeneratedImage[] = [
  {
    id: "img-seed-1",
    prompt: "Cyberpunk cityscape at night with neon lights and flying cars",
    style: "digital-art",
    aspectRatio: "16:9",
    quality: "hd",
    timestamp: "Jun 6, 2026, 11:42 PM",
    gradientIndex: 0,
  },
  {
    id: "img-seed-2",
    prompt: "Majestic mountain landscape with snow-capped peaks and aurora borealis",
    style: "photographic",
    aspectRatio: "16:9",
    quality: "hd",
    timestamp: "Jun 6, 2026, 11:30 PM",
    gradientIndex: 2,
  },
  {
    id: "img-seed-3",
    prompt: "Majestic eagle soaring over a misty forest at golden hour",
    style: "realistic",
    aspectRatio: "1:1",
    quality: "standard",
    timestamp: "Jun 6, 2026, 10:55 PM",
    gradientIndex: 3,
  },
  {
    id: "img-seed-4",
    prompt: "Vibrant abstract geometric composition with flowing shapes and colors",
    style: "abstract",
    aspectRatio: "1:1",
    quality: "standard",
    timestamp: "Jun 6, 2026, 10:20 PM",
    gradientIndex: 5,
  },
]
