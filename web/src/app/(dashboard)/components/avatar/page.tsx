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
  NoImageFallbackVariant,
  RoundedVariant,
  IconVariant,
  ColorfulVariant,
  StatusBadgeOnlineVariant,
  IconBadgeVariant,
  NumberBadgeVariant,
  WithTooltipVariant,
  AvatarGroupVariant,
  GroupWithTooltipVariant,
  OverflowIndicatorVariant,
  TextGroupVariant,
  DropdownMenuVariant,
  WithPopoverVariant,
  AbsoluteIconVariant,
  LoadingStateVariant,
  RingStatusVariant,
  WithProfileDetailsVariant,
  CollaboratorsViewVariant,
  MultipleStatusTypesVariant,
  AdvancedCompositionVariant,
} from "@/components/pages/components-avatar/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "No image (fallback)",
    description: "Shows initials when no image source is available.",
    component: NoImageFallbackVariant,
  },
  {
    title: "Rounded",
    description: "Square-ish avatar with rounded-md corners instead of a full circle.",
    component: RoundedVariant,
  },
  {
    title: "Icon",
    description: "Uses a Lucide User icon as the avatar content instead of initials.",
    component: IconVariant,
  },
  {
    title: "Colorful",
    description: "A row of avatars with distinct colored fallback backgrounds.",
    component: ColorfulVariant,
  },
  {
    title: "Status badge (online)",
    description: "Small green status dot at the bottom-right signals the user is online.",
    component: StatusBadgeOnlineVariant,
  },
  {
    title: "Icon badge",
    description: "An overlaid icon badge (BadgeCheck) marks a verified account.",
    component: IconBadgeVariant,
  },
  {
    title: "Number badge",
    description: "A numeric Badge at top-right indicates unread notifications.",
    component: NumberBadgeVariant,
  },
  {
    title: "With tooltip",
    description: "Hovering the avatar reveals a tooltip with the user's full name.",
    component: WithTooltipVariant,
  },
  {
    title: "Avatar group",
    description: "Four avatars stacked with overlapping rings for team display.",
    component: AvatarGroupVariant,
  },
  {
    title: "Group + tooltip",
    description: "Stacked group where each avatar shows a name tooltip on hover.",
    component: GroupWithTooltipVariant,
  },
  {
    title: "Overflow indicator",
    description: 'Three avatars plus a "+4" overflow circle for large groups.',
    component: OverflowIndicatorVariant,
  },
  {
    title: "Text + group",
    description: 'Compact avatar group followed by a "7 members" count label.',
    component: TextGroupVariant,
  },
  {
    title: "Dropdown menu",
    description: "Clicking the avatar opens a dropdown with profile actions.",
    component: DropdownMenuVariant,
  },
  {
    title: "With popover",
    description: "Clicking the avatar opens a popover card with profile details.",
    component: WithPopoverVariant,
  },
  {
    title: "Absolute icon",
    description: "An edit (Camera) button is absolutely positioned over the avatar.",
    component: AbsoluteIconVariant,
  },
  {
    title: "Loading state",
    description: 'Toggle between a Skeleton placeholder and the real avatar with "Reload".',
    component: LoadingStateVariant,
  },
  {
    title: "Ring status",
    description: "Colored ring (green/amber/red) around the avatar indicates presence.",
    component: RingStatusVariant,
  },
  {
    title: "With profile details",
    description: "Avatar beside name and role text — a compact user row.",
    component: WithProfileDetailsVariant,
  },
  {
    title: "Collaborators view",
    description: "A small list of team members with avatar, name, and role.",
    component: CollaboratorsViewVariant,
  },
  {
    title: "Multiple status types",
    description: "Showcases online, away, busy, offline, and verified status dots.",
    component: MultipleStatusTypesVariant,
  },
  {
    title: "Advanced composition",
    description: "Rich card combining avatar ring, status dot, name, and a Pro badge.",
    component: AdvancedCompositionVariant,
  },
]

export default function AvatarPage() {
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
            <BreadcrumbPage>Avatar</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Avatar</h1>
        <p className="text-sm text-muted-foreground">
          An image element with a fallback for representing the user. Browse our
          collection of {VARIANTS.length} Avatar variants.
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
            <CardContent className="flex items-center justify-center py-6">
              <Component />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
