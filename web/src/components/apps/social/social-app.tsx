"use client"

import { useState } from "react"
import {
  Heart,
  MessageCircle,
  Share2,
  Image as ImageIcon,
  MoreHorizontal,
  Smile,
  Video,
  Users,
  TrendingUp,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import {
  INITIAL_POSTS,
  SUGGESTED_USERS,
  TRENDING_ARTISTS,
  CURRENT_USER,
  type Post,
} from "./data"

// ─── Counter ──────────────────────────────────────────────────────────────────

let _postCounter = 0
function newPostId(): string {
  _postCounter += 1
  return `post-new-${_postCounter}`
}

// ─── Format count ─────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return String(n)
}

// ─── Post Card ────────────────────────────────────────────────────────────────

interface PostCardProps {
  post: Post
  liked: boolean
  likeCount: number
  onLike: () => void
}

function PostCard({ post, liked, likeCount, onLike }: PostCardProps) {
  return (
    <Card className="w-full">
      <CardHeader className="flex-row items-center gap-3">
        <Avatar>
          <AvatarFallback className={cn("text-white text-xs font-semibold", post.author.avatarColor)}>
            {post.author.initials}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm leading-tight truncate">
              {post.author.displayName}
            </span>
            <span className="text-muted-foreground text-xs shrink-0">·</span>
            <span className="text-muted-foreground text-xs shrink-0">{post.relativeTime}</span>
          </div>
          <div className="text-muted-foreground text-xs">@{post.author.handle}</div>
        </div>
        <Button variant="ghost" size="icon-sm" className="shrink-0 text-muted-foreground">
          <MoreHorizontal />
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-sm leading-relaxed">{post.content}</p>
        {post.hasMedia && (
          <div
            className={cn(
              "h-64 w-full rounded-lg bg-gradient-to-br",
              post.mediaGradient ?? "from-muted to-muted/50"
            )}
          />
        )}
      </CardContent>

      <CardFooter className="gap-0 px-(--card-spacing) py-2">
        <button
          onClick={onLike}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted",
            liked ? "text-red-500" : "text-muted-foreground"
          )}
          type="button"
        >
          <Heart
            className={cn(
              "size-4 transition-all",
              liked ? "fill-red-500 text-red-500 scale-110" : ""
            )}
          />
          {formatCount(likeCount)}
        </button>

        <button
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          type="button"
        >
          <MessageCircle className="size-4" />
          {formatCount(post.comments)}
        </button>

        <button
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted"
          type="button"
        >
          <Share2 className="size-4" />
          {formatCount(post.shares)}
        </button>
      </CardFooter>
    </Card>
  )
}

// ─── Create Post Box ──────────────────────────────────────────────────────────

interface CreatePostBoxProps {
  value: string
  onChange: (val: string) => void
  onPost: () => void
}

