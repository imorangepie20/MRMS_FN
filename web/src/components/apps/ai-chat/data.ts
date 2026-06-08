// ─── Types ────────────────────────────────────────────────────────────────────

export type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: string // fixed display string, e.g. "10:02 AM"
}

export type Conversation = {
  id: string
  title: string
  preview: string
  timestamp: string
  messages: Message[]
}

// ─── Seeded History ───────────────────────────────────────────────────────────

export const SEEDED_CONVERSATIONS: Conversation[] = [
  {
    id: "conv-1",
    title: "Tech trends 2026",
    preview: "What are the biggest tech trends this year?",
    timestamp: "2 hours ago",
    messages: [
      {
        id: "m1-1",
        role: "user",
        content: "What are the biggest tech trends in 2026?",
        timestamp: "9:45 AM",
      },
      {
        id: "m1-2",
        role: "assistant",
        content:
          "The biggest tech trends in 2026 include ambient AI assistants deeply integrated into operating systems, spatial computing going mainstream, quantum computing reaching early commercial viability, and green-energy data centers becoming the norm. Edge inference has also exploded — most AI workloads now run locally on-device rather than in the cloud.",
        timestamp: "9:45 AM",
      },
      {
        id: "m1-3",
        role: "user",
        content: "Tell me more about ambient AI assistants.",
        timestamp: "9:47 AM",
      },
      {
        id: "m1-4",
        role: "assistant",
        content:
          "Ambient AI assistants are context-aware systems that run persistently in the background of your devices. Unlike previous voice assistants, they understand multi-turn context, proactively surface relevant information, and can take autonomous actions — scheduling meetings, drafting emails, or flagging important notifications — without an explicit prompt from the user.",
        timestamp: "9:48 AM",
      },
    ],
  },
  {
    id: "conv-2",
    title: "Debugging React",
    preview: "Why is my useEffect running twice?",
    timestamp: "Yesterday",
    messages: [
      {
        id: "m2-1",
        role: "user",
        content: "Why is my useEffect running twice in React 19?",
        timestamp: "3:12 PM",
      },
      {
        id: "m2-2",
        role: "assistant",
        content:
          "In React's Strict Mode (enabled by default in development), effects intentionally mount, unmount, and remount to help you find bugs caused by missing cleanup. In production or when Strict Mode is disabled, effects run only once. The fix is to add a proper cleanup function and design your effects to be idempotent.",
        timestamp: "3:12 PM",
      },
    ],
  },
  {
    id: "conv-3",
    title: "Travel ideas",
    preview: "Best destinations for a solo trip in Asia",
    timestamp: "2 days ago",
    messages: [
      {
        id: "m3-1",
        role: "user",
        content: "What are some great destinations for a solo trip in Asia?",
        timestamp: "11:00 AM",
      },
      {
        id: "m3-2",
        role: "assistant",
        content:
          "For solo travel in Asia, Japan (especially Kyoto and Osaka) tops most lists for its safety, excellent public transport, and rich culture. Vietnam's northern highlands around Sapa offer incredible trekking. Taiwan's night markets and friendly locals make it perfect for first-time solo travelers. Sri Lanka is an emerging gem with diverse landscapes in a compact space.",
        timestamp: "11:01 AM",
      },
    ],
  },
  {
    id: "conv-4",
    title: "Python vs TypeScript",
    preview: "Which should I learn first for backend?",
    timestamp: "3 days ago",
    messages: [
      {
        id: "m4-1",
        role: "user",
        content: "Should I learn Python or TypeScript first for backend development?",
        timestamp: "2:30 PM",
      },
      {
        id: "m4-2",
        role: "assistant",
        content:
          "It depends on your goals. Python has a gentler learning curve, dominates in data science and AI/ML, and has frameworks like FastAPI and Django. TypeScript (with Node.js) is a strong choice if you're already doing frontend work, since you share a language across the stack. For pure backend versatility and career breadth, Python edges ahead — but TypeScript is excellent if you want a unified JS/TS stack.",
        timestamp: "2:31 PM",
      },
    ],
  },
  {
    id: "conv-5",
    title: "Healthy meal prep",
    preview: "Quick meals to prep on Sundays",
    timestamp: "1 week ago",
    messages: [
      {
        id: "m5-1",
        role: "user",
        content: "What are some quick healthy meals I can prep on Sundays?",
        timestamp: "10:00 AM",
      },
      {
        id: "m5-2",
        role: "assistant",
        content:
          "Great Sunday prep staples include: grain bowls with quinoa or farro as a base, roasted sheet-pan vegetables, overnight oats for breakfasts, mason jar salads that stay crisp for 4 days, hard-boiled eggs, and a big batch of lentil or chickpea soup. Keep sauces (tahini, pesto, vinaigrette) separate to avoid sogginess.",
        timestamp: "10:01 AM",
      },
    ],
  },
]

