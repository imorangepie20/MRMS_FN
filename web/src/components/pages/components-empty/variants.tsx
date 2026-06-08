"use client"

import * as React from "react"
import {
  FolderPlus,
  Search,
  UploadCloud,
  FileX,
  WifiOff,
  Wrench,
  RefreshCw,
  Import,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
  EmptyContent,
} from "@/components/ui/empty"

// ─── 1. No projects ───────────────────────────────────────────────────────────
export function NoProjectsVariant() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <FolderPlus className="size-6 text-muted-foreground" />
          </div>
        </EmptyMedia>
        <EmptyTitle>No projects yet</EmptyTitle>
        <EmptyDescription>
          You haven&apos;t created any projects yet. Get started by creating one.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button size="sm">Create Project</Button>
          <Button size="sm" variant="outline">
            <Import className="size-4" />
            Import Project
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  )
}

// ─── 2. With avatars ──────────────────────────────────────────────────────────
export function WithAvatarsVariant() {
  const initials = ["CN", "AB", "EM"]
  const colors = [
    "bg-violet-500",
    "bg-sky-500",
    "bg-emerald-500",
  ]
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          {/* Avatar group stack */}
          <div className="mb-1 flex -space-x-3">
            {initials.map((init, i) => (
              <div
                key={init}
                className={`flex size-10 items-center justify-center rounded-full border-2 border-background text-xs font-semibold text-white ${colors[i]}`}
              >
                {init}
              </div>
            ))}
          </div>
        </EmptyMedia>
        <EmptyTitle>Invite your team</EmptyTitle>
        <EmptyDescription>
          No team members yet — invite people to collaborate.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm">Invite</Button>
      </EmptyContent>
    </Empty>
  )
}

// ─── 3. No results (search) — interactive ────────────────────────────────────
export function NoResultsSearchVariant() {
  const [cleared, setCleared] = React.useState(false)

  return (
    <div data-testid="empty-search">
      {!cleared ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Search className="size-6 text-muted-foreground" />
              </div>
            </EmptyMedia>
            <EmptyTitle>No designers found</EmptyTitle>
            <EmptyDescription>
              Sorry, we couldn&apos;t find any designers with the name &ldquo;Elizabeth Mazen&rdquo;.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCleared(true)}
              aria-label="Clear search"
            >
              Clear search
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Search className="size-6 text-muted-foreground" />
              </div>
            </EmptyMedia>
            <EmptyTitle>Search anyone</EmptyTitle>
            <EmptyDescription>
              Start typing a name to find designers in your network.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button
              size="sm"
              onClick={() => setCleared(false)}
              aria-label="Reset search"
            >
              Reset
            </Button>
          </EmptyContent>
        </Empty>
      )}
    </div>
  )
}

// ─── 4. With outline (illustration) ──────────────────────────────────────────
export function WithOutlineVariant() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <div className="flex size-20 items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/40">
            <UploadCloud className="size-8 text-muted-foreground" />
          </div>
        </EmptyMedia>
        <EmptyTitle>Your storage is empty</EmptyTitle>
        <EmptyDescription>
          Files you upload will appear here.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" variant="outline">Browse files</Button>
      </EmptyContent>
    </Empty>
  )
}

// ─── 5. Cloud storage ─────────────────────────────────────────────────────────
export function CloudStorageVariant() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <UploadCloud className="size-6 text-muted-foreground" />
          </div>
        </EmptyMedia>
        <EmptyTitle>Upload your first file</EmptyTitle>
        <EmptyDescription>
          Upload files to your cloud storage to access them anywhere.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm">Upload Files</Button>
      </EmptyContent>
    </Empty>
  )
}

// ─── 6. 404 — Not Found ───────────────────────────────────────────────────────
export function NotFoundVariant() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <div className="relative flex items-center justify-center">
            <span className="select-none text-7xl font-extrabold tracking-tighter text-muted/60">
              404
            </span>
            <FileX className="absolute size-7 text-muted-foreground" />
          </div>
        </EmptyMedia>
        <EmptyTitle>Page not found</EmptyTitle>
        <EmptyDescription>
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button size="sm">Go home</Button>
          <Button size="sm" variant="outline">Contact support</Button>
        </div>
      </EmptyContent>
    </Empty>
  )
}

// ─── 7. Maintenance ───────────────────────────────────────────────────────────
export function MaintenanceVariant() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <Wrench className="size-6 text-muted-foreground" />
          </div>
        </EmptyMedia>
        <EmptyTitle>Under maintenance</EmptyTitle>
        <EmptyDescription>
          We&apos;re currently performing scheduled maintenance. We&apos;ll be back shortly.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" variant="outline">Check status</Button>
      </EmptyContent>
    </Empty>
  )
}

// ─── 8. No connection (offline) ───────────────────────────────────────────────
export function NoConnectionVariant() {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia>
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <WifiOff className="size-6 text-muted-foreground" />
          </div>
        </EmptyMedia>
        <EmptyTitle>You&apos;re offline</EmptyTitle>
        <EmptyDescription>
          It seems you are offline. Check your internet connection and try again.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button size="sm" variant="outline">
          <RefreshCw className="size-4" />
          Retry
        </Button>
      </EmptyContent>
    </Empty>
  )
}
