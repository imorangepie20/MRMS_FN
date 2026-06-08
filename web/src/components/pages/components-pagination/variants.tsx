"use client"

import * as React from "react"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// ─── 1. Basic ─────────────────────────────────────────────────────────────────
export function BasicVariant() {
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href="#" />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#">1</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#" isActive>2</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#">3</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationEllipsis />
        </PaginationItem>
        <PaginationItem>
          <PaginationNext href="#" />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

// ─── 2. Full controls ─────────────────────────────────────────────────────────
export function FullControlsVariant() {
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm text-muted-foreground">Page 1 of 10</p>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationLink href="#" aria-label="Go to first page" size="icon">
              <ChevronsLeft className="size-4" />
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" aria-label="Go to previous page" size="icon">
              <ChevronLeft className="size-4" />
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" isActive>1</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#">2</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#">3</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" aria-label="Go to next page" size="icon">
              <ChevronRight className="size-4" />
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" aria-label="Go to last page" size="icon">
              <ChevronsRight className="size-4" />
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}

// ─── 3. Compact + rows per page ───────────────────────────────────────────────
export function CompactRowsVariant() {
  const [rowsPerPage, setRowsPerPage] = React.useState("25")
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page</span>
        <Select value={rowsPerPage} onValueChange={(v) => { if (v !== null) setRowsPerPage(v) }}>
          <SelectTrigger className="w-16" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="10">10</SelectItem>
            <SelectItem value="25">25</SelectItem>
            <SelectItem value="50">50</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <span className="text-sm text-muted-foreground">
        1–{rowsPerPage} of 100
      </span>
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon-sm" aria-label="Previous page" disabled>
          <ChevronLeft className="size-4" />
        </Button>
        <Button variant="outline" size="icon-sm" aria-label="Next page">
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  )
}

