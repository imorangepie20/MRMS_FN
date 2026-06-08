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
  SingleVariant,
  RangeVariant,
  MultipleVariant,
  DualMonthVariant,
  DropdownVariant,
  WithTodayButtonVariant,
  WithTimePickerVariant,
  PresetRangesVariant,
  TimeSlotsVariant,
  DisabledDatesVariant,
  DateOfBirthVariant,
  EventsVariant,
  WithFooterVariant,
  InPopoverVariant,
  WeekNumbersVariant,
} from "@/components/pages/components-calendar/variants"

const VARIANTS: {
  title: string
  description: string
  component: React.FC
}[] = [
  {
    title: "Single",
    description: "Select a single date. June 15 2026 pre-selected.",
    component: SingleVariant,
  },
  {
    title: "Range",
    description: "Select a start and end date to define a range.",
    component: RangeVariant,
  },
  {
    title: "Multiple",
    description: "Select multiple individual dates at once.",
    component: MultipleVariant,
  },
  {
    title: "Dual month",
    description: "Two-month view for easier range selection across months.",
    component: DualMonthVariant,
  },
  {
    title: "Month/Year dropdown",
    description: "Navigate directly to any month and year via dropdowns.",
    component: DropdownVariant,
  },
  {
    title: "With Today button",
    description: "A button below the calendar that jumps selection to today.",
    component: WithTodayButtonVariant,
  },
  {
    title: "With time picker",
    description: "Combine a date picker with a time input for full datetime selection.",
    component: WithTimePickerVariant,
  },
  {
    title: "Preset ranges",
    description: "Quick-select common date ranges like Last 7 days or Last month.",
    component: PresetRangesVariant,
  },
  {
    title: "Time slots",
    description: "Pick a date and then choose an available appointment time slot.",
    component: TimeSlotsVariant,
  },
  {
    title: "Disabled dates",
    description: "Weekends are disabled — only weekdays can be selected.",
    component: DisabledDatesVariant,
  },
  {
    title: "Date of birth",
    description: "Dropdown navigation with a wide year range for birthdate entry.",
    component: DateOfBirthVariant,
  },
  {
    title: "Events / booked",
    description: "Highlighted dates indicate booked or event days.",
    component: EventsVariant,
  },
  {
    title: "With footer",
    description: "Displays the currently selected date in a footer below the grid.",
    component: WithFooterVariant,
  },
  {
    title: "In a popover",
    description: "A date-picker button that opens the calendar in a popover.",
    component: InPopoverVariant,
  },
  {
    title: "Week numbers",
    description: "Shows ISO week numbers alongside each row for reference.",
    component: WeekNumbersVariant,
  },
]

export default function CalendarPage() {
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
            <BreadcrumbPage>Calendar</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
        <p className="text-sm text-muted-foreground">
          A date field component that allows users to enter and edit dates.
          Browse our collection of {VARIANTS.length} Calendar variants.
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
