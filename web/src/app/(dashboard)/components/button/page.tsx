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
  DefaultVariant,
  SecondaryVariant,
  OutlineVariant,
  GhostVariant,
  LinkVariant,
  DestructiveVariant,
  SizesVariant,
  LeadingIconVariant,
  TrailingIconVariant,
  IconOnlyVariant,
  LoadingVariant,
  DisabledVariant,
  WithBadgeVariant,
  FullWidthVariant,
  RoundedVariant,
  GradientVariant,
  GoogleVariant,
  GitHubVariant,
  AppleVariant,
  XTwitterVariant,
  FacebookVariant,
  ButtonGroupVariant,
  WithTooltipVariant,
  DestructiveOutlineVariant,
  SoftVariant,
  SplitButtonVariant,
  BlockCTAVariant,
} from "@/components/pages/components-button/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Default",
    description: "The primary action button using the default color palette.",
    component: DefaultVariant,
  },
  {
    title: "Secondary",
    description: "A muted secondary palette for lower-emphasis actions.",
    component: SecondaryVariant,
  },
  {
    title: "Outline",
    description: "Bordered button with a transparent background.",
    component: OutlineVariant,
  },
  {
    title: "Ghost",
    description: "No background or border — minimal visual footprint.",
    component: GhostVariant,
  },
  {
    title: "Link",
    description: "Styled as a hyperlink while retaining button semantics.",
    component: LinkVariant,
  },
  {
    title: "Destructive",
    description: "Signals a dangerous or irreversible action with a red tint.",
    component: DestructiveVariant,
  },
  {
    title: "Sizes",
    description: "Small, default, and large sizes plus an icon-only variant.",
    component: SizesVariant,
  },
  {
    title: "Leading icon",
    description: "An icon precedes the label for added context.",
    component: LeadingIconVariant,
  },
  {
    title: "Trailing icon",
    description: "An icon follows the label to indicate direction or action.",
    component: TrailingIconVariant,
  },
  {
    title: "Icon only",
    description: "Square icon buttons across multiple visual variants.",
    component: IconOnlyVariant,
  },
  {
    title: "Loading",
    description: "Click to trigger a 1.5s loading state with a spinner.",
    component: LoadingVariant,
  },
  {
    title: "Disabled",
    description: "A button that is not interactive and visually subdued.",
    component: DisabledVariant,
  },
  {
    title: "With badge",
    description: "A notification count badge positioned over the button.",
    component: WithBadgeVariant,
  },
  {
    title: "Full width",
    description: "Button that spans the full width of its container.",
    component: FullWidthVariant,
  },
  {
    title: "Rounded / pill",
    description: "Fully rounded pill-shaped buttons for a softer look.",
    component: RoundedVariant,
  },
  {
    title: "Gradient",
    description: "Eye-catching button with a color gradient background.",
    component: GradientVariant,
  },
  {
    title: "Google",
    description: "OAuth-style button for signing in with Google.",
    component: GoogleVariant,
  },
  {
    title: "GitHub",
    description: "OAuth-style button for signing in with GitHub.",
    component: GitHubVariant,
  },
  {
    title: "Apple",
    description: "OAuth-style button for signing in with Apple.",
    component: AppleVariant,
  },
  {
    title: "X (Twitter)",
    description: "OAuth-style button for signing in with X.",
    component: XTwitterVariant,
  },
  {
    title: "Facebook",
    description: "OAuth-style button for signing in with Facebook.",
    component: FacebookVariant,
  },
  {
    title: "Button group",
    description: "Segmented control — click to switch the active segment.",
    component: ButtonGroupVariant,
  },
  {
    title: "With tooltip",
    description: "Hover over the button to reveal a tooltip.",
    component: WithTooltipVariant,
  },
  {
    title: "Destructive outline",
    description: "Outline-styled destructive button for secondary danger actions.",
    component: DestructiveOutlineVariant,
  },
  {
    title: "Soft / subtle",
    description: "Low-contrast tinted backgrounds for gentle emphasis.",
    component: SoftVariant,
  },
  {
    title: "Split button",
    description: "Primary action plus a dropdown chevron for additional options.",
    component: SplitButtonVariant,
  },
  {
    title: "Block CTA",
    description: "Large full-width gradient call-to-action button.",
    component: BlockCTAVariant,
  },
]

export default function ButtonPage() {
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
            <BreadcrumbPage>Button</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Button</h1>
        <p className="text-sm text-muted-foreground">
          Displays a button or a component that looks like a button. Browse our
          collection of {VARIANTS.length} Button variants.
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
