import Link from "next/link"

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  BasicVariant,
  ThreeColumnsVariant,
  DotsNavigationVariant,
  AutoplayLoopVariant,
  VerticalVariant,
  CardCarouselVariant,
  TestimonialsVariant,
  CustomArrowsVariant,
  CustomDotsVariant,
  ThumbnailsVariant,
  RichSlidesVariant,
  ProgressBarVariant,
} from "@/components/pages/components-carousel/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Basic",
    description: "Single slide at a time with previous and next arrow buttons.",
    component: BasicVariant,
  },
  {
    title: "Three columns",
    description: "Three slides visible at once using basis-1/3 on each item.",
    component: ThreeColumnsVariant,
  },
  {
    title: "Dots navigation",
    description: "Dot indicators below the carousel — click to jump to a slide.",
    component: DotsNavigationVariant,
  },
  {
    title: "Autoplay + loop",
    description: "Auto-advances every 2.5 s with looping enabled via Embla Autoplay plugin.",
    component: AutoplayLoopVariant,
  },
  {
    title: "Vertical",
    description: "Vertical orientation using the orientation=\"vertical\" prop.",
    component: VerticalVariant,
  },
  {
    title: "Card carousel",
    description: "Each slide is a content Card with a title and description.",
    component: CardCarouselVariant,
  },
  {
    title: "Testimonials",
    description: "Quote cards with testimonial text, avatar, name, and role.",
    component: TestimonialsVariant,
  },
  {
    title: "Custom arrows",
    description: "Previous / next buttons styled as solid primary circular buttons.",
    component: CustomArrowsVariant,
  },
  {
    title: "Custom dots",
    description: "Line-style indicators — the active dot expands into a pill.",
    component: CustomDotsVariant,
  },
  {
    title: "Thumbnails",
    description: "Clickable thumbnail strip below the main carousel for quick navigation.",
    component: ThumbnailsVariant,
  },
  {
    title: "Rich slides",
    description: "Slides with a gradient image area, heading, and description text.",
    component: RichSlidesVariant,
  },
  {
    title: "Progress bar",
    description: "A progress bar below the carousel reflects the current slide position.",
    component: ProgressBarVariant,
  },
]

export default function CarouselPage() {
  return (
    <div className="flex flex-col gap-8 p-6 pb-12">
      {/* Breadcrumb */}
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/" />}>Home</BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink render={<Link href="/components" />}>
              Components
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>Carousel</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Carousel</h1>
        <p className="text-sm text-muted-foreground">
          A carousel with motion and swipe built using Embla. Browse our collection of{" "}
          {VARIANTS.length} Carousel variants.
        </p>
      </div>

      {/* Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {VARIANTS.map(({ title, description, component: Component }) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <p className="text-sm text-muted-foreground">{description}</p>
            </CardHeader>
            <CardContent className="py-6">
              <Component />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
