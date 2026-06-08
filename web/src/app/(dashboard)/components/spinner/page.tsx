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
  SizesVariant,
  WithLabelVariant,
  ColoredVariant,
  InButtonVariant,
  ValidatingVariant,
  DotsVariant,
  BarsVariant,
  RingVariant,
  PulseVariant,
  CardOverlayVariant,
  DownloadProgressVariant,
  PaymentProcessingVariant,
  CenteredBlockVariant,
} from "@/components/pages/components-spinner/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Basic",
    description: "A single spinning Loader icon indicating a loading state.",
    component: BasicVariant,
  },
  {
    title: "Sizes",
    description: "Spinner in five sizes: xs, sm, md, lg, and xl.",
    component: SizesVariant,
  },
  {
    title: "With label",
    description: "A spinner paired with a text label beside it.",
    component: WithLabelVariant,
  },
  {
    title: "Colored",
    description: "Spinners in primary, emerald, amber, and rose color variants.",
    component: ColoredVariant,
  },
  {
    title: "In a button",
    description: "A button with a leading spinner and a 'Please wait' label.",
    component: InButtonVariant,
  },
  {
    title: "Validating",
    description: "Click Send to trigger a 1.5 s validation spinner inline.",
    component: ValidatingVariant,
  },
  {
    title: "Dots",
    description: "Three bouncing dots with staggered animation delays.",
    component: DotsVariant,
  },
  {
    title: "Bars",
    description: "Animated equalizer bars with staggered pulse animations.",
    component: BarsVariant,
  },
  {
    title: "Ring",
    description: "A CSS ring spinner using a border with a contrasting top color.",
    component: RingVariant,
  },
  {
    title: "Pulse",
    description: "A pulsing ping circle that radiates outward.",
    component: PulseVariant,
  },
  {
    title: "Card overlay",
    description: "A blurred overlay on a card showing a centered spinner.",
    component: CardOverlayVariant,
  },
  {
    title: "Download progress",
    description: "A spinner alongside a progress bar for file download feedback.",
    component: DownloadProgressVariant,
  },
  {
    title: "Payment processing",
    description: "A centered payment processing state with spinner and amount.",
    component: PaymentProcessingVariant,
  },
  {
    title: "Centered block",
    description: "A bordered dashed container with a centered spinner and label.",
    component: CenteredBlockVariant,
  },
]

export default function SpinnerPage() {
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
            <BreadcrumbPage>Spinner</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Spinner</h1>
        <p className="text-sm text-muted-foreground">
          An indicator that can be used to show a loading state. Browse our collection of{" "}
          {VARIANTS.length} Spinner variants.
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
