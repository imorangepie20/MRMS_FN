"use client"

import * as React from "react"
import { Eye, Code } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

type BlockCategory = "All" | "Marketing" | "Dashboard" | "Auth" | "E-commerce"

interface Block {
  title: string
  category: Exclude<BlockCategory, "All">
  previewColors: [string, string]
  wireframe: "hero" | "pricing" | "stats" | "login" | "grid" | "testimonials" | "cta" | "footer" | "navbar"
}

const BLOCKS: Block[] = [
  { title: "Hero Section",   category: "Marketing",   previewColors: ["from-violet-500/20", "to-purple-500/10"], wireframe: "hero" },
  { title: "Pricing Table",  category: "Marketing",   previewColors: ["from-blue-500/20",   "to-cyan-500/10"],   wireframe: "pricing" },
  { title: "Stats Cards",    category: "Dashboard",   previewColors: ["from-emerald-500/20","to-teal-500/10"],   wireframe: "stats" },
  { title: "Login Form",     category: "Auth",        previewColors: ["from-rose-500/20",   "to-pink-500/10"],   wireframe: "login" },
  { title: "Feature Grid",   category: "Marketing",   previewColors: ["from-amber-500/20",  "to-orange-500/10"], wireframe: "grid" },
  { title: "Testimonials",   category: "Marketing",   previewColors: ["from-sky-500/20",    "to-blue-500/10"],   wireframe: "testimonials" },
  { title: "CTA Banner",     category: "Marketing",   previewColors: ["from-indigo-500/20", "to-violet-500/10"], wireframe: "cta" },
  { title: "Footer",         category: "E-commerce",  previewColors: ["from-slate-500/20",  "to-gray-500/10"],   wireframe: "footer" },
  { title: "Navbar",         category: "Dashboard",   previewColors: ["from-teal-500/20",   "to-emerald-500/10"], wireframe: "navbar" },
]

const CATEGORIES: BlockCategory[] = ["All", "Marketing", "Dashboard", "Auth", "E-commerce"]

const BADGE_VARIANTS: Record<Exclude<BlockCategory,"All">, "default"|"secondary"|"outline"|"destructive"> = {
  Marketing:   "default",
  Dashboard:   "secondary",
  Auth:        "outline",
  "E-commerce":"destructive",
}

