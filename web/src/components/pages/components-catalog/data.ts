export type ComponentCategory =
  | "All"
  | "Base"
  | "Data Display"
  | "Navigation"
  | "Form"
  | "Feedback"

export interface ComponentEntry {
  name: string
  variants: number
  category: Exclude<ComponentCategory, "All">
  icon: string
  livePreview?: boolean
  href?: string
}

export const COMPONENTS: ComponentEntry[] = [
  { name: "Accordion",        variants: 12, category: "Base",         icon: "ChevronDown",            href: "/components/accordion" },
  { name: "Alert",            variants: 15, category: "Feedback",     icon: "TriangleAlert",        href: "/components/alert" },
  { name: "Alert Dialog",     variants: 16, category: "Feedback",     icon: "MessageSquareWarning", href: "/components/alert-dialog" },
  { name: "Autocomplete",     variants:  5, category: "Form",         icon: "TextCursorInput",    href: "/components/autocomplete" },
  { name: "Avatar",           variants: 21, category: "Data Display", icon: "CircleUser",         livePreview: true, href: "/components/avatar" },
  { name: "Badge",            variants: 12, category: "Data Display", icon: "Tag",                livePreview: true, href: "/components/badge" },
  { name: "Breadcrumb",       variants:  6, category: "Navigation",   icon: "ChevronRight",       href: "/components/breadcrumb" },
  { name: "Button",           variants: 27, category: "Form",         icon: "MousePointerClick",  livePreview: true, href: "/components/button" },
  { name: "Button Group",     variants: 20, category: "Form",         icon: "Group",              href: "/components/button-group" },
  { name: "Calendar",         variants: 15, category: "Form",         icon: "Calendar",           href: "/components/calendar" },
  { name: "Card",             variants:  8, category: "Base",         icon: "Square",             livePreview: true, href: "/components/card" },
  { name: "Carousel",         variants: 12, category: "Data Display", icon: "GalleryHorizontal", href: "/components/carousel" },
  { name: "Checkbox",         variants: 13, category: "Form",         icon: "CheckSquare",        livePreview: true, href: "/components/checkbox" },
  { name: "Collapsible",      variants:  8, category: "Base",         icon: "ChevronsUpDown",       href: "/components/collapsible" },
  { name: "Combobox",         variants: 12, category: "Form",         icon: "ListFilter",         href: "/components/combobox" },
  { name: "Command",          variants:  9, category: "Navigation",   icon: "Command",            href: "/components/command" },
  { name: "Context Menu",     variants:  1, category: "Navigation",   icon: "MousePointer2", href: "/components/context-menu" },
  { name: "Data Table",       variants:  6, category: "Data Display", icon: "Table2",              href: "/components/data-table" },
  { name: "Dialog",           variants: 16, category: "Base",         icon: "AppWindow",          href: "/components/dialog" },
  { name: "Drawer",           variants:  6, category: "Base",         icon: "PanelBottom",        href: "/components/drawer" },
  { name: "Dropdown Menu",    variants: 12, category: "Navigation",   icon: "ChevronDown",        href: "/components/dropdown-menu" },
  { name: "Empty",            variants:  8, category: "Data Display", icon: "Inbox",              href: "/components/empty" },
  { name: "Field",            variants: 10, category: "Form",         icon: "FormInput",          href: "/components/field" },
  { name: "Hover Card",       variants:  3, category: "Base",         icon: "SquareMousePointer", href: "/components/hover-card" },
  { name: "Input",            variants: 25, category: "Form",         icon: "TextCursorInput",    livePreview: true, href: "/components/input" },
  { name: "Item",             variants: 10, category: "Data Display", icon: "List",               href: "/components/item" },
  { name: "Menubar",          variants:  1, category: "Navigation",   icon: "Menu",               href: "/components/menubar" },
  { name: "Native Select",    variants:  9, category: "Form",         icon: "ChevronDown",            href: "/components/native-select" },
  { name: "Navigation Menu",  variants:  4, category: "Navigation",   icon: "Navigation",             href: "/components/navigation-menu" },
  { name: "Pagination",       variants: 12, category: "Navigation",   icon: "Ellipsis",             href: "/components/pagination" },
  { name: "Popover",          variants:  6, category: "Base",         icon: "MessageSquare",      href: "/components/popover" },
  { name: "Progress",         variants: 10, category: "Data Display", icon: "LoaderCircle",       livePreview: true, href: "/components/progress" },
  { name: "Radio Group",      variants: 15, category: "Form",         icon: "CircleDot",          href: "/components/radio-group" },
  { name: "Scroll Area",      variants:  6, category: "Base",         icon: "ScrollText",         href: "/components/scroll-area" },
  { name: "Select",           variants: 15, category: "Form",         icon: "ChevronsUpDown",     livePreview: true, href: "/components/select" },
  { name: "Separator",        variants: 16, category: "Base",         icon: "Minus",              livePreview: true, href: "/components/separator" },
  { name: "Sheet",            variants:  8, category: "Base",         icon: "PanelRight",         href: "/components/sheet" },
  { name: "Skeleton",         variants:  7, category: "Base",         icon: "Loader",             livePreview: true, href: "/components/skeleton" },
  { name: "Slider",           variants: 13, category: "Form",         icon: "SlidersHorizontal",  livePreview: true, href: "/components/slider" },
  { name: "Sonner Toast",     variants: 12, category: "Feedback",     icon: "Bell",               href: "/components/sonner-toast" },
  { name: "Spinner",          variants: 14, category: "Feedback",     icon: "LoaderCircle",       href: "/components/spinner" },
  { name: "Switch",           variants: 10, category: "Form",         icon: "ToggleRight",        livePreview: true },
  { name: "Table",            variants: 12, category: "Data Display", icon: "Table" },
  { name: "Tabs",             variants: 15, category: "Navigation",   icon: "LayoutPanelTop",     livePreview: true },
  { name: "Textarea",         variants: 11, category: "Form",         icon: "FileText" },
  { name: "Toggle",           variants:  7, category: "Form",         icon: "ToggleLeft" },
  { name: "Tooltip",          variants:  8, category: "Base",         icon: "MessageCircle",      livePreview: true },
]

export const CATEGORIES: ComponentCategory[] = [
  "All",
  "Base",
  "Data Display",
  "Navigation",
  "Form",
  "Feedback",
]
