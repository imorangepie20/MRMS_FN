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
  WithLabelVariant,
  EmailVariant,
  PasswordShowHideVariant,
  NumberVariant,
  SearchVariant,
  FileVariant,
  DisabledVariant,
  ReadonlyVariant,
  LeadingIconVariant,
  TrailingIconVariant,
  PrefixUrlVariant,
  CurrencyVariant,
  WithButtonVariant,
  ClearButtonVariant,
  CharCounterVariant,
  ErrorStateVariant,
  SuccessStateVariant,
  HelperTextVariant,
  OtpVariant,
  PhoneVariant,
  PasswordStrengthVariant,
  DateVariant,
  TagsVariant,
  SizesVariant,
} from "@/components/pages/components-input/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Basic",
    description: "A plain text input with a placeholder.",
    component: BasicVariant,
  },
  {
    title: "With label",
    description: "An email input paired with an accessible label.",
    component: WithLabelVariant,
  },
  {
    title: "Email",
    description: "An email input with a leading Mail icon inside the field.",
    component: EmailVariant,
  },
  {
    title: "Password (show/hide)",
    description: "A password input with a toggle to reveal or hide the value.",
    component: PasswordShowHideVariant,
  },
  {
    title: "Number",
    description: "A number input for numeric entry.",
    component: NumberVariant,
  },
  {
    title: "Search",
    description: "A search input with a leading Search icon.",
    component: SearchVariant,
  },
  {
    title: "File",
    description: "A file upload input styled with Tailwind.",
    component: FileVariant,
  },
  {
    title: "Disabled",
    description: "An input in a disabled state — not focusable or editable.",
    component: DisabledVariant,
  },
  {
    title: "Readonly",
    description: "An input that displays a value but cannot be edited.",
    component: ReadonlyVariant,
  },
  {
    title: "Leading icon",
    description: "An input with an icon placed on the leading (left) side.",
    component: LeadingIconVariant,
  },
  {
    title: "Trailing icon",
    description: "An input with an icon placed on the trailing (right) side.",
    component: TrailingIconVariant,
  },
  {
    title: "Prefix / URL",
    description: "An input with a \"https://\" text prefix addon.",
    component: PrefixUrlVariant,
  },
  {
    title: "Currency",
    description: "A currency input with a leading $ icon and trailing USD label.",
    component: CurrencyVariant,
  },
  {
    title: "With button",
    description: "An email input with an attached Subscribe button.",
    component: WithButtonVariant,
  },
  {
    title: "Clear button",
    description: "A search input with an X button that clears the value.",
    component: ClearButtonVariant,
  },
  {
    title: "Character counter",
    description: "An input that shows a live character count against a 50-char limit.",
    component: CharCounterVariant,
  },
  {
    title: "Error state",
    description: "An input in an error state with a destructive helper message.",
    component: ErrorStateVariant,
  },
  {
    title: "Success state",
    description: "An input in a success state with a green helper message.",
    component: SuccessStateVariant,
  },
  {
    title: "Helper text",
    description: "An input with a muted helper text description below.",
    component: HelperTextVariant,
  },
  {
    title: "OTP",
    description: "A row of 6 single-character inputs with automatic focus advance.",
    component: OtpVariant,
  },
  {
    title: "Phone",
    description: "A phone number input with an attached country code selector.",
    component: PhoneVariant,
  },
  {
    title: "Password strength",
    description: "A password input with a strength bar and requirements checklist.",
    component: PasswordStrengthVariant,
  },
  {
    title: "Date",
    description: "A native date picker input.",
    component: DateVariant,
  },
  {
    title: "Tags",
    description: "An input that adds chip tags on Enter; each tag can be removed.",
    component: TagsVariant,
  },
  {
    title: "Sizes",
    description: "Small, default, and large size variants of the input.",
    component: SizesVariant,
  },
]

export default function InputPage() {
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
            <BreadcrumbPage>Input</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Input</h1>
        <p className="text-sm text-muted-foreground">
          Displays a form input field or a component that looks like an input
          field. Browse our collection of {VARIANTS.length} Input variants.
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