function BlockWireframe({ type }: { type: Block["wireframe"] }) {
  const bar = (cls: string) => (
    <div className={cn("rounded bg-foreground/10", cls)} />
  )
  switch (type) {
    case "hero":
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-4">
          {bar("h-2 w-3/5")}
          {bar("h-1.5 w-2/5")}
          <div className="mt-1 flex gap-2">{bar("h-5 w-12 rounded-md")}{bar("h-5 w-12 rounded-md")}</div>
          {bar("mt-1 h-10 w-full rounded-md")}
        </div>
      )
    case "pricing":
      return (
        <div className="flex h-full items-end justify-center gap-2 px-3 pb-3">
          {[1,2,3].map(i => (
            <div key={i} className={cn("flex flex-col items-center gap-1 rounded-md border border-foreground/10 p-2", i===2 && "bg-foreground/5")}>
              {bar("h-1.5 w-12")}
              {bar("h-2 w-8")}
              {bar("h-1 w-10")}
              {bar("h-1 w-10")}
              {bar("mt-1 h-4 w-12 rounded-sm")}
            </div>
          ))}
        </div>
      )
    case "stats":
      return (
        <div className="grid h-full grid-cols-2 gap-2 p-3">
          {[1,2,3,4].map(i => (
            <div key={i} className="rounded-md border border-foreground/10 p-2">
              {bar("h-1.5 w-10")}
              {bar("mt-1 h-3 w-7")}
            </div>
          ))}
        </div>
      )
    case "login":
      return (
        <div className="flex h-full flex-col items-center justify-center gap-1.5 px-6">
          {bar("h-2 w-20")}
          {bar("h-6 w-full rounded-md")}
          {bar("h-6 w-full rounded-md")}
          {bar("mt-1 h-5 w-full rounded-md")}
        </div>
      )
    case "grid":
      return (
        <div className="grid h-full grid-cols-3 gap-2 p-3">
          {[1,2,3,4,5,6].map(i => (
            <div key={i} className="rounded-md border border-foreground/10 p-1.5">
              {bar("h-3 w-3")}
              {bar("mt-1 h-1.5 w-full")}
              {bar("mt-0.5 h-1 w-3/4")}
            </div>
          ))}
        </div>
      )
    case "testimonials":
      return (
        <div className="flex h-full flex-col gap-2 p-3">
          {[1,2].map(i => (
            <div key={i} className="rounded-md border border-foreground/10 p-2">
              {bar("h-1 w-full")}
              {bar("mt-0.5 h-1 w-4/5")}
              <div className="mt-1 flex items-center gap-1">{bar("h-3 w-3 rounded-full")}{bar("h-1.5 w-12")}</div>
            </div>
          ))}
        </div>
      )
    case "cta":
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 rounded-md border border-foreground/10 mx-3 px-4">
          {bar("h-2 w-2/3")}
          {bar("h-1.5 w-1/2")}
          {bar("mt-1 h-5 w-16 rounded-md")}
        </div>
      )
    case "footer":
      return (
        <div className="flex h-full flex-col justify-end gap-1 p-3">
          <div className="flex gap-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="flex flex-1 flex-col gap-1">
                {bar("h-1.5 w-full")}
                {bar("h-1 w-3/4")}
                {bar("h-1 w-1/2")}
                {bar("h-1 w-2/3")}
              </div>
            ))}
          </div>
          {bar("mt-2 h-px w-full")}
          <div className="flex justify-between">{bar("h-1 w-20")}{bar("h-1 w-16")}</div>
        </div>
      )
    case "navbar":
    default:
      return (
        <div className="flex h-full flex-col gap-2 p-3">
          <div className="flex items-center justify-between rounded-md border border-foreground/10 px-3 py-2">
            {bar("h-2 w-16")}
            <div className="flex gap-2">{bar("h-1.5 w-8")}{bar("h-1.5 w-8")}{bar("h-1.5 w-8")}</div>
            {bar("h-4 w-12 rounded-md")}
          </div>
          {bar("mt-2 h-8 w-full rounded-md")}
          <div className="flex gap-2">{bar("h-6 flex-1 rounded-md")}{bar("h-6 flex-1 rounded-md")}{bar("h-6 flex-1 rounded-md")}</div>
        </div>
      )
  }
}

export default function BlocksPage() {
  const [active, setActive] = React.useState<BlockCategory>("All")

  const filtered = active === "All" ? BLOCKS : BLOCKS.filter(b => b.category === active)

  return (
    <div className="flex flex-col gap-8 p-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Blocks</h1>
        <p className="text-sm text-muted-foreground">
          Pre-built sections you can drop into your app.
        </p>
      </div>

      {/* Category tabs */}
      <Tabs
        value={active}
        onValueChange={(val) => setActive(val as BlockCategory)}
      >
        <TabsList variant="line">
          {CATEGORIES.map(cat => (
            <TabsTrigger key={cat} value={cat}>{cat}</TabsTrigger>
          ))}
        </TabsList>

        {/* Shared content panel — we render based on state */}
        {CATEGORIES.map(cat => (
          <TabsContent key={cat} value={cat}>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((block) => (
                <Card key={block.title} className="overflow-hidden">
                  {/* Preview area */}
                  <div
                    className={cn(
                      "relative h-44 bg-linear-to-br",
                      block.previewColors[0],
                      block.previewColors[1],
                      "border-b border-foreground/10"
                    )}
                  >
                    <BlockWireframe type={block.wireframe} />
                  </div>

                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{block.title}</CardTitle>
                      <Badge variant={BADGE_VARIANTS[block.category]}>
                        {block.category}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardFooter className="gap-2">
                    <Button size="sm" variant="outline" className="flex-1 gap-1.5">
                      <Eye />
                      Preview
                    </Button>
                    <Button size="sm" className="flex-1 gap-1.5">
                      <Code />
                      Get Code
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
