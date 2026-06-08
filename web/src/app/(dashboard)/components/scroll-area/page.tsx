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
  TagsVerticalVariant,
  UserListVariant,
  StickyHeaderFeedVariant,
  HorizontalAvatarsVariant,
  ChatMessagesVariant,
  HorizontalCardsVariant,
} from "@/components/pages/components-scroll-area/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Tags (vertical)",
    description: "Classic vertical scroll area with 50 version tags separated by dividers.",
    component: TagsVerticalVariant,
  },
  {
    title: "User list",
    description: "Scrollable list of users with avatar initials, name, and email.",
    component: UserListVariant,
  },
  {
    title: "Sticky header feed",
    description: "Notification feed grouped under sticky Today / Yesterday / This Week headers.",
    component: StickyHeaderFeedVariant,
  },
  {
    title: "Horizontal avatars",
    description: "Horizontally scrollable row of avatar cards using a horizontal ScrollBar.",
    component: HorizontalAvatarsVariant,
  },
  {
    title: "Chat messages",
    description: "Scrollable chat thread with alternating incoming and outgoing bubble styles.",
    component: ChatMessagesVariant,
  },
  {
    title: "Horizontal cards",
    description: "Horizontal scroll gallery of gradient cover cards with title and subtitle.",
    component: HorizontalCardsVariant,
  },
]

export default function ScrollAreaPage() {
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
            <BreadcrumbPage>Scroll Area</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Scroll Area</h1>
        <p className="text-sm text-muted-foreground">
          Augments native scroll functionality for custom, cross-browser styling. Browse our
          collection of {VARIANTS.length} Scroll Area variants.
        </p>
      </div>

      {/* Grid */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {VARIANTS.map(({ title, description, component: Component }) => (
          <Card key={title}>
            <CardHeader>
              <CardTitle>{title}</CardTitle>
              <p className="text-sm text-muted-foreground">{description}</p>
            </CardHeader>
            <CardContent className="py-4">
              <Component />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
