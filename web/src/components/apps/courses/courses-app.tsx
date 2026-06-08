"use client"

import { useState, useMemo } from "react"
import {
  Star,
  Clock,
  Users,
  Search,
  PlayCircle,
  BookOpen,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

import { COURSES, CATEGORIES, type Course, type Category } from "./data"

// ─── Category gradient colour map ────────────────────────────────────────────

const CATEGORY_BADGE_CLASS: Record<string, string> = {
  Design: "bg-violet-500/90 text-white border-0",
  Development: "bg-blue-500/90 text-white border-0",
  Marketing: "bg-amber-500/90 text-white border-0",
  Business: "bg-zinc-600/90 text-white border-0",
  Photography: "bg-emerald-500/90 text-white border-0",
}

// ─── Course Card ─────────────────────────────────────────────────────────────

function CourseCard({ course }: { course: Course }) {
  const isEnrolled = course.status !== "not-enrolled"
  const isCompleted = course.status === "completed"

  return (
    <Card className="overflow-hidden p-0 gap-0">
      {/* Thumbnail */}
      <div
        className={cn(
          "relative h-40 flex items-center justify-center bg-gradient-to-br",
          course.gradient
        )}
      >
        <PlayCircle className="size-12 text-white/80 drop-shadow-md" strokeWidth={1.5} />
        <div className="absolute top-3 left-3">
          <Badge className={cn("text-xs", CATEGORY_BADGE_CLASS[course.category])}>
            {course.category}
          </Badge>
        </div>
      </div>

      {/* Body */}
      <CardContent className="flex flex-col gap-3 pt-4 pb-4">
        {/* Title */}
        <div className="font-semibold text-base leading-snug line-clamp-2">
          {course.title}
        </div>

        {/* Instructor */}
        <div className="flex items-center gap-2">
          <Avatar size="sm">
            <AvatarFallback className="text-xs font-medium">
              {course.instructorInitials}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="text-xs font-medium truncate">{course.instructorName}</div>
            <div className="text-xs text-muted-foreground truncate">{course.instructorRole}</div>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Star className="size-3 fill-amber-400 text-amber-400" />
            <span className="font-medium text-foreground">{course.rating}</span>
          </span>
          <span className="flex items-center gap-1">
            <Users className="size-3" />
            {course.students}
          </span>
          <span className="flex items-center gap-1">
            <Clock className="size-3" />
            {course.duration}
          </span>
        </div>

        {/* CTA area */}
        {isEnrolled ? (
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {isCompleted ? "Completed" : `${course.progress}% complete`}
              </span>
              {isCompleted && (
                <Badge variant="secondary" className="text-xs">
                  Done
                </Badge>
              )}
            </div>
            <Progress value={course.progress} className="gap-0" />
            <Button
              variant={isCompleted ? "outline" : "default"}
              size="sm"
              className="w-full mt-1"
            >
              {isCompleted ? "Review" : "Continue"}
            </Button>
          </div>
        ) : (
          <div className="flex items-center justify-between mt-1">
            <span className="font-semibold text-base">{course.price}</span>
            <Button size="sm" variant="default">
              Enroll
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Category filter buttons ──────────────────────────────────────────────────

function CategoryFilter({
  selected,
  onChange,
}: {
  selected: string
  onChange: (cat: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {CATEGORIES.map((cat) => (
        <button
          key={cat}
          onClick={() => onChange(cat)}
          className={cn(
            "inline-flex h-7 items-center rounded-full px-3 text-xs font-medium transition-colors",
            selected === cat
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          )}
        >
          {cat}
        </button>
      ))}
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export function CoursesApp() {
  const [search, setSearch] = useState("")
  const [category, setCategory] = useState<string>("All")
  const [statusTab, setStatusTab] = useState<"all" | "in-progress" | "completed">("all")

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return COURSES.filter((c) => {
      // search
      if (q && !c.title.toLowerCase().includes(q) && !c.instructorName.toLowerCase().includes(q)) {
        return false
      }
      // category
      if (category !== "All" && c.category !== category) {
        return false
      }
      // status tab
      if (statusTab === "in-progress" && c.status !== "in-progress") return false
      if (statusTab === "completed" && c.status !== "completed") return false
      return true
    })
  }, [search, category, statusTab])

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-primary" />
          <h1 className="text-xl font-semibold">Courses</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Expand your skills with world-class instructors.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
        <Input
          placeholder="Search courses..."
          className="pl-8"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Category filter */}
      <CategoryFilter selected={category} onChange={setCategory} />

      {/* Status tabs */}
      <Tabs
        value={statusTab}
        onValueChange={(v) => setStatusTab(v as typeof statusTab)}
      >
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="in-progress">In Progress</TabsTrigger>
          <TabsTrigger value="completed">Completed</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <CoursesGrid courses={filtered} />
        </TabsContent>
        <TabsContent value="in-progress">
          <CoursesGrid courses={filtered} />
        </TabsContent>
        <TabsContent value="completed">
          <CoursesGrid courses={filtered} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── Grid ──────────────────────────────────────────────────────────────────────

function CoursesGrid({ courses }: { courses: Course[] }) {
  if (courses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
        <BookOpen className="size-10 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">No courses match your filters.</p>
      </div>
    )
  }
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
      {courses.map((c) => (
        <CourseCard key={c.id} course={c} />
      ))}
    </div>
  )
}