function CreatePostBox({ value, onChange, onPost }: CreatePostBoxProps) {
  return (
    <Card className="w-full">
      <CardContent className="space-y-3">
        <div className="flex gap-3">
          <Avatar className="mt-0.5 shrink-0">
            <AvatarFallback className={cn("text-white text-xs font-semibold", CURRENT_USER.avatarColor)}>
              {CURRENT_USER.initials}
            </AvatarFallback>
          </Avatar>
          <Textarea
            placeholder="What's on your mind?"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-[72px] resize-none border-none bg-transparent px-0 shadow-none focus-visible:ring-0 focus-visible:border-none"
          />
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground">
              <ImageIcon />
            </Button>
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground">
              <Video />
            </Button>
            <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground">
              <Smile />
            </Button>
          </div>
          <Button
            size="sm"
            onClick={onPost}
            disabled={!value.trim()}
          >
            Post
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ─── Suggestions Sidebar Card ─────────────────────────────────────────────────

function SuggestionsSidebar() {
  const [following, setFollowing] = useState<Set<string>>(() => new Set())

  function toggleFollow(id: string) {
    setFollowing((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  return (
    <Card className="w-full">
      <CardHeader className="border-b pb-(--card-spacing)">
        <div className="flex items-center gap-2">
          <Users className="size-4 text-muted-foreground" />
          <CardTitle>Suggestions for You</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 pt-(--card-spacing)">
        {SUGGESTED_USERS.map((user) => (
          <div key={user.id} className="flex items-center gap-3 py-1.5">
            <Avatar size="sm">
              <AvatarFallback className={cn("text-white text-xs font-semibold", user.avatarColor)}>
                {user.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium leading-tight truncate">{user.displayName}</div>
              <div className="text-xs text-muted-foreground">@{user.handle}</div>
            </div>
            <Button
              variant={following.has(user.id) ? "secondary" : "outline"}
              size="xs"
              onClick={() => toggleFollow(user.id)}
              className="shrink-0"
            >
              {following.has(user.id) ? "Following" : "Follow"}
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ─── Trending Artists Sidebar Card ────────────────────────────────────────────

function TrendingArtistsSidebar() {
  return (
    <Card className="w-full">
      <CardHeader className="border-b pb-(--card-spacing)">
        <div className="flex items-center gap-2">
          <TrendingUp className="size-4 text-muted-foreground" />
          <CardTitle>Trending Artists</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-1 pt-(--card-spacing)">
        {TRENDING_ARTISTS.map((artist, idx) => (
          <div key={artist.id} className="flex items-center gap-3 py-1.5">
            <div className="flex items-center gap-2.5 flex-1 min-w-0">
              <span className="text-xs text-muted-foreground w-4 shrink-0 text-center font-medium">
                {idx + 1}
              </span>
              <Avatar size="sm">
                <AvatarFallback className={cn("text-white text-xs font-semibold", artist.avatarColor)}>
                  {artist.initials}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="text-sm font-medium leading-tight truncate">{artist.name}</div>
                <div className="text-xs text-muted-foreground">{artist.followers} followers</div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export function SocialApp() {
  const [posts, setPosts] = useState<Post[]>(INITIAL_POSTS)
  const [likedIds, setLikedIds] = useState<Set<string>>(() => new Set())
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>(() =>
    Object.fromEntries(INITIAL_POSTS.map((p) => [p.id, p.likes]))
  )
  const [draftText, setDraftText] = useState("")

  function handleLike(postId: string) {
    setLikedIds((prev) => {
      const next = new Set(prev)
      if (next.has(postId)) {
        next.delete(postId)
        setLikeCounts((counts) => ({ ...counts, [postId]: (counts[postId] ?? 0) - 1 }))
      } else {
        next.add(postId)
        setLikeCounts((counts) => ({ ...counts, [postId]: (counts[postId] ?? 0) + 1 }))
      }
      return next
    })
  }

  function handlePost() {
    const text = draftText.trim()
    if (!text) return

    const newPost: Post = {
      id: newPostId(),
      author: {
        displayName: CURRENT_USER.displayName,
        handle: CURRENT_USER.handle,
        initials: CURRENT_USER.initials,
        avatarColor: CURRENT_USER.avatarColor,
      },
      content: text,
      relativeTime: "just now",
      likes: 0,
      comments: 0,
      shares: 0,
      hasMedia: false,
    }

    setPosts((prev) => [newPost, ...prev])
    setLikeCounts((counts) => ({ ...counts, [newPost.id]: 0 }))
    setDraftText("")
  }

  return (
    <div className="flex flex-1 gap-6 p-6">
      {/* Center Feed */}
      <div className="flex flex-1 flex-col gap-4 min-w-0">
        <CreatePostBox
          value={draftText}
          onChange={setDraftText}
          onPost={handlePost}
        />
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            liked={likedIds.has(post.id)}
            likeCount={likeCounts[post.id] ?? post.likes}
            onLike={() => handleLike(post.id)}
          />
        ))}
      </div>

      {/* Right Sidebar */}
      <aside className="hidden lg:flex flex-col gap-4 w-72 shrink-0">
        <SuggestionsSidebar />
        <TrendingArtistsSidebar />
      </aside>
    </div>
  )
}
