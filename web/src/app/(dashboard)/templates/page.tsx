"use client"

import * as React from "react"
import { ExternalLink, Search } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { cn } from "@/lib/utils"

interface Template {
  title: string
  description: string
  tier: "Free" | "PRO"
  tags: string[]
  previewFrom: string
  previewTo: string
  accentColor: string
}

const TEMPLATES: Template[] = [
  {
    title: "SaaS Landing",
    description:
      "Conversion-optimised marketing site with hero, features, pricing, and CTA sections.",
    tier: "PRO",
    tags: ["Next.js", "Tailwind", "TypeScript"],
    previewFrom: "from-violet-500/25",
    previewTo: "to-purple-500/10",
    accentColor: "bg-violet-500/30",
  },
  {
    title: "Admin Pro",
    description:
      "Full-featured admin panel with sidebar navigation, charts, and data tables.",
    tier: "Free",
    tags: ["Next.js", "Tailwind", "TypeScript"],
    previewFrom: "from-blue-500/25",
    previewTo: "to-cyan-500/10",
    accentColor: "bg-blue-500/30",
  },
  {
    title: "E-commerce Store",
    description:
      "Product listings, cart, checkout flow, and order management built for scale.",
    tier: "PRO",
    tags: ["Next.js", "Tailwind", "TypeScript"],
    previewFrom: "from-emerald-500/25",
    previewTo: "to-teal-500/10",
    accentColor: "bg-emerald-500/30",
  },
  {
    title: "Portfolio",
    description:
      "Minimal personal portfolio with project showcase, about section, and contact form.",
    tier: "Free",
    tags: ["Next.js", "Tailwind", "TypeScript"],
    previewFrom: "from-amber-500/25",
    previewTo: "to-orange-500/10",
    accentColor: "bg-amber-500/30",
  },
  {
    title: "Blog",
    description:
      "MDX-powered blog with category filters, search, and optimised reading layout.",
    tier: "Free",
    tags: ["Next.js", "Tailwind", "TypeScript"],
    previewFrom: "from-rose-500/25",
    previewTo: "to-pink-500/10",
    accentColor: "bg-rose-500/30",
  },
  {
    title: "Agency",
    description:
      "Creative agency site with animated hero, service cards, team section, and contact.",
    tier: "PRO",
    tags: ["Next.js", "Tailwind", "TypeScript"],
    previewFrom: "from-indigo-500/25",
    previewTo: "to-violet-500/10",
    accentColor: "bg-indigo-500/30",
  },
]

function TemplatePreview({
  from,
  to,
  accentColor,
}: {
  from: string
  to: string
  accentColor: string
  title: string
}) {
  return (
    <div
      className={cn(
        "relative h-52 overflow-hidden bg-linear-to-br border-b border-foreground/10",
        from,
        to
      )}
    >
      {/* Abstract page wireframe */}
      <div className="flex h-full flex-col gap-0">
        {/* Simulated nav bar */}
        <div className="flex items-center gap-2 border-b border-foreground/10 px-4 py-2">
          <div className={cn("h-3 w-3 rounded-full", accentColor)} />
          <div className="h-1.5 w-12 rounded bg-foreground/10" />
          <div className="ml-auto flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-1.5 w-8 rounded bg-foreground/10" />
            ))}
          </div>
          <div className={cn("h-4 w-10 rounded-md", accentColor)} />
        </div>

        {/* Hero area */}
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6">
          <div className="h-2 w-2/3 rounded bg-foreground/15" />
          <div className="h-2 w-1/2 rounded bg-foreground/10" />
          <div className="h-1.5 w-3/5 rounded bg-foreground/10" />
          <div className="mt-2 flex gap-2">
            <div className={cn("h-5 w-14 rounded-md", accentColor)} />
            <div className="h-5 w-14 rounded-md border border-foreground/15" />
          </div>
        </div>

        {/* Feature strip */}
        <div className="grid grid-cols-3 gap-2 border-t border-foreground/10 px-4 py-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col gap-1">
              <div className={cn("h-3 w-3 rounded-sm", accentColor)} />
              <div className="h-1.5 w-full rounded bg-foreground/10" />
              <div className="h-1 w-3/4 rounded bg-foreground/10" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function TemplatesPage() {
  const [query, setQuery] = React.useState("")

  const filtered = query.trim()
    ? TEMPLATES.filter((t) =>
        t.title.toLowerCase().includes(query.toLowerCase())
      )
    : TEMPLATES

  return (
    <div className="flex flex-col gap-8 p-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Website Templates</h1>
        <p className="text-sm text-muted-foreground">
          Production-ready templates for your next project.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search templates…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      <Separator />

      {/* Grid */}
      {filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No templates match &ldquo;{query}&rdquo;.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tmpl) => (
            <Card key={tmpl.title} className="overflow-hidden">
              <TemplatePreview
                from={tmpl.previewFrom}
                to={tmpl.previewTo}
                accentColor={tmpl.accentColor}
                title={tmpl.title}
              />

              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle>{tmpl.title}</CardTitle>
                  <Badge
                    variant={tmpl.tier === "PRO" ? "default" : "secondary"}
                  >
                    {tmpl.tier}
                  </Badge>
                </div>
                <CardDescription>{tmpl.description}</CardDescription>
              </CardHeader>

              <CardContent className="flex flex-wrap gap-1.5">
                {tmpl.tags.map((tag) => (
                  <Badge key={tag} variant="outline">
                    {tag}
                  </Badge>
                ))}
              </CardContent>

              <CardFooter className="gap-2">
                <Button size="sm" variant="outline" className="flex-1 gap-1.5">
                  <ExternalLink />
                  Live Demo
                </Button>
                <Button size="sm" className="flex-1">
                  Download
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
