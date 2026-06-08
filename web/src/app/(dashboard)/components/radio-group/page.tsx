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
  WithDescriptionsVariant,
  CardVariant,
  BillingFrequencyVariant,
  ContactMethodVariant,
  PaymentMethodVariant,
  DeliveryOptionsVariant,
  RatingFilterVariant,
  ProductColorVariant,
  PlanSelectionVariant,
  ComputeResourcesVariant,
  DataCenterRegionVariant,
  SubscriptionPlansVariant,
  AccountTypeVariant,
  DisabledVariant,
} from "@/components/pages/components-radio-group/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Basic",
    description: "Simple radio group with Default, Comfortable, and Compact options.",
    component: BasicVariant,
  },
  {
    title: "With descriptions",
    description: "Each option includes a label and a muted description line.",
    component: WithDescriptionsVariant,
  },
  {
    title: "Card",
    description: "Bordered selectable cards where the radio circle is visually hidden.",
    component: CardVariant,
  },
  {
    title: "Billing frequency",
    description: "Horizontal radio group for Monthly, Quarterly, and Yearly billing cycles.",
    component: BillingFrequencyVariant,
  },
  {
    title: "Contact method",
    description: "Email, SMS, and Push options each paired with a leading icon.",
    component: ContactMethodVariant,
  },
  {
    title: "Payment method",
    description: "Card-style rows for Credit Card, PayPal, and Apple Pay.",
    component: PaymentMethodVariant,
  },
  {
    title: "Delivery options",
    description: "Two large cards for Home delivery and Store pickup with descriptions.",
    component: DeliveryOptionsVariant,
  },
  {
    title: "Rating filter",
    description: "Filter by star rating from 5 stars down to 1 star.",
    component: RatingFilterVariant,
  },
  {
    title: "Product color",
    description: "Color swatch radios displayed as colored circles with a ring on selection.",
    component: ProductColorVariant,
  },
  {
    title: "Plan selection",
    description: "Starter vs Professional plan cards with feature lists and a Recommended badge.",
    component: PlanSelectionVariant,
  },
  {
    title: "Compute resources",
    description: "Grid of CPU core options displayed as small selectable boxes.",
    component: ComputeResourcesVariant,
  },
  {
    title: "Data center region",
    description: "North America, Europe, and Asia Pacific options with Globe icon and sub-regions.",
    component: DataCenterRegionVariant,
  },
  {
    title: "Subscription plans",
    description: "Basic, Pro, Business, and Enterprise card rows with pricing.",
    component: SubscriptionPlansVariant,
  },
  {
    title: "Account type",
    description: "Personal vs Business selection with large icon cards and descriptions.",
    component: AccountTypeVariant,
  },
  {
    title: "Disabled",
    description: "A radio group where one option is disabled while others remain interactive.",
    component: DisabledVariant,
  },
]

export default function RadioGroupPage() {
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
            <BreadcrumbPage>Radio Group</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Radio Group</h1>
        <p className="text-sm text-muted-foreground">
          A set of checkable buttons where no more than one can be checked at a time. Browse our
          collection of {VARIANTS.length} Radio Group variants.
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