// ─── Suggested Prompts ────────────────────────────────────────────────────────

export const SUGGESTED_PROMPTS: { id: string; text: string; description: string }[] = [
  {
    id: "sp-1",
    text: "What's the latest tech trend?",
    description: "Get a quick overview of emerging technology",
  },
  {
    id: "sp-2",
    text: "How does this work?",
    description: "Explain any concept in simple terms",
  },
  {
    id: "sp-3",
    text: "Write a poem about the sea",
    description: "Creative writing & storytelling",
  },
  {
    id: "sp-4",
    text: "Explain quantum computing",
    description: "Deep dive into complex topics",
  },
]

// ─── Available Models ─────────────────────────────────────────────────────────

export const AI_MODELS = [
  { value: "gpt-4o", label: "GPT-4o" },
  { value: "gpt-4o-mini", label: "GPT-4o mini" },
  { value: "claude-3-5", label: "Claude 3.5" },
  { value: "gemini-pro", label: "Gemini Pro" },
]

// ─── Mock Reply Helper ────────────────────────────────────────────────────────

const MOCK_REPLIES: Record<string, string> = {
  "what's the latest tech trend?":
    "The hottest trend right now is ambient AI — systems that run persistently on your devices, understand context without being prompted, and take autonomous actions like scheduling or drafting emails. Spatial computing and on-device inference are close behind.",
  "how does this work?":
    "Great question! At a high level, most modern systems work by breaking a complex problem into smaller pieces, processing each piece with specialized components, and then combining the results. If you have a specific topic in mind, I can give you a much more detailed explanation.",
  "write a poem about the sea":
    `The sea calls in a language older than names,\nIn salt and foam and ancient tidal games.\nIt pulls the moon, it cradles ships to sleep,\nAnd guards its secrets in the dark, the deep.\n\nWe stand at shores uncertain, small, and bright,\nAnd cast our dreams like stones into the night.`,
  "explain quantum computing":
    "Quantum computing harnesses quantum mechanical phenomena — superposition (a qubit can be 0 and 1 simultaneously) and entanglement (qubits can be correlated across any distance). This lets a quantum computer explore a vast solution space in parallel rather than step by step. For problems like factoring huge numbers or simulating molecular chemistry, this gives an exponential speedup over classical computers.",
}

const FALLBACK_REPLIES = [
  "That's a fascinating question. Let me think through it carefully. The core idea here involves balancing multiple considerations — efficiency, clarity, and long-term maintainability. My recommendation would be to start with the simplest approach that solves the immediate problem, then iterate as you learn more.",
  "Great point! There are a few different angles to consider here. From a practical standpoint, the most effective approach tends to be the one with the least friction for your specific context. I'd be happy to dive deeper into any aspect of this.",
  "I appreciate you asking about this. This is an area where the nuances matter quite a bit. The short answer is: it depends on your constraints and goals. Would you like me to walk through the trade-offs in more detail?",
  "Interesting! This touches on some deep principles. At the core of it, what you're describing is a classic tension between two valid approaches. The key is to identify which constraints are truly fixed and which have flexibility.",
]

let _fallbackIndex = 0

export function getMockReply(prompt: string): string {
  const key = prompt.trim().toLowerCase()
  if (MOCK_REPLIES[key]) return MOCK_REPLIES[key]
  const reply = FALLBACK_REPLIES[_fallbackIndex % FALLBACK_REPLIES.length]
  _fallbackIndex += 1
  return reply
}
