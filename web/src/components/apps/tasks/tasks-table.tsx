"use client";

import * as React from "react";
import {
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type FilterFn,
} from "@tanstack/react-table";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  MoreHorizontal,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Check,
  PlusCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  tasks,
  statusOptions,
  priorityOptions,
  type Task,
  type TaskStatus,
  type TaskPriority,
} from "./data";

// Custom filter function for multi-value faceted filtering
const multiValueFilter: FilterFn<Task> = (row, columnId, filterValue: string[]) => {
  if (!filterValue || filterValue.length === 0) return true;
  const value = row.getValue(columnId) as string;
  return filterValue.includes(value);
};

multiValueFilter.autoRemove = (val: string[]) => !val || val.length === 0;

// Faceted filter popover component
function FacetedFilter({
  title,
  options,
  selectedValues,
  onSelectionChange,
  counts,
}: {
  title: string;
  options: { value: string; label: string; icon: React.ElementType }[];
  selectedValues: Set<string>;
  onSelectionChange: (values: Set<string>) => void;
  counts: Map<string, number>;
}) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="h-8 border-dashed gap-1.5">
            <PlusCircle className="size-4" />
            {title}
            {selectedValues.size > 0 && (
              <>
                <span className="mx-1 h-4 w-px bg-border" />
                <Badge variant="secondary" className="h-5 rounded-sm px-1 font-normal text-xs">
                  {selectedValues.size}
                </Badge>
              </>
            )}
          </Button>
        }
      />
      <PopoverContent className="w-[200px] p-0" align="start">
        <div className="p-1">
          {options.map((option) => {
            const isSelected = selectedValues.has(option.value);
            const count = counts.get(option.value) ?? 0;
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                className={cn(
                  "relative flex w-full cursor-default items-center gap-2 rounded-md py-1.5 pl-8 pr-2 text-sm outline-none select-none hover:bg-accent hover:text-accent-foreground",
                )}
                onClick={() => {
                  const next = new Set(selectedValues);
                  if (isSelected) {
                    next.delete(option.value);
                  } else {
                    next.add(option.value);
                  }
                  onSelectionChange(next);
                }}
              >
                <span className="absolute left-2 flex size-4 items-center justify-center">
                  {isSelected && <Check className="size-3.5" />}
                </span>
                <Icon className="size-4 text-muted-foreground" />
                <span>{option.label}</span>
                {count > 0 && (
                  <span className="ml-auto font-mono text-xs text-muted-foreground">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {selectedValues.size > 0 && (
          <>
            <div className="-mx-1 my-1 h-px bg-border" />
            <div className="p-1">
              <button
                className="flex w-full cursor-default items-center justify-center rounded-md py-1.5 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                onClick={() => onSelectionChange(new Set())}
              >
                Clear filters
              </button>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}

// Column sort header helper
function SortHeader({
  column,
  children,
}: {
  column: Parameters<typeof ArrowUpDown>[0] extends never ? never : { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (asc: boolean) => void };
  children: React.ReactNode;
}) {
  const sorted = (column as { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (asc: boolean) => void }).getIsSorted();
  return (
    <Button
      variant="ghost"
      className="-ml-2 gap-1"
      onClick={() =>
        (column as { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (asc: boolean) => void }).toggleSorting(sorted === "asc")
      }
    >
      {children}
      {sorted === "asc" ? (
        <ArrowUp className="size-3.5" />
      ) : sorted === "desc" ? (
        <ArrowDown className="size-3.5" />
      ) : (
        <ArrowUpDown className="size-3.5 opacity-50" />
      )}
    </Button>
  );
}

const labelVariant: Record<Task["label"], "default" | "secondary" | "outline"> = {
  Documentation: "secondary",
  Bug: "destructive" as "outline",
  Feature: "outline",
};

const columns: ColumnDef<Task>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={
          table.getIsSomePageRowsSelected() &&
          !table.getIsAllPageRowsSelected()
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
    enableHiding: false,
  },
  {
    accessorKey: "id",
    header: "Task",
    cell: ({ row }) => (
      <span className="font-medium text-muted-foreground">{row.getValue("id")}</span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: "title",
    header: ({ column }) => (
      <SortHeader column={column as never}>Title</SortHeader>
    ),
    cell: ({ row }) => {
      const label = row.original.label;
      return (
        <div className="flex items-center gap-2 max-w-[500px]">
          <Badge variant={labelVariant[label] as "secondary" | "outline" | "default"}>
            {label}
          </Badge>
          <span className="truncate font-medium">{row.getValue("title")}</span>
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => (
      <SortHeader column={column as never}>Status</SortHeader>
    ),
    cell: ({ row }) => {
      const status = row.getValue("status") as TaskStatus;
      const option = statusOptions.find((o) => o.value === status);
      if (!option) return null;
      const Icon = option.icon;
      return (
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <span>{option.label}</span>
        </div>
      );
    },
    filterFn: multiValueFilter,
  },
  {
    accessorKey: "priority",
    header: ({ column }) => (
      <SortHeader column={column as never}>Priority</SortHeader>
    ),
    cell: ({ row }) => {
      const priority = row.getValue("priority") as TaskPriority;
      const option = priorityOptions.find((o) => o.value === priority);
      if (!option) return null;
      const Icon = option.icon;
      return (
        <div className="flex items-center gap-2">
          <Icon className="size-4 text-muted-foreground" />
          <span>{option.label}</span>
        </div>
      );
    },
    filterFn: multiValueFilter,
  },
  {
    id: "actions",
    enableHiding: false,
    cell: () => (
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="size-8">
              <MoreHorizontal className="size-4" />
              <span className="sr-only">Open menu</span>
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem>Edit</DropdownMenuItem>
          <DropdownMenuItem>Make a copy</DropdownMenuItem>
          <DropdownMenuItem>Favorite</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    ),
  },
];

export function TasksTable() {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  // Controlled selected status/priority sets for faceted filters
  const [selectedStatuses, setSelectedStatuses] = React.useState<Set<string>>(new Set());
  const [selectedPriorities, setSelectedPriorities] = React.useState<Set<string>>(new Set());

  const table = useReactTable({
    data: tasks,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    state: { sorting, columnFilters, columnVisibility, rowSelection },
    initialState: { pagination: { pageSize: 10 } },
  });

  // Sync status faceted filter to column filters
  const handleStatusChange = React.useCallback((values: Set<string>) => {
    setSelectedStatuses(values);
    if (values.size === 0) {
      table.getColumn("status")?.setFilterValue(undefined);
    } else {
      table.getColumn("status")?.setFilterValue(Array.from(values));
    }
  }, [table]);

  // Sync priority faceted filter to column filters
  const handlePriorityChange = React.useCallback((values: Set<string>) => {
    setSelectedPriorities(values);
    if (values.size === 0) {
      table.getColumn("priority")?.setFilterValue(undefined);
    } else {
      table.getColumn("priority")?.setFilterValue(Array.from(values));
    }
  }, [table]);

  // Compute counts from unfiltered data for faceted filters
  const statusCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    tasks.forEach((t) => counts.set(t.status, (counts.get(t.status) ?? 0) + 1));
    return counts;
  }, []);

  const priorityCounts = React.useMemo(() => {
    const counts = new Map<string, number>();
    tasks.forEach((t) => counts.set(t.priority, (counts.get(t.priority) ?? 0) + 1));
    return counts;
  }, []);

  const hasActiveFilters =
    (table.getColumn("title")?.getFilterValue() as string | undefined) ||
    selectedStatuses.size > 0 ||
    selectedPriorities.size > 0;

  function resetFilters() {
    table.getColumn("title")?.setFilterValue("");
    handleStatusChange(new Set());
    handlePriorityChange(new Set());
  }

  const pageCount = table.getPageCount();
  const pageIndex = table.getState().pagination.pageIndex;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Input
          placeholder="Filter tasks..."
          value={(table.getColumn("title")?.getFilterValue() as string) ?? ""}
          onChange={(e) => table.getColumn("title")?.setFilterValue(e.target.value)}
          className="max-w-sm"
        />
        <FacetedFilter
          title="Status"
          options={statusOptions}
          selectedValues={selectedStatuses}
          onSelectionChange={handleStatusChange}
          counts={statusCounts}
        />
        <FacetedFilter
          title="Priority"
          options={priorityOptions}
          selectedValues={selectedPriorities}
          onSelectionChange={handlePriorityChange}
          counts={priorityCounts}
        />
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters} className="h-8 px-2 text-muted-foreground">
            Reset
          </Button>
        )}
        {/* View dropdown (column visibility) */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="outline" size="sm" className="ml-auto gap-1">
                View <ChevronDown className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {table
              .getAllColumns()
              .filter((c) => c.getCanHide())
              .map((c) => (
                <DropdownMenuCheckboxItem
                  key={c.id}
                  checked={c.getIsVisible()}
                  onCheckedChange={(v) => c.toggleVisibility(!!v)}
                  className="capitalize"
                >
                  {c.id}
                </DropdownMenuCheckboxItem>
              ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && "selected"}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        {/* Selection info */}
        <div className="text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>

        {/* Pagination controls */}
        <div className="flex items-center gap-4">
          {/* Rows per page */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Rows per page</span>
            <Select
              value={String(table.getState().pagination.pageSize)}
              onValueChange={(v) => table.setPageSize(Number(v))}
            >
              <SelectTrigger className="h-8 w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 30, 40, 50].map((ps) => (
                  <SelectItem key={ps} value={String(ps)}>
                    {ps}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Page info */}
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            Page {pageIndex + 1} of {pageCount || 1}
          </div>

          {/* Navigation buttons */}
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              aria-label="Go to first page"
            >
              <ChevronsLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Go to previous page"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Go to next page"
            >
              <ChevronRight className="size-4" />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => table.setPageIndex(pageCount - 1)}
              disabled={!table.getCanNextPage()}
              aria-label="Go to last page"
            >
              <ChevronsRight className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
