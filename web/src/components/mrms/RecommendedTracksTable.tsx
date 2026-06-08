"use client";

import {
  type ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  type SortingState,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RecommendedTrack } from "@/lib/types";


const columns: ColumnDef<RecommendedTrack>[] = [
  { accessorKey: "title", header: "Title" },
  { accessorKey: "artist", header: "Artist" },
  {
    accessorKey: "persona_idx",
    header: "From",
    cell: ({ row }) => row.original.persona_idx ?? "-",
  },
  {
    accessorKey: "score",
    header: "Score",
    cell: ({ row }) => row.original.score.toFixed(3),
  },
];


export function RecommendedTracksTable({ tracks }: { tracks: RecommendedTrack[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const table = useReactTable({
    data: tracks,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((hg) => (
          <TableRow key={hg.id}>
            {hg.headers.map((h) => (
              <TableHead
                key={h.id}
                onClick={h.column.getToggleSortingHandler()}
                className="cursor-pointer select-none"
              >
                {flexRender(h.column.columnDef.header, h.getContext())}
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
  );
}