// ─── 4. Simple ────────────────────────────────────────────────────────────────
export function SimpleVariant() {
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href="#" />
        </PaginationItem>
        <PaginationItem>
          <PaginationNext href="#" />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

// ─── 5. Many pages with ellipsis ─────────────────────────────────────────────
export function ManyPagesEllipsisVariant() {
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious href="#" />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#">1</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationEllipsis />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#">8</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#">9</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#" isActive>10</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationEllipsis />
        </PaginationItem>
        <PaginationItem>
          <PaginationLink href="#">20</PaginationLink>
        </PaginationItem>
        <PaginationItem>
          <PaginationNext href="#" />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

// ─── 6. Interactive ───────────────────────────────────────────────────────────
export function InteractiveVariant() {
  const [current, setCurrent] = React.useState(1)
  const total = 8

  return (
    <Pagination data-testid="pagination-interactive">
      <PaginationContent>
        <PaginationItem>
          <PaginationLink
            href="#"
            aria-label="Go to previous page"
            size="default"
            className={cn(
              "gap-1 px-2.5",
              current === 1 && "pointer-events-none opacity-50"
            )}
            onClick={(e) => {
              e.preventDefault()
              if (current > 1) setCurrent(current - 1)
            }}
          >
            <ChevronLeft className="size-4" />
            <span>Previous</span>
          </PaginationLink>
        </PaginationItem>
        {Array.from({ length: total }, (_, i) => i + 1).map((page) => (
          <PaginationItem key={page}>
            <PaginationLink
              href="#"
              isActive={page === current}
              onClick={(e) => {
                e.preventDefault()
                setCurrent(page)
              }}
            >
              {page}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationLink
            href="#"
            aria-label="Go to next page"
            size="default"
            className={cn(
              "gap-1 px-2.5",
              current === total && "pointer-events-none opacity-50"
            )}
            onClick={(e) => {
              e.preventDefault()
              if (current < total) setCurrent(current + 1)
            }}
          >
            <span>Next</span>
            <ChevronRight className="size-4" />
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

// ─── 7. Outline ───────────────────────────────────────────────────────────────
export function OutlineVariant() {
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationLink
            href="#"
            aria-label="Previous"
            size="icon"
            className="border border-input bg-background hover:bg-muted"
          >
            <ChevronLeft className="size-4" />
          </PaginationLink>
        </PaginationItem>
        {[1, 2, 3, 4, 5].map((page) => (
          <PaginationItem key={page}>
            <PaginationLink
              href="#"
              isActive={page === 1}
              className="border border-input data-[active=true]:border-primary"
            >
              {page}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationLink
            href="#"
            aria-label="Next"
            size="icon"
            className="border border-input bg-background hover:bg-muted"
          >
            <ChevronRight className="size-4" />
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

// ─── 8. Rounded / pill ────────────────────────────────────────────────────────
export function RoundedPillVariant() {
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationLink
            href="#"
            aria-label="Previous"
            size="icon"
            className="rounded-full"
          >
            <ChevronLeft className="size-4" />
          </PaginationLink>
        </PaginationItem>
        {[1, 2, 3, 4, 5].map((page) => (
          <PaginationItem key={page}>
            <PaginationLink
              href="#"
              isActive={page === 3}
              className="rounded-full"
            >
              {page}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationLink
            href="#"
            aria-label="Next"
            size="icon"
            className="rounded-full"
          >
            <ChevronRight className="size-4" />
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

// ─── 9. Icon-only nav ─────────────────────────────────────────────────────────
export function IconOnlyNavVariant() {
  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationLink href="#" aria-label="Go to previous page" size="icon">
            <ChevronLeft className="size-4" />
          </PaginationLink>
        </PaginationItem>
        {[1, 2, 3, 4, 5].map((page) => (
          <PaginationItem key={page}>
            <PaginationLink href="#" isActive={page === 2}>
              {page}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationLink href="#" aria-label="Go to next page" size="icon">
            <ChevronRight className="size-4" />
          </PaginationLink>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}

// ─── 10. Page jump ────────────────────────────────────────────────────────────
export function PageJumpVariant() {
  const [inputVal, setInputVal] = React.useState("")
  const [current, setCurrent] = React.useState(1)
  const total = 20

  const handleGo = () => {
    const page = parseInt(inputVal, 10)
    if (!isNaN(page) && page >= 1 && page <= total) {
      setCurrent(page)
      setInputVal("")
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <Pagination className="w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationLink
              href="#"
              aria-label="Previous"
              size="icon"
              className={cn(current === 1 && "pointer-events-none opacity-50")}
              onClick={(e) => {
                e.preventDefault()
                if (current > 1) setCurrent(current - 1)
              }}
            >
              <ChevronLeft className="size-4" />
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <span className="flex h-8 items-center px-2 text-sm">
              Page {current} of {total}
            </span>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink
              href="#"
              aria-label="Next"
              size="icon"
              className={cn(current === total && "pointer-events-none opacity-50")}
              onClick={(e) => {
                e.preventDefault()
                if (current < total) setCurrent(current + 1)
              }}
            >
              <ChevronRight className="size-4" />
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
      <div className="flex items-center gap-1.5">
        <Input
          type="number"
          min={1}
          max={total}
          placeholder="Go to page"
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleGo()}
          className="h-8 w-24 text-sm"
          aria-label="Go to page"
        />
        <Button size="sm" onClick={handleGo}>Go</Button>
      </div>
    </div>
  )
}

// ─── 11. Minimal counter ──────────────────────────────────────────────────────
export function MinimalCounterVariant() {
  return (
    <div className="flex items-center justify-center gap-3">
      <Button variant="ghost" size="icon-sm" aria-label="Previous page">
        <ChevronLeft className="size-4" />
      </Button>
      <span className="text-sm font-medium">Page 3 of 12</span>
      <Button variant="ghost" size="icon-sm" aria-label="Next page">
        <ChevronRight className="size-4" />
      </Button>
    </div>
  )
}

// ─── 12. Results summary ──────────────────────────────────────────────────────
export function ResultsSummaryVariant() {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm text-muted-foreground">
        Showing 1 to 10 of 97 results
      </span>
      <Pagination className="w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationLink href="#" aria-label="Previous" size="icon">
              <ChevronLeft className="size-4" />
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" isActive>1</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#">2</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#">3</PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationEllipsis />
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" aria-label="Next" size="icon">
              <ChevronRight className="size-4" />
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
