"use client";

import { useState, useMemo } from "react";
import {
  type ColumnDef,
  type RowSelectionState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { MoreHorizontal, Search, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { USERS, type User, type UserRole } from "./data";

// ─── Badge styles ─────────────────────────────────────────────────────────────

const roleClass: Record<UserRole, string> = {
  Admin:  "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  Editor: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  Viewer: "bg-secondary text-secondary-foreground",
};

const statusClass: Record<User["status"], string> = {
  Active:    "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  Invited:   "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  Suspended: "bg-red-500/15 text-red-600 dark:text-red-400",
};

// ─── Column definitions ───────────────────────────────────────────────────────

const columns: ColumnDef<User>[] = [
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
    size: 40,
  },
  {
    id: "user",
    accessorFn: (row) => `${row.name} ${row.email}`,
    header: "User",
    cell: ({ row }) => {
      const u = row.original;
      return (
        <div className="flex items-center gap-2.5">
          <Avatar size="sm">
            <AvatarFallback>{u.initials}</AvatarFallback>
          </Avatar>
          <div className="grid leading-tight">
            <span className="font-medium">{u.name}</span>
            <span className="text-xs text-muted-foreground">{u.email}</span>
          </div>
        </div>
      );
    },
    filterFn: (row, _id, filterValue: string) => {
      const v = filterValue.toLowerCase();
      return (
        row.original.name.toLowerCase().includes(v) ||
        row.original.email.toLowerCase().includes(v)
      );
    },
  },
  {
    accessorKey: "role",
    header: "Role",
    cell: ({ row }) => {
      const role = row.getValue<UserRole>("role");
      return (
        <Badge className={cn("border-transparent", roleClass[role])}>
          {role}
        </Badge>
      );
    },
    filterFn: (row, _id, filterValue: string) =>
      filterValue === "all" || row.original.role === filterValue,
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const s = row.getValue<User["status"]>("status");
      return (
        <Badge className={cn("border-transparent", statusClass[s])}>{s}</Badge>
      );
    },
  },
  {
    accessorKey: "lastActive",
    header: "Last active",
    cell: ({ row }) => {
      const iso = row.getValue<string>("lastActive");
      // Format as "Jun 6, 2026" — deterministic from ISO string, safe in render
      const [year, month, day] = iso.split("-").map(Number);
      const d = new Date(year, month - 1, day);
      return (
        <span className="text-muted-foreground">
          {d.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      );
    },
  },
  {
    id: "actions",
    header: "",
    cell: ({ row }) => {
      const u = row.original;
      return (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="Open actions">
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{u.name}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>View</DropdownMenuItem>
            <DropdownMenuItem>Edit</DropdownMenuItem>
            <DropdownMenuItem>Suspend</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
    enableSorting: false,
    size: 48,
  },
];

// ─── Root ─────────────────────────────────────────────────────────────────────

export function UsersPage() {
  const [globalFilter, setGlobalFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const filteredData = useMemo(() => {
    const q = globalFilter.toLowerCase();
    return USERS.filter((u) => {
      const matchesSearch =
        !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchesRole = roleFilter === "all" || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [globalFilter, roleFilter]);

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { rowSelection },
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 8 } },
  });

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Users</h1>
          <p className="text-sm text-muted-foreground">
            Manage your team members and their account permissions.
          </p>
        </div>
        <Button>
          <Plus className="size-4" />
          Add User
        </Button>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email…"
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="pl-8"
          />
        </div>
        <div className="flex gap-1.5">
          {(["all", "Admin", "Editor", "Viewer"] as const).map((r) => (
            <Button
              key={r}
              variant={roleFilter === r ? "default" : "outline"}
              size="sm"
              onClick={() => setRoleFilter(r)}
            >
              {r === "all" ? "All" : r}
            </Button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id} style={{ width: h.column.columnDef.size }}>
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
                  data-state={row.getIsSelected() ? "selected" : undefined}
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
                  No users found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
        <span>
          {table.getFilteredSelectedRowModel().rows.length} of{" "}
          {filteredData.length} row(s) selected.
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs">
            Page {table.getState().pagination.pageIndex + 1} of{" "}
            {table.getPageCount() || 1}
          </span>
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
  );
}
