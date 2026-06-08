import { Skeleton } from "@/components/ui/skeleton"

// ─── 1. Basic ─────────────────────────────────────────────────────────────────
export function BasicVariant() {
  return (
    <div className="flex items-center gap-4">
      <Skeleton className="size-12 rounded-full" />
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-[200px]" />
        <Skeleton className="h-4 w-[160px]" />
      </div>
    </div>
  )
}

// ─── 2. Text lines ────────────────────────────────────────────────────────────
export function TextLinesVariant() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-5 w-2/3" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  )
}

// ─── 3. Card ──────────────────────────────────────────────────────────────────
export function CardVariant() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-40 w-full rounded-lg" />
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6" />
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-8 w-20 rounded-md" />
        <Skeleton className="h-8 w-20 rounded-md" />
      </div>
    </div>
  )
}

// ─── 4. List ──────────────────────────────────────────────────────────────────
export function ListVariant() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full shrink-0" />
          <div className="flex flex-col gap-2 flex-1">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── 5. Table ─────────────────────────────────────────────────────────────────
export function TableVariant() {
  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div className="grid grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full rounded-md" />
        ))}
      </div>
      {/* Body rows */}
      {Array.from({ length: 5 }).map((_, row) => (
        <div key={row} className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, col) => (
            <Skeleton key={col} className="h-4 w-full rounded-md" />
          ))}
        </div>
      ))}
    </div>
  )
}

// ─── 6. Profile ───────────────────────────────────────────────────────────────
export function ProfileVariant() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-24 w-full rounded-lg" />
      <div className="-mt-8 ml-4">
        <Skeleton className="size-16 rounded-full" />
      </div>
      <div className="flex flex-col gap-2 px-1">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-4 w-28" />
      </div>
      <div className="flex gap-4 px-1">
        <Skeleton className="h-8 w-16 rounded-md" />
        <Skeleton className="h-8 w-16 rounded-md" />
        <Skeleton className="h-8 w-16 rounded-md" />
      </div>
    </div>
  )
}

// ─── 7. Image grid ────────────────────────────────────────────────────────────
export function ImageGridVariant() {
  return (
    <div className="grid grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="aspect-square rounded-lg" />
      ))}
    </div>
  )
}
