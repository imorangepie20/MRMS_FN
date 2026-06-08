"use client"

import * as React from "react"
import Autoplay from "embla-carousel-autoplay"
import { Quote } from "lucide-react"

import { cn } from "@/lib/utils"
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
  type CarouselApi,
} from "@/components/ui/carousel"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

// ─── Fixed gradient palettes (no Math.random / new Date) ─────────────────────
const GRADIENTS = [
  "from-violet-500 to-purple-600",
  "from-sky-500 to-blue-600",
  "from-emerald-500 to-teal-600",
  "from-amber-500 to-orange-500",
  "from-rose-500 to-pink-600",
]

// ─── 1. Basic ─────────────────────────────────────────────────────────────────
export function BasicVariant() {
  return (
    <div className="max-w-sm mx-auto px-10">
      <Carousel>
        <CarouselContent>
          {GRADIENTS.map((g, i) => (
            <CarouselItem key={i}>
              <div
                className={cn(
                  "flex h-32 items-center justify-center rounded-lg bg-gradient-to-br text-white font-semibold text-lg",
                  g
                )}
              >
                Slide {i + 1}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  )
}

// ─── 2. Three columns ─────────────────────────────────────────────────────────
export function ThreeColumnsVariant() {
  return (
    <div className="max-w-sm mx-auto px-10">
      <Carousel opts={{ align: "start" }}>
        <CarouselContent>
          {GRADIENTS.map((g, i) => (
            <CarouselItem key={i} className="basis-1/3">
              <div
                className={cn(
                  "flex h-24 items-center justify-center rounded-lg bg-gradient-to-br text-white font-medium text-sm",
                  g
                )}
              >
                {i + 1}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  )
}

// ─── 3. Dots navigation ───────────────────────────────────────────────────────
export function DotsNavigationVariant() {
  const [api, setApi] = React.useState<CarouselApi>()
  const [current, setCurrent] = React.useState(0)
  const [count, setCount] = React.useState(0)

  React.useEffect(() => {
    if (!api) return
    setCount(api.scrollSnapList().length)
    setCurrent(api.selectedScrollSnap())
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap())
    })
  }, [api])

  return (
    <div className="max-w-sm mx-auto px-10" data-testid="carousel-dots">
      <Carousel setApi={setApi}>
        <CarouselContent>
          {GRADIENTS.map((g, i) => (
            <CarouselItem key={i}>
              <div
                className={cn(
                  "flex h-32 items-center justify-center rounded-lg bg-gradient-to-br text-white font-semibold text-lg",
                  g
                )}
              >
                Slide {i + 1}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
      <div className="mt-3 flex justify-center gap-2">
        {Array.from({ length: count }).map((_, i) => (
          <button
            key={i}
            aria-label={`Go to slide ${i + 1}`}
            aria-current={current === i ? "true" : undefined}
            onClick={() => api?.scrollTo(i)}
            className={cn(
              "h-2 w-2 rounded-full transition-colors",
              current === i
                ? "bg-primary"
                : "bg-muted-foreground/30 hover:bg-muted-foreground/60"
            )}
          />
        ))}
      </div>
    </div>
  )
}

// ─── 4. Autoplay + loop ───────────────────────────────────────────────────────
export function AutoplayLoopVariant() {
  const [plugin] = React.useState(() =>
    Autoplay({ delay: 2500, stopOnInteraction: false })
  )

  return (
    <div className="max-w-sm mx-auto px-10">
      <Carousel
        opts={{ loop: true }}
        plugins={[plugin]}
      >
        <CarouselContent>
          {GRADIENTS.map((g, i) => (
            <CarouselItem key={i}>
              <div
                className={cn(
                  "flex h-32 items-center justify-center rounded-lg bg-gradient-to-br text-white font-semibold text-lg",
                  g
                )}
              >
                Slide {i + 1}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  )
}

// ─── 5. Vertical ──────────────────────────────────────────────────────────────
export function VerticalVariant() {
  return (
    <div className="max-w-sm mx-auto px-2">
      <Carousel orientation="vertical" className="h-56">
        <CarouselContent className="h-56">
          {GRADIENTS.map((g, i) => (
            <CarouselItem key={i}>
              <div
                className={cn(
                  "flex h-48 items-center justify-center rounded-lg bg-gradient-to-br text-white font-semibold text-lg",
                  g
                )}
              >
                Slide {i + 1}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  )
}

// ─── 6. Card carousel ─────────────────────────────────────────────────────────
const CARD_SLIDES = [
  { title: "Design System", description: "Build consistent, scalable UI components." },
  { title: "Accessibility", description: "Ensure all users can interact with your product." },
  { title: "Performance", description: "Optimize load times and runtime efficiency." },
  { title: "Collaboration", description: "Work together with your team in real time." },
  { title: "Analytics", description: "Gain insights from user behavior and data." },
]

export function CardCarouselVariant() {
  return (
    <div className="max-w-sm mx-auto px-10">
      <Carousel opts={{ align: "start" }}>
        <CarouselContent>
          {CARD_SLIDES.map((slide, i) => (
            <CarouselItem key={i}>
              <Card>
                <CardHeader>
                  <CardTitle>{slide.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{slide.description}</p>
                </CardContent>
              </Card>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  )
}

// ─── 7. Testimonials ──────────────────────────────────────────────────────────
const TESTIMONIALS = [
  {
    quote: "This design system has dramatically improved our team's velocity. The components are polished and easy to customize.",
    name: "Alex Morgan",
    role: "Frontend Lead, Acme Corp",
    initials: "AM",
    gradient: "from-violet-500 to-purple-600",
  },
  {
    quote: "The accessibility out of the box is phenomenal. We shipped a fully WCAG-compliant product in record time.",
    name: "Jordan Lee",
    role: "Product Designer, Pixel Inc",
    initials: "JL",
    gradient: "from-sky-500 to-blue-600",
  },
  {
    quote: "I love how every component follows the same pattern. Onboarding new developers is so much faster now.",
    name: "Sam Rivera",
    role: "Engineering Manager, StartupXYZ",
    initials: "SR",
    gradient: "from-emerald-500 to-teal-600",
  },
]

export function TestimonialsVariant() {
  return (
    <div className="max-w-sm mx-auto px-10">
      <Carousel>
        <CarouselContent>
          {TESTIMONIALS.map((t, i) => (
            <CarouselItem key={i}>
              <div className="rounded-xl border bg-card p-5 flex flex-col gap-4">
                <Quote className="size-5 text-muted-foreground" />
                <p className="text-sm text-muted-foreground leading-relaxed">{t.quote}</p>
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-white text-xs font-bold",
                      t.gradient
                    )}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.role}</p>
                  </div>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  )
}

// ─── 8. Custom arrows ─────────────────────────────────────────────────────────
export function CustomArrowsVariant() {
  return (
    <div className="max-w-sm mx-auto px-12">
      <Carousel>
        <CarouselContent>
          {GRADIENTS.map((g, i) => (
            <CarouselItem key={i}>
              <div
                className={cn(
                  "flex h-32 items-center justify-center rounded-lg bg-gradient-to-br text-white font-semibold text-lg",
                  g
                )}
              >
                Slide {i + 1}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious
          variant="default"
          className="size-9 bg-primary text-primary-foreground hover:bg-primary/90 border-0 shadow-md"
        />
        <CarouselNext
          variant="default"
          className="size-9 bg-primary text-primary-foreground hover:bg-primary/90 border-0 shadow-md"
        />
      </Carousel>
    </div>
  )
}

// ─── 9. Custom dots (pill style) ──────────────────────────────────────────────
export function CustomDotsVariant() {
  const [api, setApi] = React.useState<CarouselApi>()
  const [current, setCurrent] = React.useState(0)
  const [count, setCount] = React.useState(0)

  React.useEffect(() => {
    if (!api) return
    setCount(api.scrollSnapList().length)
    setCurrent(api.selectedScrollSnap())
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap())
    })
  }, [api])

  return (
    <div className="max-w-sm mx-auto px-10">
      <Carousel setApi={setApi}>
        <CarouselContent>
          {GRADIENTS.map((g, i) => (
            <CarouselItem key={i}>
              <div
                className={cn(
                  "flex h-32 items-center justify-center rounded-lg bg-gradient-to-br text-white font-semibold text-lg",
                  g
                )}
              >
                Slide {i + 1}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
      <div className="mt-3 flex justify-center items-center gap-1.5">
        {Array.from({ length: count }).map((_, i) => (
          <button
            key={i}
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => api?.scrollTo(i)}
            className={cn(
              "h-1.5 rounded-full transition-all duration-300",
              current === i
                ? "w-6 bg-primary"
                : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60"
            )}
          />
        ))}
      </div>
    </div>
  )
}

// ─── 10. Thumbnails ───────────────────────────────────────────────────────────
const THUMB_LABELS = ["Violet", "Sky", "Emerald", "Amber", "Rose"]

export function ThumbnailsVariant() {
  const [api, setApi] = React.useState<CarouselApi>()
  const [current, setCurrent] = React.useState(0)

  React.useEffect(() => {
    if (!api) return
    setCurrent(api.selectedScrollSnap())
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap())
    })
  }, [api])

  return (
    <div className="max-w-sm mx-auto px-10 flex flex-col gap-3">
      <Carousel setApi={setApi}>
        <CarouselContent>
          {GRADIENTS.map((g, i) => (
            <CarouselItem key={i}>
              <div
                className={cn(
                  "flex h-32 items-center justify-center rounded-lg bg-gradient-to-br text-white font-semibold text-lg",
                  g
                )}
              >
                {THUMB_LABELS[i]}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
      <div className="flex justify-center gap-2">
        {GRADIENTS.map((g, i) => (
          <button
            key={i}
            aria-label={`View slide ${i + 1}`}
            onClick={() => api?.scrollTo(i)}
            className={cn(
              "h-10 w-10 rounded-md bg-gradient-to-br shrink-0 ring-2 ring-offset-1 transition-all",
              g,
              current === i ? "ring-primary" : "ring-transparent opacity-60 hover:opacity-90"
            )}
          />
        ))}
      </div>
    </div>
  )
}

// ─── 11. Rich slides ──────────────────────────────────────────────────────────
const RICH_SLIDES = [
  { gradient: "from-violet-500 to-purple-600", heading: "Modern Design", body: "Craft interfaces that delight users with thoughtful details." },
  { gradient: "from-sky-500 to-blue-600", heading: "Fast & Reliable", body: "Built on proven technology for performance at scale." },
  { gradient: "from-emerald-500 to-teal-600", heading: "Open Source", body: "Community-driven components with full transparency." },
  { gradient: "from-amber-500 to-orange-500", heading: "Customizable", body: "Every token and variant adapts to your brand." },
  { gradient: "from-rose-500 to-pink-600", heading: "Accessible", body: "WCAG-compliant patterns baked in from day one." },
]

export function RichSlidesVariant() {
  return (
    <div className="max-w-sm mx-auto px-10">
      <Carousel>
        <CarouselContent>
          {RICH_SLIDES.map((slide, i) => (
            <CarouselItem key={i}>
              <div className="rounded-xl overflow-hidden border">
                <div className={cn("h-28 bg-gradient-to-br", slide.gradient)} />
                <div className="p-4">
                  <p className="font-semibold text-sm">{slide.heading}</p>
                  <p className="text-xs text-muted-foreground mt-1">{slide.body}</p>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
    </div>
  )
}

// ─── 12. Progress bar ─────────────────────────────────────────────────────────
export function ProgressBarVariant() {
  const [api, setApi] = React.useState<CarouselApi>()
  const [current, setCurrent] = React.useState(0)
  const [count, setCount] = React.useState(0)

  React.useEffect(() => {
    if (!api) return
    setCount(api.scrollSnapList().length)
    setCurrent(api.selectedScrollSnap())
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap())
    })
  }, [api])

  const progress = count > 0 ? ((current + 1) / count) * 100 : 0

  return (
    <div className="max-w-sm mx-auto px-10 flex flex-col gap-3">
      <Carousel setApi={setApi}>
        <CarouselContent>
          {GRADIENTS.map((g, i) => (
            <CarouselItem key={i}>
              <div
                className={cn(
                  "flex h-32 items-center justify-center rounded-lg bg-gradient-to-br text-white font-semibold text-lg",
                  g
                )}
              >
                Slide {i + 1}
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious />
        <CarouselNext />
      </Carousel>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="text-xs text-muted-foreground tabular-nums w-10 text-right">
          {current + 1} / {count}
        </span>
      </div>
    </div>
  )
}
