// ─── Types ────────────────────────────────────────────────────────────────────

export type Post = {
  id: string
  author: {
    displayName: string
    handle: string
    initials: string
    avatarColor: string
  }
  content: string
  relativeTime: string
  likes: number
  comments: number
  shares: number
  hasMedia: boolean
  mediaGradient?: string
}

export type SuggestedUser = {
  id: string
  displayName: string
  handle: string
  initials: string
  avatarColor: string
}

export type TrendingArtist = {
  id: string
  name: string
  initials: string
  avatarColor: string
  followers: string
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

export const CURRENT_USER = {
  displayName: "You",
  handle: "me",
  initials: "YO",
  avatarColor: "bg-violet-500",
}

export const INITIAL_POSTS: Post[] = [
  {
    id: "post-1",
    author: {
      displayName: "crunchtech",
      handle: "crunchtech",
      initials: "CT",
      avatarColor: "bg-sky-500",
    },
    content: "Just shipped a new photography portfolio 📸",
    relativeTime: "1m",
    likes: 1243,
    comments: 89,
    shares: 12,
    hasMedia: true,
    mediaGradient: "from-sky-400 via-blue-500 to-indigo-600",
  },
  {
    id: "post-2",
    author: {
      displayName: "thoughts_daily",
      handle: "thoughts",
      initials: "TD",
      avatarColor: "bg-amber-500",
    },
    content: "Small progress is still progress. Keep going.",
    relativeTime: "15m",
    likes: 892,
    comments: 45,
    shares: 8,
    hasMedia: false,
  },
  {
    id: "post-3",
    author: {
      displayName: "travel_vibes",
      handle: "travel",
      initials: "TV",
      avatarColor: "bg-emerald-500",
    },
    content: "Sunset over the Alps never gets old 🏔️",
    relativeTime: "1h",
    likes: 3421,
    comments: 210,
    shares: 95,
    hasMedia: true,
    mediaGradient: "from-orange-400 via-rose-400 to-purple-600",
  },
  {
    id: "post-4",
    author: {
      displayName: "foodie_paradise",
      handle: "foodie",
      initials: "FP",
      avatarColor: "bg-rose-500",
    },
    content: "Homemade pizza night! Recipe in comments 🍕",
    relativeTime: "2h",
    likes: 2156,
    comments: 178,
    shares: 34,
    hasMedia: true,
    mediaGradient: "from-yellow-400 via-orange-400 to-red-500",
  },
  {
    id: "post-5",
    author: {
      displayName: "dev_community",
      handle: "devs",
      initials: "DC",
      avatarColor: "bg-violet-500",
    },
    content: "5 TypeScript tips that will level up your code 🧵",
    relativeTime: "3h",
    likes: 4521,
    comments: 412,
    shares: 156,
    hasMedia: false,
  },
]

export const SUGGESTED_USERS: SuggestedUser[] = [
  {
    id: "sug-1",
    displayName: "Azunyan Senpai",
    handle: "azunyan",
    initials: "AS",
    avatarColor: "bg-pink-500",
  },
  {
    id: "sug-2",
    displayName: "Oarack Babama",
    handle: "obama",
    initials: "OB",
    avatarColor: "bg-blue-600",
  },
  {
    id: "sug-3",
    displayName: "David Gilmore",
    handle: "dgilmore",
    initials: "DG",
    avatarColor: "bg-teal-500",
  },
  {
    id: "sug-4",
    displayName: "Luna Starfield",
    handle: "lunastar",
    initials: "LS",
    avatarColor: "bg-indigo-500",
  },
]

export const TRENDING_ARTISTS: TrendingArtist[] = [
  {
    id: "art-1",
    name: "Saylor Twift",
    initials: "ST",
    avatarColor: "bg-red-400",
    followers: "12.4M",
  },
  {
    id: "art-2",
    name: "Frank Iero",
    initials: "FI",
    avatarColor: "bg-slate-600",
    followers: "8.9M",
  },
  {
    id: "art-3",
    name: "Charlie XXX",
    initials: "CX",
    avatarColor: "bg-purple-500",
    followers: "6.2M",
  },
  {
    id: "art-4",
    name: "Star Warz",
    initials: "SW",
    avatarColor: "bg-yellow-500",
    followers: "4.7M",
  },
]
