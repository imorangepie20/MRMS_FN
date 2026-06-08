import { ArrowRight } from "lucide-react"
import Link from "next/link"

import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface Example {
  title: string
  description: string
  href: string
  tag: string
  tagVariant: "default" | "secondary" | "outline" | "destructive"
  previewFrom: string
  previewTo: string
}

const EXAMPLES: Example[] = [
  {
    title: "Default Dashboard",
    description: "Overview with KPIs, charts, and recent activity.",
    href: "/dashboard/default",
    tag: "Dashboard",
    tagVariant: "default",
    previewFrom: "from-violet-500/20",
    previewTo: "to-purple-500/10",
  },
  {
    title: "E-commerce",
    description: "Sales metrics, product tables, and revenue trends.",
    href: "/dashboard/ecommerce",
    tag: "E-commerce",
    tagVariant: "destructive",
    previewFrom: "from-emerald-500/20",
    previewTo: "to-teal-500/10",
  },
  {
    title: "CRM",
    description: "Customer pipeline, contacts, and deal tracking.",
    href: "/dashboard/crm",
    tag: "Dashboard",
    tagVariant: "default",
    previewFrom: "from-blue-500/20",
    previewTo: "to-cyan-500/10",
  },
  {
    title: "Kanban Board",
    description: "Drag-and-drop task management across swimlanes.",
    href: "/apps/kanban",
    tag: "App",
    tagVariant: "secondary",
    previewFrom: "from-amber-500/20",
    previewTo: "to-orange-500/10",
  },
  {
    title: "Mail",
    description: "Full-featured inbox with compose and threading.",
    href: "/apps/mail",
    tag: "App",
    tagVariant: "secondary",
    previewFrom: "from-sky-500/20",
    previewTo: "to-blue-500/10",
  },
  {
    title: "Calendar",
    description: "Monthly/weekly event calendar with scheduling.",
    href: "/apps/calendar",
    tag: "App",
    tagVariant: "secondary",
    previewFrom: "from-rose-500/20",
    previewTo: "to-pink-500/10",
  },
  {
    title: "AI Chat",
    description: "Conversational AI interface with message history.",
    href: "/ai/chat",
    tag: "AI",
    tagVariant: "outline",
    previewFrom: "from-indigo-500/20",
    previewTo: "to-violet-500/10",
  },
  {
    title: "Settings",
    description: "Account preferences, notifications, and integrations.",
    href: "/settings",
    tag: "Page",
    tagVariant: "outline",
    previewFrom: "from-slate-500/20",
    previewTo: "to-gray-500/10",
  },
  {
    title: "Pricing",
    description: "Tiered pricing cards with feature comparison.",
    href: "/pricing",
    tag: "Page",
    tagVariant: "outline",
    previewFrom: "from-teal-500/20",
    previewTo: "to-emerald-500/10",
  },
  {
    title: "Users",
    description: "User list with roles, avatars, and status badges.",
    href: "/users",
    tag: "Page",
    tagVariant: "outline",
    previewFrom: "from-fuchsia-500/20",
    previewTo: "to-purple-500/10",
  },
  {
    title: "Profile",
    description: "Personal profile with bio, stats, and recent posts.",
    href: "/profile",
    tag: "Page",
    tagVariant: "outline",
    previewFrom: "from-lime-500/20",
    previewTo: "to-green-500/10",
  },
  {
    title: "Login",
    description: "Clean sign-in page with social OAuth options.",
    href: "/login",
    tag: "Auth",
    tagVariant: "destructive",
    previewFrom: "from-red-500/20",
    previewTo: "to-rose-500/10",
  },
]

function PreviewArea({ from, to }: { from: string; to: string }) {
  return (
    <div
      className={cn(
        "relative h-40 bg-linear-to-br border-b border-foreground/10",
        from,
        to
      )}
    >
      {/* Abstract wireframe: top bar + content blocks */}
      <div className="flex h-full flex-col gap-2 p-3">
        <div className="flex items-center gap-2">
          <div className="h-2 w-16 rounded bg-foreground/10" />
          <div className="ml-auto h-2 w-8 rounded bg-foreground/10" />
          <div className="h-2 w-8 rounded bg-foreground/10" />
        </div>
        <div className="flex flex-1 gap-2">
          <div className="flex w-1/4 flex-col gap-1.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-1.5 rounded bg-foreground/10" />
            ))}
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <div className="grid grid-cols-3 gap-1.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 rounded-md border border-foreground/10 bg-foreground/5" />
              ))}
            </div>
            <div className="flex-1 rounded-md border border-foreground/10 bg-foreground/5" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ExamplesPage() {
  return (
    <div className="flex flex-col gap-8 p-6">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-heading text-2xl font-semibold">Examples</h1>
        <p className="text-sm text-muted-foreground">
          Full pages built with the kit.
        </p>
      </div>

      {/* Grid */}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {EXAMPLES.map((ex) => (
          <Card key={ex.href} className="overflow-hidden">
            <PreviewArea from={ex.previewFrom} to={ex.previewTo} />

            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <CardTitle>{ex.title}</CardTitle>
                <Badge variant={ex.tagVariant}>{ex.tag}</Badge>
              </div>
              <CardDescription>{ex.description}</CardDescription>
            </CardHeader>

            <CardContent>
              <Link
                href={ex.href}
                className={cn(
                  buttonVariants({ size: "sm", variant: "outline" }),
                  "w-full gap-1.5"
                )}
              >
                View Example
                <ArrowRight />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
