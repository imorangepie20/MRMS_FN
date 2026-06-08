"use client"

import * as React from "react"
import {
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  type ColumnOrderState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArrowUpDown, ChevronDown, ChevronRight, GripVertical, MoreHorizontal, Pencil, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ─── Shared dataset ────────────────────────────────────────────────────────────

export type PaymentStatus = "success" | "processing" | "failed"

export interface Payment {
  id: string
  status: PaymentStatus
  email: string
  amount: number
}

const PAYMENTS: Payment[] = [
  { id: "pay-1", status: "success",    email: "ken99@example.com",        amount: 316 },
  { id: "pay-2", status: "processing", email: "abe45@example.com",        amount: 242 },
  { id: "pay-3", status: "failed",     email: "monserrat44@example.com",  amount: 837 },
  { id: "pay-4", status: "success",    email: "silas22@example.com",      amount: 874 },
  { id: "pay-5", status: "processing", email: "carmella@example.com",     amount: 721 },
]

const PAYMENTS_EXTENDED: Payment[] = [
  ...PAYMENTS,
  { id: "pay-6",  status: "failed",     email: "felix88@example.com",      amount: 195 },
  { id: "pay-7",  status: "success",    email: "ada.l@example.com",        amount: 540 },
  { id: "pay-8",  status: "processing", email: "oscar.m@example.com",      amount: 672 },
  { id: "pay-9",  status: "failed",     email: "nora.k@example.com",       amount: 418 },
  { id: "pay-10", status: "success",    email: "liam.j@example.com",       amount: 930 },
]

const statusVariant: Record<PaymentStatus, string> = {
  success:    "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  processing: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  failed:     "bg-red-500/15 text-red-600 dark:text-red-400",
}

function StatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge variant="secondary" className={statusVariant[status]}>
      {status}
    </Badge>
  )
}

const fmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" })

// ─── 1. Basic with selection ───────────────────────────────────────────────────

const basicColumns: ColumnDef<Payment>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={
          table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
        }
        onCheckedChange={(v) => table.toggleAllPageRowsSelected(!!v)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(v) => row.toggleSelected(!!v)}
        aria-label="Select row"
      />
    ),
    enableSorting: false,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="-ml-3"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Email <ArrowUpDown className="ml-2 size-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="lowercase text-muted-foreground">{row.getValue("email")}</span>
    ),
  },
  {
    accessorKey: "amount",
    header: () => <div className="text-right">Amount</div>,
    cell: ({ row }) => (
      <div className="text-right font-medium tabular-nums">
        {fmt.format(row.getValue("amount"))}
      </div>
    ),
  },
]

