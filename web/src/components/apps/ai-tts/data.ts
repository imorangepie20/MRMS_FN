// ─── Types ────────────────────────────────────────────────────────────────────

export type Clip = {
  id: string
  text: string
  voice: string
  language: string
  speed: number
  pitch: number
  duration: string
  timestamp: string
}

// ─── Voice Options ────────────────────────────────────────────────────────────

export const VOICES = [
  { value: "aria", label: "Aria", descriptor: "Female · US" },
  { value: "roger", label: "Roger", descriptor: "Male · US" },
  { value: "sarah", label: "Sarah", descriptor: "Female · UK" },
  { value: "liam", label: "Liam", descriptor: "Male · UK" },
  { value: "charlotte", label: "Charlotte", descriptor: "Female · AU" },
  { value: "george", label: "George", descriptor: "Male · AU" },
]

// ─── Language Options ─────────────────────────────────────────────────────────

export const LANGUAGES = [
  { value: "en-us", label: "English (US)" },
  { value: "en-gb", label: "English (UK)" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "ja", label: "Japanese" },
]

// ─── Fixed Waveform Bar Heights ───────────────────────────────────────────────
// 48 deterministic heights (px) — no Math.random() in render

export const WAVEFORM_BARS: number[] = [
  18, 28, 38, 52, 44, 36, 60, 48, 32, 56, 40, 24, 50, 62, 46, 34,
  58, 42, 26, 54, 66, 48, 30, 52, 38, 22, 44, 64, 50, 36, 60, 42,
  28, 56, 40, 20, 46, 62, 48, 32, 54, 38, 24, 50, 64, 44, 30, 58,
]

// ─── Seeded Clips ─────────────────────────────────────────────────────────────

export const SEEDED_CLIPS: Clip[] = [
  {
    id: "clip-seed-1",
    text: "Welcome to the future of voice synthesis. Our cutting-edge AI transforms your words into natural-sounding speech.",
    voice: "aria",
    language: "en-us",
    speed: 1.0,
    pitch: 0,
    duration: "0:08",
    timestamp: "Jun 7, 2026, 2:30 PM",
  },
  {
    id: "clip-seed-2",
    text: "The quick brown fox jumps over the lazy dog. Pack my box with five dozen liquor jugs.",
    voice: "roger",
    language: "en-us",
    speed: 1.0,
    pitch: 0,
    duration: "0:06",
    timestamp: "Jun 7, 2026, 2:15 PM",
  },
  {
    id: "clip-seed-3",
    text: "Good morning! Today's weather forecast shows sunny skies with a high of 72 degrees Fahrenheit.",
    voice: "sarah",
    language: "en-gb",
    speed: 0.9,
    pitch: 2,
    duration: "0:07",
    timestamp: "Jun 7, 2026, 1:58 PM",
  },
]
