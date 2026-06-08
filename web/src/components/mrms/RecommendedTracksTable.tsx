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

import { PlayButton } from "@/components/player/PlayButton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { RecommendedTrack } from "@/lib/types";


export function RecommendedTracksTable({ tracks }: { tracks: RecommendedTrack[] }) {
  return (
    <>
      {/* 모바일 — 카드 리스트 */}
      <div className="md:hidden space-y-2">
        {tracks.map((t, i) => (
          <div key={t.track_id} className="flex items-center gap-3 p-3 rounded bg-card">
            <PlayButton tracks={tracks} trackIdx={i} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="truncate font-medium text-sm">{t.title}</div>
              <div className="truncate text-xs text-muted-foreground">{t.artist}</div>
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {t.score.toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {/* 데스크탑 — 테이블 */}
      <div className="hidden md:block">
        <DesktopTable tracks={tracks} />
      </div>
    </>
  );
}


function DesktopTable({ tracks }: { tracks: RecommendedTrack[] }) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const columns: ColumnDef<RecommendedTrack>[] = [
    {
      id: "play",
      header: "",
      cell: ({ row }) => (
        <PlayButton tracks={tracks} trackIdx={row.index} size="sm" />
      ),
    },
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