export function BasicSelectionVariant() {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})
  const [rowSelection, setRowSelection] = React.useState({})

  const table = useReactTable({
    data: PAYMENTS,
    columns: basicColumns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { sorting, columnFilters, columnVisibility, rowSelection },
    initialState: { pagination: { pageSize: 5 } },
  })

  return (
    <div data-testid="dt-basic" className="space-y-3">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={basicColumns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── 2. Expandable rows ────────────────────────────────────────────────────────

interface Order {
  id: string
  order: string
  customer: string
  status: PaymentStatus
  date: string
  total: number
  shipping: string
  items: string
}

const ORDERS: Order[] = [
  {
    id: "ord-1",
    order: "#ORD-1001",
    customer: "Ken Thompson",
    status: "success",
    date: "2025-11-03",
    total: 316,
    shipping: "123 Main St, Springfield, IL 62701",
    items: "2× Widget Pro, 1× Gadget Plus",
  },
  {
    id: "ord-2",
    order: "#ORD-1002",
    customer: "Abe Lincoln",
    status: "processing",
    date: "2025-11-05",
    total: 242,
    shipping: "456 Oak Ave, Portland, OR 97201",
    items: "1× Starter Kit",
  },
  {
    id: "ord-3",
    order: "#ORD-1003",
    customer: "Monserrat Villa",
    status: "failed",
    date: "2025-11-06",
    total: 837,
    shipping: "789 Pine Rd, Austin, TX 73301",
    items: "5× Premium Pack",
  },
  {
    id: "ord-4",
    order: "#ORD-1004",
    customer: "Silas Green",
    status: "success",
    date: "2025-11-07",
    total: 874,
    shipping: "321 Elm Dr, Seattle, WA 98101",
    items: "3× Enterprise License",
  },
]

export function ExpandableRowsVariant() {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set())

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10" />
            <TableHead>Order</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Total</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {ORDERS.map((order) => (
            <React.Fragment key={order.id}>
              <TableRow>
                <TableCell>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-7"
                    onClick={() => toggle(order.id)}
                    aria-label={expanded.has(order.id) ? "Collapse row" : "Expand row"}
                  >
                    {expanded.has(order.id) ? (
                      <ChevronDown className="size-4" />
                    ) : (
                      <ChevronRight className="size-4" />
                    )}
                  </Button>
                </TableCell>
                <TableCell className="font-medium">{order.order}</TableCell>
                <TableCell>{order.customer}</TableCell>
                <TableCell><StatusBadge status={order.status} /></TableCell>
                <TableCell className="text-muted-foreground">{order.date}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt.format(order.total)}</TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <Button variant="ghost" size="icon" className="size-8">
                          <MoreHorizontal className="size-4" />
                        </Button>
                      }
                    />
                    <DropdownMenuContent align="end">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuItem>View order</DropdownMenuItem>
                      <DropdownMenuItem>Print invoice</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive">Cancel order</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
              {expanded.has(order.id) && (
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableCell />
                  <TableCell colSpan={6} className="py-3">
                    <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
                      <div>
                        <span className="font-medium text-foreground">Shipping address: </span>
                        <span className="text-muted-foreground">{order.shipping}</span>
                      </div>
                      <div>
                        <span className="font-medium text-foreground">Items: </span>
                        <span className="text-muted-foreground">{order.items}</span>
                      </div>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ─── 3. Vertical scroll ────────────────────────────────────────────────────────

const scrollColumns: ColumnDef<Payment>[] = [
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="-ml-3"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Email <ArrowUpDown className="ml-2 size-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="lowercase text-muted-foreground">{row.getValue("email")}</span>
    ),
  },
  {
    accessorKey: "amount",
    header: () => <div className="text-right">Amount</div>,
    cell: ({ row }) => (
      <div className="text-right font-medium tabular-nums">
        {fmt.format(row.getValue("amount"))}
      </div>
    ),
  },
]

export function VerticalScrollVariant() {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [rowSelection, setRowSelection] = React.useState({})

  const table = useReactTable({
    data: PAYMENTS_EXTENDED,
    columns: scrollColumns,
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { sorting, rowSelection },
    initialState: { pagination: { pageSize: 10 } },
  })

  return (
    <div className="space-y-3">
      <div className="rounded-md border">
        <ScrollArea className="max-h-72">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  {hg.headers.map((h) => (
                    <TableHead key={h.id}>
                      {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">
          {PAYMENTS_EXTENDED.length} rows total
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── 4. Draggable rows ────────────────────────────────────────────────────────

interface DraggableRowProps {
  row: import("@tanstack/react-table").Row<Payment>
}

function DraggableRow({ row }: DraggableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: row.original.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <TableRow
      ref={setNodeRef}
      style={style}
      data-state={row.getIsSelected() && "selected"}
    >
      <TableCell>
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab touch-none text-muted-foreground hover:text-foreground focus:outline-none"
          aria-label="Drag to reorder"
        >
          <GripVertical className="size-4" />
        </button>
      </TableCell>
      {row.getVisibleCells().map((cell) => (
        <TableCell key={cell.id}>
          {flexRender(cell.column.columnDef.cell, cell.getContext())}
        </TableCell>
      ))}
    </TableRow>
  )
}

const draggableRowColumns: ColumnDef<Payment>[] = [
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
  },
  {
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => (
      <span className="lowercase text-muted-foreground">{row.getValue("email")}</span>
    ),
  },
  {
    accessorKey: "amount",
    header: () => <div className="text-right">Amount</div>,
    cell: ({ row }) => (
      <div className="text-right font-medium tabular-nums">
        {fmt.format(row.getValue("amount"))}
      </div>
    ),
  },
]

export function DraggableRowsVariant() {
  const [data, setData] = React.useState<Payment[]>(PAYMENTS)

  const table = useReactTable({
    data,
    columns: draggableRowColumns,
    getCoreRowModel: getCoreRowModel(),
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setData((prev) => {
        const oldIndex = prev.findIndex((p) => p.id === active.id)
        const newIndex = prev.findIndex((p) => p.id === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  const rowIds = data.map((p) => p.id)

  return (
    <div className="rounded-md border">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                <TableHead className="w-10" />
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            <SortableContext items={rowIds} strategy={verticalListSortingStrategy}>
              {table.getRowModel().rows.map((row) => (
                <DraggableRow key={row.id} row={row} />
              ))}
            </SortableContext>
          </TableBody>
        </Table>
      </DndContext>
    </div>
  )
}

// ─── 5. Draggable columns ─────────────────────────────────────────────────────

interface DraggableHeaderProps {
  header: import("@tanstack/react-table").Header<Payment, unknown>
}

function DraggableHeader({ header }: DraggableHeaderProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: header.column.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: "grab",
    whiteSpace: "nowrap",
  }

  return (
    <TableHead ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
    </TableHead>
  )
}

const draggableColBaseColumns: ColumnDef<Payment>[] = [
  {
    id: "status",
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
  },
  {
    id: "email",
    accessorKey: "email",
    header: "Email",
    cell: ({ row }) => (
      <span className="lowercase text-muted-foreground">{row.getValue("email")}</span>
    ),
  },
  {
    id: "amount",
    accessorKey: "amount",
    header: () => <div className="text-right">Amount</div>,
    cell: ({ row }) => (
      <div className="text-right font-medium tabular-nums">
        {fmt.format(row.getValue("amount"))}
      </div>
    ),
  },
  {
    id: "actions",
    header: "Actions",
    enableHiding: false,
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="size-8">
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem>View details</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
]

export function DraggableColumnsVariant() {
  const [columnOrder, setColumnOrder] = React.useState<ColumnOrderState>(
    draggableColBaseColumns.map((c) => c.id as string)
  )

  const table = useReactTable({
    data: PAYMENTS,
    columns: draggableColBaseColumns,
    getCoreRowModel: getCoreRowModel(),
    state: { columnOrder },
    onColumnOrderChange: setColumnOrder,
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setColumnOrder((prev) => {
        const oldIndex = prev.indexOf(active.id as string)
        const newIndex = prev.indexOf(over.id as string)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Drag column headers to reorder</p>
      <div className="rounded-md border">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((hg) => (
                <TableRow key={hg.id}>
                  <SortableContext items={columnOrder} strategy={horizontalListSortingStrategy}>
                    {hg.headers.map((h) => (
                      <DraggableHeader key={h.id} header={h} />
                    ))}
                  </SortableContext>
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DndContext>
      </div>
    </div>
  )
}

// ─── 6. With action buttons ───────────────────────────────────────────────────

const actionColumns = (
  onDelete: (id: string) => void
): ColumnDef<Payment>[] => [
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <StatusBadge status={row.getValue("status")} />,
  },
  {
    accessorKey: "email",
    header: ({ column }) => (
      <Button
        variant="ghost"
        className="-ml-3"
        onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
      >
        Email <ArrowUpDown className="ml-2 size-4" />
      </Button>
    ),
    cell: ({ row }) => (
      <span className="lowercase text-muted-foreground">{row.getValue("email")}</span>
    ),
  },
  {
    accessorKey: "amount",
    header: () => <div className="text-right">Amount</div>,
    cell: ({ row }) => (
      <div className="text-right font-medium tabular-nums">
        {fmt.format(row.getValue("amount"))}
      </div>
    ),
  },
  {
    id: "actions",
    header: "Actions",
    cell: ({ row }) => (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label="Edit row"
        >
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-destructive hover:text-destructive"
          aria-label="Delete row"
          onClick={() => onDelete(row.original.id)}
        >
          <Trash2 className="size-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="size-8">
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>More actions</DropdownMenuLabel>
            <DropdownMenuItem>Copy payment ID</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>View customer</DropdownMenuItem>
            <DropdownMenuItem>View payment details</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ),
  },
]

export function ActionButtonsVariant() {
  const [data, setData] = React.useState<Payment[]>(PAYMENTS)
  const [sorting, setSorting] = React.useState<SortingState>([])

  const handleDelete = React.useCallback((id: string) => {
    setData((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const columns = React.useMemo(() => actionColumns(handleDelete), [handleDelete])

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: { sorting },
  })

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((hg) => (
            <TableRow key={hg.id}>
              {hg.headers.map((h) => (
                <TableHead key={h.id}>
                  {h.isPlaceholder ? null : flexRender(h.column.columnDef.header, h.getContext())}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                No rows remaining.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
